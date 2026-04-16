<template>
  <div class="editor-layout">
    <!-- Icon Strip -->
    <EditorIconStrip
      :active-view="sidebarView"
      @set-view="sidebarView = $event"
    />

    <!-- Left panel (sidebar or tag panel) -->
    <div class="left-panel" :class="{ collapsed: sidebarCollapsed }">
      <EditorSidebar
        v-if="sidebarView === 'files'"
        :items="rootItems"
        :active-file-id="activeFile?.id"
        :file-count="fileCount"
        :collapsed="sidebarCollapsed"
        :get-children="getChildren"
        :search-items="searchItems"
        :search-by-tag="searchByTag"
        :tag-query="tagQuery"
        @tag-query-consumed="tagQuery = ''"
        @create-file="handleCreateFile"
        @create-folder="createFolder()"
        @select-file="setActiveFile"
        @delete-item="deleteItem"
        @rename-item="renameItem"
        @move-item="moveItem"
      />
      <EditorTagPanel v-else-if="sidebarView === 'tags'" />
      <EditorAssetsPanel v-else-if="sidebarView === 'assets'" />
    </div>

    <!-- Main editor area -->
    <div class="editor-main">
      <!-- Top bar with view mode toggles -->
      <div class="editor-topbar">
        <div class="topbar-left">
          <button
            class="topbar-btn"
            title="Toggle sidebar"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <PanelLeftClose v-if="!sidebarCollapsed" class="w-4 h-4" />
            <PanelLeftOpen v-else class="w-4 h-4" />
          </button>
          <span v-if="activeFile" class="breadcrumb">
            <FileText class="w-3.5 h-3.5" />
            {{ activeFile.name }}
          </span>
        </div>

        <div class="topbar-right">
          <!-- Single edit/preview toggle -->
          <button
            class="mode-toggle"
            @click="toggleViewMode"
            :title="
              viewMode === 'preview' ? 'Switch to Edit' : 'Switch to Preview'
            "
          >
            <Pencil v-if="viewMode === 'preview'" class="w-3.5 h-3.5" />
            <Eye v-else class="w-3.5 h-3.5" />
            {{ viewMode === "preview" ? "Edit" : "Preview" }}
          </button>

          <!-- Options menu -->
          <div class="relative" ref="menuRef">
            <button
              class="topbar-btn"
              title="Options"
              @click="menuOpen = !menuOpen"
            >
              <MoreHorizontal class="w-4 h-4" />
            </button>
            <div v-if="menuOpen" class="options-menu">
              <button class="menu-item" @click="toggleToolbar">
                <component
                  :is="toolbarVisible ? EyeOff : Eye"
                  class="w-4 h-4"
                />
                {{ toolbarVisible ? "Hide Toolbar" : "Show Toolbar" }}
              </button>
              <button class="menu-item" @click="toggleSplitViewMode()">
                <Columns2 class="w-4 h-4" />
                {{ viewMode !== "split" ? "Split View" : "Inline" }}
              </button>
              <template v-if="activeFile">
                <div class="menu-divider" />
                <button class="menu-item" @click="handleExportMd">
                  <Download class="w-4 h-4" />
                  Export as Markdown
                </button>
                <button class="menu-item" @click="handleExportHtml">
                  <Download class="w-4 h-4" />
                  Export as HTML
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Toolbar (shown in edit/split modes) -->
      <EditorToolbar
        :visible="toolbarVisible && viewMode !== 'preview'"
        @format="handleFormat"
      />

      <!-- Content area -->
      <div class="content-area">
        <!-- Editor label in split mode -->
        <div v-if="viewMode === 'split'" class="pane-labels">
          <div class="pane-label editor-pane-label">EDITOR</div>
          <div class="pane-label preview-pane-label">PREVIEW</div>
        </div>

        <div class="panes" :class="viewMode">
          <EditorContent
            v-if="viewMode !== 'preview'"
            ref="editorContentRef"
            :file="activeFile"
            :livePreview="viewMode !== 'split'"
            :isReadOnly="false"
            readOnlyContent=""
            @update="handleContentUpdate"
            @rename="renameItem"
            @create-first="handleCreateFile"
            @scroll="onEditorScroll"
            @tag-click="
              (tag) => {
                sidebarView = 'files';
                tagQuery = 'tag:' + tag;
              }
            "
          />

          <EditorContent
            v-if="viewMode === 'split' || viewMode === 'preview'"
            ref="editorPreviewContentRef"
            :file="activeFile"
            :livePreview="true"
            :isReadOnly="true"
            :readOnlyContent="editorPreviewContent"
            @tag-click="
              (tag) => {
                sidebarView = 'files';
                tagQuery = 'tag:' + tag;
              }
            "
          />

          <!-- Empty state when no file and in preview mode -->
          <div v-if="viewMode === 'preview' && !activeFile" class="empty-state">
            <Eye class="w-12 h-12 text-[var(--text-muted)]" />
            <p class="text-lg font-semibold mt-3">Nothing to preview</p>
            <p class="text-sm text-[var(--text-muted)]">
              Select a note to see its preview
            </p>
          </div>
        </div>
      </div>

      <!-- Bottom status bar -->
      <div class="status-bar">
        <span class="status-stat">{{ contentStats.words }} words</span>
        <span class="status-sep">·</span>
        <span class="status-stat">{{ contentStats.chars }} chars</span>
        <span class="status-sep">·</span>
        <span class="status-stat">{{ contentStats.lines }} lines</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Pencil,
  Columns2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
} from "lucide-vue-next";
import { useEditorStore } from "../../composables/useEditorStore";
import EditorIconStrip from "./EditorIconStrip.vue";
import EditorSidebar from "./EditorSidebar.vue";
import EditorToolbar from "./EditorToolbar.vue";
import EditorContent from "./EditorContent.vue";
import EditorPreview from "./EditorPreview.vue";
import EditorTagPanel from "./EditorTagPanel.vue";
import EditorAssetsPanel from "./EditorAssetsPanel.vue";
import { exportNoteAsMd, exportNoteAsHtml } from "../../services/api.js";

const {
  activeFile,
  rootItems,
  fileCount,
  getChildren,
  setActiveFile,
  createFile,
  createFolder,
  updateFileContent,
  renameItem,
  deleteItem,
  moveItem,
  searchItems,
  searchByTag,
} = useEditorStore();

const contentStats = computed(() => {
  const text = activeFile.value?.content || "";
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  const lines = text === "" ? 0 : text.split("\n").length;
  return { words, chars, lines };
});

const viewMode = ref("edit");
const doUpdateView = ref(0);
const sidebarCollapsed = ref(false);
const sidebarView = ref("files");
const tagQuery = ref("");
const toolbarVisible = ref(true);
const menuOpen = ref(false);
const menuRef = ref(null);
const editorContentRef = ref(null);
const editorPreviewContentRef = ref(null);
const editorPreviewContent = ref("");

function onEditorScroll(payload) {
  const preview = editorPreviewContentRef.value;
  if (!preview) return;

  const { scrollTop, scrollHeight, clientHeight } = payload;

  preview.editorRef.scrollTop = scrollTop;
}
async function handleCreateFile() {
  try {
    await createFile();
  } catch (err) {
    console.error("Failed to create note:", err);
  }
}

function handleContentUpdate(content) {
  editorPreviewContent.value = content;
  if (activeFile.value) {
    updateFileContent(activeFile.value.id, content);
  }
}

function handleFormat(command) {
  editorContentRef.value?.applyFormat(command);
}

function toggleViewMode() {
  viewMode.value = viewMode.value === "preview" ? "edit" : "preview";
}

function toggleSplitViewMode() {
  viewMode.value = viewMode.value === "split" ? "edit" : "split";
  menuOpen.value = false;
}

function toggleToolbar() {
  toolbarVisible.value = !toolbarVisible.value;
  menuOpen.value = false;
}

async function handleExportMd() {
  menuOpen.value = false;
  if (!activeFile.value) return;
  await exportNoteAsMd(activeFile.value.id, activeFile.value.name);
}

async function handleExportHtml() {
  menuOpen.value = false;
  if (!activeFile.value) return;
  await exportNoteAsHtml(activeFile.value.id, activeFile.value.name);
}

function handleClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    menuOpen.value = false;
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));
</script>

<style scoped>
.editor-layout {
  display: flex;
  height: 100vh;
  background: var(--bg);
  overflow: hidden;
}

.left-panel {
  display: flex;
  overflow: hidden;
  transition:
    width 0.2s,
    min-width 0.2s;
}
.left-panel.collapsed {
  width: 0;
  min-width: 0;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* Top bar */
.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.topbar-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.topbar-btn.active {
  color: var(--tag-color);
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-dim);
}

/* Single view mode toggle */
.mode-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-toggle:hover {
  background: var(--surface-hover);
  color: var(--text);
}

/* Options menu */
.options-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  min-width: 180px;
  z-index: 50;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  text-align: left;
}
.menu-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* Content area */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-labels {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.pane-label {
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}
.editor-pane-label {
  flex: 1;
}
.preview-pane-label {
  flex: 1;
  border-left: 1px solid var(--border);
}
.panes {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.panes.split > * {
  flex: 1;
  min-width: 0;
}
.panes.preview {
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* Status bar */
.status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 28px;
  min-height: 28px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-size: 11px;
  color: var(--text-muted);
}
.status-sep {
  opacity: 0.4;
}
.status-right {
  margin-left: auto;
}
.status-online {
  display: flex;
  align-items: center;
  gap: 5px;
}
.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 4px #4ade80;
  flex-shrink: 0;
}
</style>
