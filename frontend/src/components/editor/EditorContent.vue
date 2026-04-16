<template>
  <div class="editor-content" v-if="file">
    <!-- Note title -->
    <div class="note-header">
      <div class="title-row">
        <!-- Clickable icon -->
        <button class="note-icon-btn" title="Change icon" @click="openPicker">
          <component :is="noteIcon" class="w-8 h-8" />
        </button>
        <input
          class="note-title"
          :value="file.name"
          :readonly="isReadOnly"
          @input="$emit('rename', file.id, $event.target.value, 'file')"
          @keydown.enter.prevent="focusEditor"
        />
      </div>
      <div class="note-meta">
        <Clock class="w-3 h-3" />
        Modified {{ formatDate(file.updatedAt) }}
      </div>
    </div>

    <!-- Icon picker -->
    <Teleport to="body">
      <IconPicker
        v-if="pickerOpen"
        :current="file.icon || 'FileText'"
        :position="pickerPos"
        @select="handleIconSelect"
        @close="pickerOpen = false"
      />
    </Teleport>

    <!-- Tag autocomplete -->
    <Teleport to="body">
      <div
        v-if="tagOpen && tagResults.length"
        class="tag-autocomplete"
        :style="{ top: tagPos.top + 'px', left: tagPos.left + 'px' }"
      >
        <button
          v-for="(tag, i) in tagResults"
          :key="tag"
          class="tag-ac-item"
          :class="{ selected: i === tagSelectedIdx }"
          @mousedown.prevent="selectTag(tag)"
        >
          #{{ tag }}
        </button>
      </div>
    </Teleport>

    <!-- Wiki-link autocomplete -->
    <Teleport to="body">
      <div
        v-if="wikiOpen && wikiResults.length"
        class="wiki-autocomplete"
        :style="{ top: wikiPos.top + 'px', left: wikiPos.left + 'px' }"
      >
        <button
          v-for="(note, i) in wikiResults"
          :key="note.id"
          class="wiki-ac-item"
          :class="{ selected: i === wikiSelectedIdx }"
          @mousedown.prevent="selectWikiNote(note)"
        >
          <component
            :is="resolveIcon(note.icon || 'FileText')"
            class="w-3.5 h-3.5 flex-shrink-0"
          />
          {{ note.name }}
        </button>
      </div>
    </Teleport>

    <!-- Editable area -->
    <div
      ref="editorRef"
      class="editor-area"
      :contenteditable="!isReadOnly"
      spellcheck="true"
      @input="handleInput"
      @keydown="handleKeydown"
      @click="handleWikiLinkClick"
      @blur="handleEditorBlur"
      @scroll="handleScroll"
    />
  </div>
  <div v-else-if="!loading" class="empty-state">
    <FileText class="w-12 h-12 text-[var(--text-muted)]" />
    <p>No notes yet</p>
    <p class="sub">
      Your vault is empty. Create your first note and start building your
      knowledge base.
    </p>
    <button class="create-btn" @click="$emit('createFirst')">
      <FileText class="w-4 h-4" />
      Create first note
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { Clock, FileText } from "lucide-vue-next";
import { resolveIcon } from "./iconMap.js";
import { useEditorStore } from "../../composables/useEditorStore.js";
import IconPicker from "./IconPicker.vue";

const props = defineProps({
  file: { type: Object, default: null },
  livePreview: { type: Boolean, default: true },
  isReadOnly: { type: Boolean, default: false },
  readOnlyContent: { type: String, default: "" },
});

const emit = defineEmits([
  "update",
  "scroll",
  "rename",
  "createFirst",
  "tag-click",
]);

const {
  updateItemIcon,
  state,
  setActiveFile,
  createFile,
  syncNoteLinks,
  loading,
  globalTags,
  ensureGlobalTag,
} = useEditorStore();

const pickerOpen = ref(false);
const pickerPos = ref({ top: 0, left: 0 });

const noteIcon = computed(() => resolveIcon(props.file?.icon || "FileText"));

function handleScroll() {
  const el = editorRef.value;
  if (!el) return;

  emit("scroll", {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  });
}

function openPicker(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  pickerPos.value = {
    top: rect.bottom + 6,
    left: rect.left,
  };
  pickerOpen.value = true;
}

function handleIconSelect(iconName) {
  if (props.file) updateItemIcon(props.file.id, iconName);
}

const editorRef = ref(null);
let isUpdatingFromProp = false;
let lastEmittedContent = "";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    ", " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

// When active file changes, load its content into the editor

watch(
  () => props.readOnlyContent,
  (newVal) => {
    if (!editorRef.value || !props.isReadOnly) return;

    isUpdatingFromProp = true;
    editorRef.value.innerHTML = contentToHtml(newVal);
    renderWikiLinksInDOM();
    nextTick(() => {
      isUpdatingFromProp = false;
    });
  },
  { immediate: true },
);

watch(
  [() => props.file?.id, () => props.livePreview],
  () => {
    if (props.file && editorRef.value) {
      lastEmittedContent = props.file.content ?? "";
      isUpdatingFromProp = true;
      editorRef.value.innerHTML = contentToHtml(props.file.content);
      nextTick(() => {
        isUpdatingFromProp = false;
      });
    }
  },
  { immediate: true },
);

// When content is updated externally (e.g. auto-tag writes to file), re-render the editor
watch(
  () => props.file?.content,
  (newContent) => {
    if (!editorRef.value || !props.file) return;
    if ((newContent ?? "") === lastEmittedContent) return; // editor itself caused this change
    lastEmittedContent = newContent ?? "";
    isUpdatingFromProp = true;
    editorRef.value.innerHTML = contentToHtml(newContent);
    nextTick(() => {
      isUpdatingFromProp = false;
    });
  },
);

// Also handle initial mount
watch(editorRef, (el) => {
  if (el && props.file) {
    el.innerHTML = contentToHtml(props.file.content);
  }
});

// Processes a plain-text line into HTML with inline markdown rendered and md-syntax marker spans preserved for non-destructive editing.
function processLineContent(text) {
  const codeBlocks = [];
  const urls = [];
  const rawUrls = [];

  // Step 1: extract inline code and replace with placeholders
  text = text.replace(/`([^`]+?)`/g, (_, c) => {
    const placeholder = `@@CODE${codeBlocks.length}@@`;
    // Store literal content inside code
    codeBlocks.push(c);
    return placeholder;
  });

  // Markdown links: [text](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^\s)]+)\)/g,
    (_, c, c1) => {
      const placeholder = `@@URL${urls.length}@@`;
      urls.push([c, c1]);
      return placeholder;
    },
  );

  // Raw URLs (avoid double-wrapping links already handled above)
  text = text.replace(/(https?:\/\/[^\s<]+)/g, (_, c) => {
    const placeholder = `@@RAW_URL${rawUrls.length}@@`;
    rawUrls.push(c);
    return placeholder;
  });

  // Bold-italic
  text = text.replace(
    /\*\*\*([^*<>]+?)\*\*\*/g,
    (_, c) =>
      `<strong><em><span class="md-syntax" contenteditable="false">***</span>${c}<span class="md-syntax" contenteditable="false">***</span></em></strong>`,
  );

  // Bold
  text = text.replace(
    /\*\*([^*<>]+?)\*\*/g,
    (_, c) =>
      `<strong><span class="md-syntax" contenteditable="false">**</span>${c}<span class="md-syntax" contenteditable="false">**</span></strong>`,
  );

  // Italic
  text = text.replace(
    /(?<!\*)\*([^*<>\n]+?)\*(?!\*)/g,
    (_, c) =>
      `<em><span class="md-syntax" contenteditable="false">*</span>${c}<span class="md-syntax" contenteditable="false">*</span></em>`,
  );

  // Strikethrough
  text = text.replace(
    /~~([^~<>]+?)~~/g,
    (_, c) =>
      `<s><span class="md-syntax" contenteditable="false">~~</span>${c}<span class="md-syntax" contenteditable="false">~~</span></s>`,
  );

  // Tags (#tagname — not # alone or # followed by space)
  text = text.replace(
    /#([a-zA-Z0-9]{1,30})/g,
    (_, name) =>
      `<span class="tag-link" contenteditable="false" data-tag="${name}">#${name}</span>`,
  );

  // Wiki-links (skip self-references)
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    if (name.toLowerCase() === props.file?.name?.toLowerCase())
      return `[[${name}]]`;
    return `<span class="wiki-link" contenteditable="false" data-name="${name}">${name}</span>`;
  });

  // Ensures the browser can let you type after a closing italic element: without this, Enter after a preview mode does nothing

  if (/<\/(em|strong|s|code|span)>$/.test(text)) {
    text += "\u200B";
  }
  // only for read only mode since live edit mode needs more complicated stuff to have this work

  text = text.replace(/@@CODE(\d+)@@/g, (_, index) => {
    const c = codeBlocks[index];
    return `<code><span class="md-syntax" contenteditable="false">\`</span>${c}<span class="md-syntax" contenteditable="false">\`</span></code>`;
  });

  text = text.replace(/@@URL(\d+)@@/g, (_, index) => {
    const c = urls[index];
    const cls = c[1].startsWith("#") ? "md_url_ref" : "md_url";
    return `<a href="${c[1]}" class="${cls} md-link" target="_blank" rel="noopener noreferrer">${c[0]}</a>`;
  });

  text = text.replace(/@@RAW_URL(\d+)@@/g, (_, index) => {
    const c = rawUrls[index];
    return `<a href="${c}" class="md_raw_url md-link" target="_blank" rel="noopener noreferrer">${c}</a>`;
  });

  return text;
}

function generateId(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word characters except spaces and hyphens
    .replace(/\s+/g, "-"); // replace spaces with hyphens
}
function contentToHtml(content) {
  if (!content) return "<p><br></p>";
  const lines = content.split("\n");
  const result = [];
  let i = 0;
  let isCodeBlock = false;
  let codeBlockStr = "";

  while (i < lines.length) {
    const line = lines[i];

    if (isCodeBlock) {
      if (line.startsWith("```")) {
        isCodeBlock = false;

        result.push(`<pre class="font-mono">${codeBlockStr}</pre>`);
        i++;
        continue;
      }
      codeBlockStr += line + "\n";
      i++;
      continue;
    }

    if (!props.livePreview) {
      i++;
      if (line === "") {
        result.push(`<p class="font-mono"><br></p>`);
      } else {
        result.push(`<p class="font-mono">${line}</p>`);
      }
      continue;
    }
    // GFM table: collect consecutive pipe delimited rows
    if (/^\|.+\|$/.test(line.trim())) {
      const tableLines = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(renderMarkdownTable(tableLines));
      continue;
    }

    // HTML heading tags, preserve as <h1>/<h2>/<h3> markers not converted to markdown type
    const htmlHeadingMatch = line.match(/^<(h[123])>(.*)<\/\1>$/);
    if (htmlHeadingMatch) {
      const tag = htmlHeadingMatch[1];
      const inner = processLineContent(htmlHeadingMatch[2]);
      result.push(
        `<${tag}><span class="md-syntax" contenteditable="false">&lt;${tag}&gt;</span>${inner}<span class="md-syntax" contenteditable="false">&lt;/${tag}&gt;</span></${tag}>`,
      );
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      codeBlockStr = "";
      isCodeBlock = true;
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      const id = generateId(line.slice(3));
      result.push(
        `<h3 id=${id}><span class="md-syntax" contenteditable="false">### </span>${processLineContent(line.slice(4))}</h3>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      const id = generateId(line.slice(3));
      result.push(
        `<h2 id=${id}><span class="md-syntax" contenteditable="false">## </span>${processLineContent(line.slice(3))}</h2>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      const id = generateId(line.slice(3));
      result.push(
        `<h1 id=${id}><span class="md-syntax" contenteditable="false"># </span>${processLineContent(line.slice(2))}</h1>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      result.push(
        `<blockquote>${processLineContent(line.slice(2))}</blockquote>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("- [ ] ")) {
      result.push(
        `<div class="checklist-item"><input type="checkbox" />${line.slice(6)}</div>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("- [x] ")) {
      result.push(
        `<div class="checklist-item"><input type="checkbox" checked />${line.slice(6)}</div>`,
      );
      i++;
      continue;
    }
    if (line.startsWith("- ")) {
      result.push(`<li>${processLineContent(line.slice(2))}</li>`);
      i++;
      continue;
    }
    if (line.startsWith("---")) {
      result.push("<hr>");
      i++;
      continue;
    }
    if (line === "") {
      result.push("<p><br></p>");
      i++;
      continue;
    }

    result.push(`<p>${processLineContent(line)}</p>`);
    i++;
  }

  return result.join("");
}

// Renders an array of GFM table lines into an HTML table element string
function renderMarkdownTable(lines) {
  if (!lines.length) return "";

  // Separator lines look like |---|---| filter them out when building rows
  const isSeparator = (l) => /^\|[\s\-:|]+\|$/.test(l.trim());

  const rows = lines
    .filter((l) => !isSeparator(l))
    .map((l) =>
      l
        .trim()
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );

  if (!rows.length) return "";

  const cols = Math.max(...rows.map((r) => r.length));
  const [headerRow, ...dataRows] = rows;

  let html = "<table><thead><tr>";
  for (let c = 0; c < cols; c++) {
    html += `<th>${processLineContent(headerRow[c] ?? "")}</th>`;
  }
  html += "</tr></thead>";

  if (dataRows.length) {
    html += "<tbody>";
    for (const row of dataRows) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td>${processLineContent(row[c] ?? "")}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }

  return html + "</table>";
}

// Serializes a node's content to markdown, preserving inline formatting and [[wiki-link]] spans
function serializeInnerMarkdown(node) {
  let result = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const t = child.tagName.toLowerCase();
      if (t === "span" && child.classList.contains("tag-link")) {
        result += `#${child.dataset.tag || child.textContent.slice(1)}`;
      } else if (t === "span" && child.classList.contains("wiki-link")) {
        result += `[[${child.dataset.name || child.textContent}]]`;
      } else if (t === "span" && child.classList.contains("md-syntax")) {
      } else if (t === "strong" || t === "b") {
        const inner = serializeInnerMarkdown(child);
        // Check if it also wraps <em> for bold-italic
        if (child.querySelector("em") && child.childNodes.length <= 3) {
          result += `***${serializeInnerMarkdown(child.querySelector("em"))}***`;
        } else {
          result += `**${inner}**`;
        }
      } else if (t === "em" || t === "i") {
        // Only wrap with * if not already handled by bold-italic above
        const parent = child.parentElement?.tagName?.toLowerCase();
        if (parent !== "strong" && parent !== "b") {
          result += `*${serializeInnerMarkdown(child)}*`;
        } else {
          result += serializeInnerMarkdown(child);
        }
      } else if (t === "s" || t === "del") {
        result += `~~${serializeInnerMarkdown(child)}~~`;
      } else if (t === "code") {
        result += `\`${serializeInnerMarkdown(child)}\``;
      } else if (t === "a" && child.href) {
        if (child.classList.contains("md_url_ref")) {
          const hash = new URL(child.href).hash || "";
          result += `[${child.textContent}](${hash})`;
        } else if (child.classList.contains("md_url")) {
          result += `[${child.textContent}](${child.href})`;
        } else if (child.classList.contains("md_raw_url")) {
          result += `${child.href}`;
        } else {
          result += `[${serializeInnerMarkdown(child)}](${child.getAttribute("href")})`;
        }
      } else if (t === "br") {
      } else {
        result += serializeInnerMarkdown(child);
      }
    }
  }
  return result;
}

function htmlToContent(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html.replace(/\u200B/g, "");
  const lines = [];
  for (const node of tempDiv.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent);
      continue;
    }
    const tag = node.tagName?.toLowerCase();
    const text = node.textContent || "";
    const rich = serializeInnerMarkdown(node);
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      // Check the first md syntax span to determine if this was typed as HTML or markdown
      const firstMarker = node.querySelector(".md-syntax")?.textContent || "";
      if (firstMarker.startsWith("<")) {
        // HTML tag style
        lines.push(`<${tag}>${rich}</${tag}>`);
      } else {
        // Markdown style
        lines.push("#".repeat(parseInt(tag[1])) + " " + rich);
      }
    } else if (tag === "blockquote") lines.push(`> ${rich}`);
    else if (tag === "pre") lines.push("```\n" + text + "\n```");
    else if (tag === "hr") lines.push("---");
    else if (tag === "li") lines.push(`- ${rich}`);
    else if (tag === "ul" || tag === "ol") {
      for (const li of node.querySelectorAll("li")) {
        lines.push(`- ${serializeInnerMarkdown(li)}`);
      }
    } else if (tag === "div" && node.classList.contains("checklist-item")) {
      const checked = node.querySelector("input")?.checked;
      lines.push(checked ? `- [x] ${text.trim()}` : `- [ ] ${text.trim()}`);
    } else if (tag === "table") {
      lines.push(...serializeTable(node));
    } else {
      lines.push(rich === "" ? "" : rich);
    }
  }
  return lines.join("\n");
}

// Serializes a <table> DOM node back to GFM markdown table syntax
function serializeTable(tableNode) {
  const allRows = Array.from(tableNode.querySelectorAll("tr"));
  if (!allRows.length) return [];

  const parsedRows = allRows.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) =>
      serializeInnerMarkdown(cell).trim(),
    ),
  );

  const cols = Math.max(...parsedRows.map((r) => r.length));
  const pad = (cell) => cell || "";

  const lines = [];
  // Header row
  lines.push("| " + parsedRows[0].map(pad).join(" | ") + " |");
  // Separator
  lines.push("| " + Array(cols).fill("---").join(" | ") + " |");
  // Data rows
  for (const row of parsedRows.slice(1)) {
    lines.push(
      "| " +
        Array(cols)
          .fill(0)
          .map((_, i) => pad(row[i]))
          .join(" | ") +
        " |",
    );
  }
  return lines;
}

// Scans the editor for any [[...]] plaintext patterns not yet wrapped in a wik-link span, converts them in-place and restores the cursor pos
function renderWikiLinksInDOM() {
  if (!editorRef.value) return;

  const sel = window.getSelection();
  const anchorNode = sel?.anchorNode;
  const anchorOffset = sel?.anchorOffset ?? 0;

  const walker = document.createTreeWalker(
    editorRef.value,
    NodeFilter.SHOW_TEXT,
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (
      !n.parentElement?.classList.contains("wiki-link") &&
      /\[\[[^\]]+\]\]/.test(n.textContent)
    ) {
      nodes.push(n);
    }
  }

  if (!nodes.length) return;

  let restoreTo = null;

  for (const textNode of nodes) {
    const text = textNode.textContent;
    const regex = /\[\[([^\]]+)\]\]/g;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    let lastInserted = null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        const t = document.createTextNode(text.slice(last, match.index));
        frag.appendChild(t);
        if (
          textNode === anchorNode &&
          anchorOffset >= last &&
          anchorOffset <= match.index
        ) {
          restoreTo = { node: t, offset: anchorOffset - last };
        }
        lastInserted = t;
      }
      // Skip self reference keep plaintext
      if (match[1].toLowerCase() === props.file?.name?.toLowerCase()) {
        frag.appendChild(document.createTextNode(match[0]));
        lastInserted = frag.lastChild;
        last = regex.lastIndex;
        continue;
      }
      const span = document.createElement("span");
      span.className = "wiki-link";
      span.setAttribute("contenteditable", "false");
      span.setAttribute("data-name", match[1]);
      span.textContent = match[1];
      frag.appendChild(span);
      lastInserted = span;
      last = regex.lastIndex;
    }

    if (last < text.length) {
      const t = document.createTextNode(text.slice(last));
      frag.appendChild(t);
      if (textNode === anchorNode && anchorOffset >= last && !restoreTo) {
        restoreTo = {
          node: t,
          offset: Math.min(anchorOffset - last, t.textContent.length),
        };
      }
      lastInserted = t;
    }

    if (textNode === anchorNode && !restoreTo && lastInserted) {
      if (lastInserted.nodeType === Node.TEXT_NODE) {
        restoreTo = {
          node: lastInserted,
          offset: lastInserted.textContent.length,
        };
      } else {
        restoreTo = { afterNode: lastInserted };
      }
    }

    textNode.parentNode.replaceChild(frag, textNode);
  }

  if (sel && restoreTo) {
    try {
      const range = document.createRange();
      if (restoreTo.afterNode) {
        range.setStartAfter(restoreTo.afterNode);
      } else {
        range.setStart(restoreTo.node, restoreTo.offset);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      /* best-effort cursor restoration */
    }
  }
}

function handleInput() {
  if (isUpdatingFromProp) return;
  if (props.livePreview) {
    applyLiveMarkdown();
    checkAndRenderInlinePattern();
  }
  const html = editorRef.value?.innerHTML || "";
  const markdown = htmlToContent(html);
  lastEmittedContent = markdown;
  emit("update", markdown);
  if (props.livePreview) {
    renderWikiLinksInDOM();
    renderTagsInDOM();
  }
  checkWikiAutocomplete();
  checkTagAutocomplete();
  updateCursorLine();
}

function handleKeydown(e) {
  if (props.isReadOnly) {
    return;
  }
  // When user closes a #tag with space/enter/tab, immediately register it as a global tag.
  // Only fires when autocomplete is not open (otherwise we'd register the partial, not the selection).
  if (
    (e.key === " " || e.key === "Enter" || e.key === "Tab") &&
    !tagOpen.value
  ) {
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const container = sel.getRangeAt(0).startContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        const textBefore = container.textContent.slice(
          0,
          sel.getRangeAt(0).startOffset,
        );
        const match = textBefore.match(/#([a-zA-Z0-9]{1,30})$/);
        if (match) ensureGlobalTag(match[1].toLowerCase());
      }
    }
  }

  // Tag autocomplete navigation
  if (tagOpen.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      tagSelectedIdx.value = Math.min(
        tagSelectedIdx.value + 1,
        tagResults.value.length - 1,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      tagSelectedIdx.value = Math.max(tagSelectedIdx.value - 1, 0);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (tagResults.value[tagSelectedIdx.value])
        selectTag(tagResults.value[tagSelectedIdx.value]);
      return;
    }
    if (e.key === " " || e.key === "Escape") {
      closeTagAutocomplete();
      return;
    }
  }
  // Wiki-link autocomplete navigation
  if (wikiOpen.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      wikiSelectedIdx.value = Math.min(
        wikiSelectedIdx.value + 1,
        wikiResults.value.length - 1,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      wikiSelectedIdx.value = Math.max(wikiSelectedIdx.value - 1, 0);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (wikiResults.value[wikiSelectedIdx.value])
        selectWikiNote(wikiResults.value[wikiSelectedIdx.value]);
      return;
    }
    if (e.key === "Escape") {
      closeWikiAutocomplete();
      return;
    }
  }
  // Tab inserts spaces instead of moving focus
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  }
}

function focusEditor() {
  editorRef.value?.focus();
}

// Live markdown detection
function applyLiveMarkdown() {
  if (!editorRef.value) return;

  const sel = window.getSelection();
  if (!sel?.rangeCount) return;

  const range = sel.getRangeAt(0);
  let node = range.startContainer;

  // Find the block element containing the cursor
  let block = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (block && block !== editorRef.value) {
    const tag = block.tagName?.toLowerCase();
    if (["p", "div", "h1", "h2", "h3", "blockquote", "li"].includes(tag)) break;
    block = block.parentElement;
  }

  if (!block || block === editorRef.value) return;

  const tag = block.tagName.toLowerCase();
  const fullText = block.textContent;

  // Case 1: Convert paragraph to heading if text starts with markdown prefix
  if ((tag === "p" || tag === "div") && !block.querySelector(".wiki-link")) {
    // Literal HTML heading tags preserve the tags as markers
    const htmlTagMatch = fullText.match(/^<(h[123])>([\s\S]*?)<\/\1>$/);
    if (htmlTagMatch) {
      const headingTag = htmlTagMatch[1];
      const content = htmlTagMatch[2];
      const heading = document.createElement(headingTag);

      const openSpan = document.createElement("span");
      openSpan.className = "md-syntax";
      openSpan.setAttribute("contenteditable", "false");
      openSpan.textContent = `<${headingTag}>`;

      const closeSpan = document.createElement("span");
      closeSpan.className = "md-syntax";
      closeSpan.setAttribute("contenteditable", "false");
      closeSpan.textContent = `</${headingTag}>`;

      heading.appendChild(openSpan);
      const contentNode = document.createTextNode(content);
      heading.appendChild(contentNode);
      heading.appendChild(closeSpan);
      block.parentNode.replaceChild(heading, block);

      // Place cursor at end of content (between the two spans)
      try {
        const newRange = document.createRange();
        newRange.setStart(contentNode, contentNode.textContent.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch (e) {}
      return;
    }

    // Markdown prefix
    let targetHeading = null;
    let markerLen = 0;

    if (fullText.startsWith("### ")) {
      targetHeading = "h3";
      markerLen = 4;
    } else if (fullText.startsWith("## ")) {
      targetHeading = "h2";
      markerLen = 3;
    } else if (fullText.startsWith("# ")) {
      targetHeading = "h1";
      markerLen = 2;
    }

    if (targetHeading) {
      convertBlockToHeading(block, targetHeading, markerLen, sel, range);
    }
  }

  // Case 2: Convert heading back to paragraph if md-syntax span was deleted
  if (["h1", "h2", "h3"].includes(tag)) {
    const hasMdSyntax = !!block.querySelector(".md-syntax");
    if (!hasMdSyntax) {
      convertHeadingToParagraph(block, sel);
    }
  }
}

function convertBlockToHeading(
  block,
  headingTag,
  markerLen,
  sel,
  originalRange,
) {
  // Remove prefix from first text node
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const firstText = walker.nextNode();
  let cursorOffset = originalRange.startOffset;

  if (firstText) {
    const originalLength = firstText.textContent.length;
    if (firstText.textContent.length >= markerLen) {
      firstText.textContent = firstText.textContent.slice(markerLen);
    }
  }

  // Create heading element
  const heading = document.createElement(headingTag);
  const marker = "#".repeat(parseInt(headingTag[1])) + " ";

  // Create m syntax span
  const mdSpan = document.createElement("span");
  mdSpan.className = "md-syntax";
  mdSpan.setAttribute("contenteditable", "false");
  mdSpan.textContent = marker;
  heading.appendChild(mdSpan);

  // Move all children from block to heading
  while (block.firstChild) {
    heading.appendChild(block.firstChild);
  }

  block.parentNode.replaceChild(heading, block);

  // Restore cursor position
  try {
    const newRange = document.createRange();
    // Find first text node in heading (skipping md-syntax span)
    const walker2 = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.parentElement?.classList.contains("md-syntax")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const firstContentText = walker2.nextNode();

    if (firstContentText) {
      const newOffset = Math.max(
        0,
        Math.min(cursorOffset - markerLen, firstContentText.textContent.length),
      );
      newRange.setStart(firstContentText, newOffset);
    } else {
      newRange.setStart(heading, heading.childNodes.length);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } catch (e) {
    // Best effort is cursor restoration failed
  }
}

function convertHeadingToParagraph(heading, sel) {
  const p = document.createElement("p");

  // Preserve innerHTML
  p.innerHTML = heading.innerHTML;
  heading.parentNode.replaceChild(p, heading);

  // Restore cursor
  try {
    const currentSelection = window.getSelection();
    if (currentSelection?.rangeCount) {
      const range = currentSelection.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      const newRange = document.createRange();
      if (p.contains(node)) {
        newRange.setStart(
          node,
          Math.min(offset, node.textContent?.length || 0),
        );
      } else {
        newRange.setStart(p, 0);
      }
      newRange.collapse(true);
      currentSelection.removeAllRanges();
      currentSelection.addRange(newRange);
    }
  } catch (e) {
    // Best effort
  }
}

// Real time inline markdown rendering

const INLINE_PATTERNS = [
  // Bold-italic
  {
    regex: /\*\*\*([^*]+)\*\*\*$/,
    open: "***",
    close: "***",
    tag: "strong",
    innerTag: "em",
  },
  // Bold
  {
    regex: /\*\*([^*]+)\*\*$/,
    open: "**",
    close: "**",
    tag: "strong",
    innerTag: null,
  },
  // Italic
  {
    regex: /(?<!\*)\*([^*\n]+)\*$/,
    open: "*",
    close: "*",
    tag: "em",
    innerTag: null,
  },
  // Strikethrough
  {
    regex: /~~([^~\n]+)~~$/,
    open: "~~",
    close: "~~",
    tag: "s",
    innerTag: null,
  },
  // Inline code
  {
    regex: /`([^\`\n]+)`$/,
    open: "`",
    close: "`",
    tag: "code",
    innerTag: null,
  },
];

function checkAndRenderInlinePattern() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;

  const range = sel.getRangeAt(0);
  const anchorNode = range.startContainer;
  const anchorOffset = range.startOffset;

  if (anchorNode.nodeType !== Node.TEXT_NODE) return;

  // Skip if inside an already-formatted inline element or wiki ink
  const parentTag = anchorNode.parentElement?.tagName?.toLowerCase();
  const parentClass = anchorNode.parentElement?.className || "";
  if (["strong", "em", "s", "code"].includes(parentTag)) return;
  if (parentClass.includes("wiki-link") || parentClass.includes("md-syntax"))
    return;

  const textUpToCursor = anchorNode.textContent.slice(0, anchorOffset);

  for (const pattern of INLINE_PATTERNS) {
    const match = textUpToCursor.match(pattern.regex);
    if (!match) continue;

    const fullMatch = match[0];
    const content = match[1];
    const matchStart = anchorOffset - fullMatch.length;
    const afterText = anchorNode.textContent.slice(anchorOffset);

    // Build the formatted element
    const el = document.createElement(pattern.tag);

    const openSpan = document.createElement("span");
    openSpan.className = "md-syntax";
    openSpan.setAttribute("contenteditable", "false");
    openSpan.textContent = pattern.open;

    const closeSpan = document.createElement("span");
    closeSpan.className = "md-syntax";
    closeSpan.setAttribute("contenteditable", "false");
    closeSpan.textContent = pattern.close;

    el.appendChild(openSpan);

    if (pattern.innerTag) {
      const inner = document.createElement(pattern.innerTag);
      inner.textContent = content;
      el.appendChild(inner);
    } else {
      el.appendChild(document.createTextNode(content));
    }

    el.appendChild(closeSpan);

    // Build replacement nodes
    const frag = document.createDocumentFragment();
    if (matchStart > 0) {
      frag.appendChild(
        document.createTextNode(anchorNode.textContent.slice(0, matchStart)),
      );
    }
    frag.appendChild(el);
    const afterNode = document.createTextNode(afterText);
    frag.appendChild(afterNode);

    anchorNode.parentNode.replaceChild(frag, anchorNode);

    // Place cursor at start of afterNode (right after the formatted element)
    try {
      const newRange = document.createRange();
      newRange.setStart(afterNode, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } catch (e) {}

    return; // Only process one pattern per input event
  }
}

//  Cursor-line tracking for Obsidian-style marker visibility

function updateCursorLine() {
  if (props.isReadOnly) return;
  if (!editorRef.value) return;

  // Remove cursor-line from all current blocks
  editorRef.value
    .querySelectorAll(".cursor-line")
    .forEach((el) => el.classList.remove("cursor-line"));

  const sel = window.getSelection();
  if (!sel?.rangeCount) return;

  // Only track if selection is inside this editor
  if (!editorRef.value.contains(sel.getRangeAt(0).startContainer)) return;

  let el = sel.getRangeAt(0).startContainer;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;

  while (el && el !== editorRef.value) {
    const t = el.tagName?.toLowerCase();
    if (["p", "h1", "h2", "h3", "blockquote", "li", "div"].includes(t)) {
      el.classList.add("cursor-line");
      return;
    }
    el = el.parentElement;
  }
}

function handleSelectionChange() {
  if (props.isReadOnly) {
    return;
  }
  if (!editorRef.value) return;
  const sel = window.getSelection();
  if (
    sel?.rangeCount &&
    editorRef.value.contains(sel.getRangeAt(0).startContainer)
  ) {
    updateCursorLine();
  } else {
    // Cursor left the editor clear highlights
    editorRef.value
      .querySelectorAll(".cursor-line")
      .forEach((el) => el.classList.remove("cursor-line"));
  }
}

onMounted(() => {
  document.addEventListener("selectionchange", handleSelectionChange);
});

onUnmounted(() => {
  document.removeEventListener("selectionchange", handleSelectionChange);
});

// Tag autocomplete
const tagOpen = ref(false);
const tagPos = ref({ top: 0, left: 0 });
const tagResults = ref([]);
const tagSelectedIdx = ref(0);

function checkTagAutocomplete() {
  if (props.isReadOnly) {
    closeTagAutocomplete();
    return;
  }
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    closeTagAutocomplete();
    return;
  }
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) {
    closeTagAutocomplete();
    return;
  }

  const textBefore = container.textContent.slice(0, range.startOffset);
  const match = textBefore.match(/#([a-zA-Z0-9]*)$/);
  if (!match) {
    closeTagAutocomplete();
    return;
  }

  const term = match[1].toLowerCase();
  const results = globalTags
    .map((t) => t.name)
    .filter((name) => name.includes(term))
    .slice(0, 8);

  if (results.length === 0) {
    closeTagAutocomplete();
    return;
  }

  tagResults.value = results;
  tagSelectedIdx.value = 0;
  tagOpen.value = true;
  const rect = range.getBoundingClientRect();
  tagPos.value = { top: rect.bottom + 4, left: rect.left };
}

function closeTagAutocomplete() {
  tagOpen.value = false;
  tagResults.value = [];
}

function selectTag(tagName) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) return;

  const textBefore = container.textContent.slice(0, range.startOffset);
  const match = textBefore.match(/#([a-zA-Z0-9]*)$/);
  if (!match) return;

  const deleteRange = document.createRange();
  deleteRange.setStart(container, range.startOffset - match[0].length);
  deleteRange.setEnd(container, range.startOffset);
  deleteRange.deleteContents();

  const span = document.createElement("span");
  span.className = "tag-link";
  span.setAttribute("contenteditable", "false");
  span.setAttribute("data-tag", tagName);
  span.textContent = `#${tagName}`;
  deleteRange.insertNode(span);

  const spaceNode = document.createTextNode(" ");
  span.parentNode.insertBefore(spaceNode, span.nextSibling);

  const newRange = document.createRange();
  newRange.setStart(spaceNode, 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  closeTagAutocomplete();
  handleInput();
}

// Tag DOM rendering
function renderTagsInDOM() {
  if (!editorRef.value) return;

  const sel = window.getSelection();
  const anchorNode = sel?.anchorNode;
  const anchorOffset = sel?.anchorOffset ?? 0;

  const walker = document.createTreeWalker(
    editorRef.value,
    NodeFilter.SHOW_TEXT,
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    const parent = n.parentElement;
    // Skip this node only if the cursor is mid-word inside a #tag so still typing
    if (
      n === anchorNode &&
      /#[a-zA-Z0-9]*$/.test(n.textContent.slice(0, anchorOffset))
    )
      continue;
    if (
      !parent?.classList.contains("tag-link") &&
      !parent?.classList.contains("wiki-link") &&
      !parent?.classList.contains("md-syntax") &&
      /#([a-zA-Z0-9]{1,30})/.test(n.textContent)
    ) {
      nodes.push(n);
    }
  }
  if (!nodes.length) return;

  let restoreTo = null;

  for (const textNode of nodes) {
    const text = textNode.textContent;
    const regex = /#([a-zA-Z0-9]{1,30})/g;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    let lastInserted = null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        const t = document.createTextNode(text.slice(last, match.index));
        frag.appendChild(t);
        if (
          textNode === anchorNode &&
          anchorOffset >= last &&
          anchorOffset <= match.index
        ) {
          restoreTo = { node: t, offset: anchorOffset - last };
        }
        lastInserted = t;
      }
      const span = document.createElement("span");
      span.className = "tag-link";
      span.setAttribute("contenteditable", "false");
      span.setAttribute("data-tag", match[1]);
      span.textContent = `#${match[1]}`;
      frag.appendChild(span);
      lastInserted = span;
      last = regex.lastIndex;
    }

    if (last < text.length) {
      const t = document.createTextNode(text.slice(last));
      frag.appendChild(t);
      if (textNode === anchorNode && anchorOffset >= last && !restoreTo) {
        restoreTo = {
          node: t,
          offset: Math.min(anchorOffset - last, t.textContent.length),
        };
      }
      lastInserted = t;
    }

    if (textNode === anchorNode && !restoreTo && lastInserted) {
      if (lastInserted.nodeType === Node.TEXT_NODE) {
        restoreTo = {
          node: lastInserted,
          offset: lastInserted.textContent.length,
        };
      } else {
        restoreTo = { afterNode: lastInserted };
      }
    }

    textNode.parentNode.replaceChild(frag, textNode);
  }

  if (sel && restoreTo) {
    try {
      const range = document.createRange();
      if (restoreTo.afterNode) {
        range.setStartAfter(restoreTo.afterNode);
      } else {
        range.setStart(restoreTo.node, restoreTo.offset);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      /* best-effort */
    }
  }
}

// Wiki-link autocomplete
const wikiOpen = ref(false);
const wikiPos = ref({ top: 0, left: 0 });
const wikiResults = ref([]);
const wikiSelectedIdx = ref(0);

function checkWikiAutocomplete() {
  if (props.isReadOnly) {
    closeWikiAutocomplete();
    return;
  }
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    closeWikiAutocomplete();
    return;
  }
  const range = sel.getRangeAt(0);
  const container = range.startContainer;

  // Build the text before the cursor. When cursor is in an element node (e.g. right after a contenteditable=false span), aggregate preceding text nodes.
  let textBefore = "";
  if (container.nodeType === Node.TEXT_NODE) {
    textBefore = container.textContent.slice(0, range.startOffset);
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    for (let i = 0; i < range.startOffset; i++) {
      const child = container.childNodes[i];
      if (child?.nodeType === Node.TEXT_NODE) textBefore += child.textContent;
    }
  } else {
    closeWikiAutocomplete();
    return;
  }

  const match = textBefore.match(/\[\[([^\]]*)$/);
  if (!match) {
    closeWikiAutocomplete();
    return;
  }

  const term = match[1].toLowerCase();
  const results = state.items
    .filter(
      (i) =>
        i.type === "file" &&
        i.id !== props.file?.id &&
        i.name.toLowerCase().includes(term),
    )
    .slice(0, 8);
  if (results.length === 0) {
    closeWikiAutocomplete();
    return;
  }

  wikiResults.value = results;
  wikiSelectedIdx.value = 0;
  wikiOpen.value = true;
  const rect = range.getBoundingClientRect();
  wikiPos.value = { top: rect.bottom + 4, left: rect.left };
}

function closeWikiAutocomplete() {
  wikiOpen.value = false;
  wikiResults.value = [];
}

function selectWikiNote(note) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) return;

  const textBefore = container.textContent.slice(0, range.startOffset);
  const match = textBefore.match(/\[\[([^\]]*)$/);
  if (!match) return;

  // Delete [[partial text
  const deleteRange = document.createRange();
  deleteRange.setStart(container, range.startOffset - match[0].length);
  deleteRange.setEnd(container, range.startOffset);
  deleteRange.deleteContents();

  // Insert wiki-link span
  const span = document.createElement("span");
  span.className = "wiki-link";
  span.setAttribute("contenteditable", "false");
  span.setAttribute("data-name", note.name);
  span.textContent = note.name;
  deleteRange.insertNode(span);

  // Place cursor right after the span
  const newRange = document.createRange();
  newRange.setStartAfter(span);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  closeWikiAutocomplete();
  handleInput();
}

async function handleWikiLinkClick(e) {
  if (event.target.tagName === "A") {
    const href = event.target.getAttribute("href");
    if (href && href.startsWith("#")) {
      event.preventDefault(); // Prevent default jump

      const targetId = href.slice(1); // Remove the '#'
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        // Scroll smoothly to the element
        targetElement.scrollIntoView({ behavior: "smooth" });
        return;
      } else {
        console.warn(`No element found with id="${targetId}"`);
      }
    }
  }

  const link = e.target.closest("a.md-link");
  if (link) {
    e.preventDefault();
    window.open(link.href, "_blank", "noopener,noreferrer");
    return;
  }
  if (e.target.classList.contains("wiki-link")) {
    const noteName = e.target.dataset.name;
    const item = state.items.find(
      (i) => i.type === "file" && i.name === noteName,
    );
    if (item && item.id !== props.file?.id) {
      setActiveFile(item.id);
    } else {
      // Note doesn't exist so create it, then immediately sync the link
      await createFile(null, noteName);
      if (props.file?.id) {
        const markdown = htmlToContent(editorRef.value?.innerHTML || "");
        syncNoteLinks(props.file.id, markdown).catch((err) => {
          console.warn(
            "Failed to sync links after note creation:",
            err.message,
          );
        });
      }
    }
  } else if (e.target.classList.contains("tag-link")) {
    emit("tag-click", e.target.dataset.tag);
  }
}

function handleEditorBlur() {
  setTimeout(() => {
    closeWikiAutocomplete();
    closeTagAutocomplete();
  }, 150);
}

function applyFormat(command) {
  if (props.isReadOnly) {
    return;
  }
  editorRef.value?.focus();

  if (command === "h1") {
    document.execCommand("formatBlock", false, "h1");
    ensureMdSyntaxInHeadings();
  } else if (command === "h2") {
    document.execCommand("formatBlock", false, "h2");
    ensureMdSyntaxInHeadings();
  } else if (command === "h3") {
    document.execCommand("formatBlock", false, "h3");
    ensureMdSyntaxInHeadings();
  } else if (command === "code") {
    // Wrap selection in <code>
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const code = document.createElement("code");
      range.surroundContents(code);
    }
  } else if (command === "blockquote") {
    document.execCommand("formatBlock", false, "blockquote");
  } else if (command === "checklist") {
    const html =
      '<div class="checklist-item"><input type="checkbox" />Checklist item</div>';
    document.execCommand("insertHTML", false, html);
  } else if (command === "table") {
    const tableHtml = `<table><tr><th>Header</th><th>Header</th></tr><tr><td>Cell</td><td>Cell</td></tr></table>`;
    document.execCommand("insertHTML", false, tableHtml);
  } else if (command === "createLink") {
    const raw = prompt("Enter URL:");
    if (raw) {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const sel = window.getSelection();
      const label = sel?.toString() || raw;
      const linkHtml = `<a href="${url}" class="md-link" target="_blank" rel="noopener noreferrer" title="${url}">${label}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    }
  } else {
    document.execCommand(command, false, null);
  }

  // Sync content after formatting
  handleInput();
}

function ensureMdSyntaxInHeadings() {
  if (!editorRef.value) return;
  const headings = editorRef.value.querySelectorAll("h1, h2, h3");
  for (const h of headings) {
    if (!h.querySelector(":scope > .md-syntax")) {
      const level = parseInt(h.tagName[1]);
      const marker = "#".repeat(level) + " ";
      const span = document.createElement("span");
      span.className = "md-syntax";
      span.setAttribute("contenteditable", "false");
      span.textContent = marker;
      h.insertBefore(span, h.firstChild);
    }
  }
}
defineExpose({ applyFormat, editorRef });
</script>

<style scoped>
.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.note-header {
  padding: 24px 32px 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.note-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition:
    background 0.12s,
    color 0.12s;
}
.note-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--label-to);
}
.note-title {
  flex: 1;
  font-size: 28px;
  font-weight: 600;
  color: var(--text);
  background: none;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
}
.note-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.editor-area {
  flex: 1;
  padding: 20px 32px;
  overflow-y: auto;
  outline: none;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text);
  caret-color: var(--label-to);
}
.editor-area::-webkit-scrollbar {
  width: 6px;
}
.editor-area::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

/* WYSIWYG content styles */
.editor-area :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 16px 0 8px;
  color: var(--text);
}
.editor-area :deep(h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 14px 0 6px;
  color: var(--text);
}
.editor-area :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0 4px;
  color: var(--text);
}
.editor-area :deep(p) {
  margin: 0 0 4px;
}
.editor-area :deep(blockquote) {
  border-left: 3px solid var(--label-to);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--text-dim);
}
.editor-area :deep(pre) {
  background: var(--surface-hover);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  overflow-x: scroll;
}
.editor-area :deep(code) {
  background: var(--surface-hover);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
}
.editor-area :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}
.editor-area :deep(ul),
.editor-area :deep(ol) {
  padding-left: 24px;
  margin: 4px 0;
}
.editor-area :deep(li) {
  margin: 2px 0;
}
.editor-area :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}
.editor-area :deep(th),
.editor-area :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.editor-area :deep(th) {
  background: var(--surface-hover);
  font-weight: 600;
}
.editor-area :deep(a) {
  color: var(--label-to);
  text-decoration: underline;
}
.editor-area :deep(.checklist-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.editor-area :deep(.checklist-item input[type="checkbox"]) {
  accent-color: var(--label-to);
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
}
.empty-state p {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  margin: 8px 0 0;
}
.empty-state .sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  max-width: 320px;
  text-align: center;
  margin: 0;
}
.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: var(--label-to);
  color: var(--bg);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.create-btn:hover {
  opacity: 0.85;
}

/* Markdown syntax markers hidden by default, shown only on the cursor's line */
.editor-area :deep(.md-syntax) {
  display: none;
  color: var(--text-muted);
  font-weight: inherit;
  font-style: normal;
}
.editor-area :deep(.cursor-line .md-syntax) {
  display: inline;
  opacity: 0.55;
}

/* Inline formatting styles */
.editor-area :deep(strong) {
  font-weight: 700;
  color: var(--text);
}
.editor-area :deep(em) {
  font-style: italic;
  color: var(--text);
}
.editor-area :deep(s) {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* Tags in editor */
.editor-area :deep(.tag-link) {
  color: var(--tag-color);
  background: var(--tag-bg);
  border-radius: 3px;
  padding: 1px 4px;
  font-weight: 500;
  cursor: pointer;
  transition:
    box-shadow 0.2s,
    background 0.2s;
}
.editor-area :deep(.tag-link:hover) {
  box-shadow: 0 0 6px 2px color-mix(in srgb, var(--tag-color) 60%, transparent);
  background: color-mix(in srgb, var(--tag-bg) 80%, var(--tag-color) 20%);
}

/* Tag autocomplete dropdown */
.tag-autocomplete {
  position: fixed;
  z-index: 9999;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  max-width: 260px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.tag-ac-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  border-radius: 5px;
  border: none;
  background: none;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    background 0.1s,
    color 0.1s;
}
.tag-ac-item:hover,
.tag-ac-item.selected {
  background: var(--surface-hover);
  color: var(--text);
}

/* Wiki links in editor */
.editor-area :deep(.wiki-link) {
  color: var(--label-to);
  background: color-mix(in srgb, var(--label-to) 12%, transparent);
  border-radius: 3px;
  padding: 1px 4px;
  cursor: pointer;
  font-weight: 500;
}
.editor-area :deep(.wiki-link:hover) {
  background: color-mix(in srgb, var(--label-to) 22%, transparent);
  text-decoration: underline;
}

/* Hyperlinks in editor */
.editor-area :deep(a.md-link) {
  color: var(--label-to);
  text-decoration: underline;
  cursor: pointer;
}
.editor-area :deep(a.md-link:hover) {
  opacity: 0.8;
}

/* Wiki-link autocomplete dropdown */
.wiki-autocomplete {
  position: fixed;
  z-index: 9999;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.wiki-ac-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 5px;
  border: none;
  background: none;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    background 0.1s,
    color 0.1s;
}
.wiki-ac-item:hover,
.wiki-ac-item.selected {
  background: var(--surface-hover);
  color: var(--text);
}
</style>
