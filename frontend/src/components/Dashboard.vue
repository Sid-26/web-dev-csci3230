<template>
  <div class="flex flex-col min-h-[calc(100vh-48px)]">
    <!-- Actions -->
    <div class="flex flex-col items-center justify-center gap-3 flex-1">
      <AppButton label="Create Note" @click="handleCreateNote">
        <template #icon><CirclePlus /></template>
      </AppButton>
      <AppButton label="View Graph" @click="$router.push('/graph')">
        <template #icon><Network /></template>
      </AppButton>
    </div>

    <!-- Recently visited rendered entirely by jQuery -->
    <div id="jq-recently-visited"></div>
  </div>
</template>

<script setup>
import { onMounted, watch, createApp, h } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus, Network } from "lucide-vue-next";
import $ from "jquery";
import AppButton from "./AppButton.vue";
import { useEditorStore } from "../composables/useEditorStore";
import { resolveIcon } from "./editor/iconMap.js";

const router = useRouter();
const { createFile, setActiveFile, recentFiles, loading, init } =
  useEditorStore();
onMounted(init);

async function handleCreateNote() {
  await createFile();
  router.push("/editor");
}

function openNote(id) {
  setActiveFile(id);
  router.push("/editor");
}

// Icon renderer converts any ICON_MAP key to SVG string
const iconSvgCache = {};
function getIconSvg(iconName) {
  if (iconSvgCache[iconName]) return iconSvgCache[iconName];
  const Icon = resolveIcon(iconName);
  const div = document.createElement("div");
  const app = createApp({ render: () => h(Icon, { width: 20, height: 20 }) });
  app.mount(div);
  iconSvgCache[iconName] = div.innerHTML;
  app.unmount();
  return iconSvgCache[iconName];
}

// Inline SVG strings 

const SVG_CLOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 12"/></svg>`;

const SVG_FILE_TEXT = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;

const SVG_CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

const SVG_CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// jQuery stuff

function renderRecentlyVisited() {
  const $mount = $("#jq-recently-visited");
  $mount.empty();

  // Outer section wrapper
  const $outer = $("<div>").addClass("border-t border-[var(--border)] py-8");
  const $inner = $("<div>").addClass("w-full max-w-2xl mx-auto px-8");

  // Section heading
  const $heading = $("<h2>")
    .addClass(
      "flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] mb-5",
    )
    .append($(SVG_CLOCK))
    .append($("<span>").text("Recently visited"));
  $inner.append($heading);

  if (recentFiles.value.length === 0 && !loading.value) {
    // Empty state is only shown after notes have finished loading
    $inner.append(
      $("<p>")
        .addClass("text-sm text-[var(--text-muted)]")
        .text("No notes yet — create your first note above."),
    );
  } else {
    const $relWrapper = $("<div>").addClass("relative");

    // Left scroll arrow (hidden until scrolled right)
    const $leftArrow = $("<button>")
      .addClass(
        "absolute -left-4 top-1/2 -translate-y-1/2 z-10 " +
          "flex items-center justify-center w-8 h-8 rounded-full " +
          "bg-[var(--surface)] border border-[var(--border)] " +
          "text-[var(--text-muted)] hover:text-[var(--text)] " +
          "hover:bg-[var(--surface-hover)] transition-colors shadow-lg",
      )
      .html(SVG_CHEVRON_LEFT)
      .hide();

    // Right scroll arrow
    const $rightArrow = $("<button>")
      .addClass(
        "absolute -right-4 top-1/2 -translate-y-1/2 z-10 " +
          "flex items-center justify-center w-8 h-8 rounded-full " +
          "bg-[var(--surface)] border border-[var(--border)] " +
          "text-[var(--text-muted)] hover:text-[var(--text)] " +
          "hover:bg-[var(--surface-hover)] transition-colors shadow-lg",
      )
      .html(SVG_CHEVRON_RIGHT)
      .hide();

    // Scroll container
    const $scrollContainer = $("<div>").addClass(
      "flex gap-3 overflow-x-auto scrollbar-hide",
    );

    // Build a card for each recent file
    for (const file of recentFiles.value) {
      const rawDate = file.lastVisitedAt || file.updatedAt;
      const formattedDate = rawDate
        ? new Date(rawDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "";

      const $card = $("<div>")
        .addClass(
          "jq-note-card shrink-0 cursor-pointer rounded-lg " +
            "border border-[var(--border)] bg-[var(--surface)] " +
            "p-3 flex flex-col gap-2",
        )
        .css("width", "calc(25% - 9px)")
        .data("note-id", file.id);

      // File icon
      const $iconWrap = $("<div>")
        .addClass("text-[var(--text-muted)]")
        .html(getIconSvg(file.icon || "FileText"));

      // Bottom row: title + date on the left, chevron on the right
      const $bottom = $("<div>").addClass(
        "flex items-end justify-between gap-1 mt-auto",
      );

      const $textGroup = $("<div>").addClass("min-w-0");
      $textGroup.append(
        $("<h3>")
          .addClass("text-sm font-medium text-[var(--text)] truncate")
          .text(file.name),
      );
      $textGroup.append(
        $("<p>")
          .addClass("text-xs text-[var(--text-muted)] mt-0.5")
          .text(formattedDate),
      );

      const $chevron = $("<span>")
        .addClass("jq-card-chevron flex-shrink-0 text-[var(--text-muted)]")
        .css("opacity", "0")
        .html(SVG_CHEVRON_RIGHT);

      $bottom.append($textGroup, $chevron);
      $card.append($iconWrap, $bottom);

      $card.on("click", () => openNote(file.id));

      $card.hover(
        function () {
          $(this).find(".jq-card-chevron").css("opacity", "1");
        },
        function () {
          $(this).find(".jq-card-chevron").css("opacity", "0");
        },
      );

      $scrollContainer.append($card);
    }

    // Scroll event
    $scrollContainer.on("scroll", function () {
      const el = this;
      el.scrollLeft > 0 ? $leftArrow.show() : $leftArrow.hide();
      el.scrollLeft + el.clientWidth < el.scrollWidth - 1
        ? $rightArrow.show()
        : $rightArrow.hide();
    });

    // Arrow clicks event
    $leftArrow.on("click", function () {
      const el = $scrollContainer[0];
      $scrollContainer.animate(
        { scrollLeft: el.scrollLeft - el.clientWidth },
        300,
      );
    });

    $rightArrow.on("click", function () {
      const el = $scrollContainer[0];
      $scrollContainer.animate(
        { scrollLeft: el.scrollLeft + el.clientWidth },
        300,
      );
    });

    $relWrapper.append($leftArrow, $scrollContainer, $rightArrow);
    $inner.append($relWrapper);

    // Trigger initial arrow state check after DOM is painted
    setTimeout(() => $scrollContainer.trigger("scroll"), 0);
  }

  $outer.append($inner);
  $mount.append($outer);
}

// Lifecycle stuff

onMounted(() => renderRecentlyVisited());

// Rerender if the note list changes while the Dashboard is visible
watch(recentFiles, () => renderRecentlyVisited());
</script>

<style>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
