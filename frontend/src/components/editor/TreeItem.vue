<template>
  <div>
    <div
      class="tree-item"
      :class="{
        active: item.type === 'file' && item.id === activeId,
        'drop-target': isDragOver,
      }"
      :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
      draggable="true"
      @click="handleClick"
      @dblclick="startRename"
      @dragstart.stop="onDragStart"
      @dragend="onDragEnd"
      @dragover.prevent.stop="onDragOver"
      @dragleave="onDragLeave"
      @drop.stop="onDrop"
    >
      <!-- Folder toggle chevron -->
      <ChevronRight
        v-if="item.type === 'folder'"
        class="w-3 h-3 toggle-icon"
        :class="{ rotated: expanded }"
      />
      <span v-else class="w-3 h-3 inline-block shrink-0" />
      <!-- Icon whic clickable on files to open picker -->
      <button
        v-if="item.type === 'file'"
        class="icon-btn"
        :title="'Change icon'"
        @click.stop="openPicker"
      >
        <component :is="fileIcon" class="w-4 h-4" />
      </button>
      <component v-else :is="folderIcon" class="w-4 h-4 item-icon shrink-0" />

      <!-- Name and rename input -->
      <input
        v-if="isRenaming"
        ref="renameInput"
        v-model="renamingName"
        class="rename-input"
        @blur="finishRename"
        @keydown.enter="finishRename"
        @keydown.escape="cancelRename"
        @click.stop
      />
      <span v-else class="item-name">{{ item.name }}</span>

      <button
        class="dl-btn"
        :title="
          item.type === 'folder' ? 'Export as ZIP' : 'Download as Markdown'
        "
        @click.stop="handleDownload"
      >
        <Download class="w-3 h-3" />
      </button>
      <button
        class="delete-btn"
        title="Delete"
        @click.stop="$emit('delete', item.id)"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>

    <!-- Icon picker (teleported to body to avoid clipping) -->
    <Teleport to="body">
      <IconPicker
        v-if="pickerOpen"
        :current="item.icon || 'FileText'"
        :position="pickerPos"
        @select="handleIconSelect"
        @close="pickerOpen = false"
      />
    </Teleport>

    <!-- Children (if folder is expanded) -->
    <template v-if="item.type === 'folder' && expanded">
      <TreeItem
        v-for="child in children"
        :key="child.id"
        :item="child"
        :active-id="activeId"
        :get-children="getChildren"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
        @rename="(id, name, type) => $emit('rename', id, name, type)"
        @move="(id, type, targetId) => $emit('move', id, type, targetId)"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
  Download,
} from "lucide-vue-next";
import { resolveIcon } from "./iconMap.js";
import { useEditorStore } from "../../composables/useEditorStore.js";
import IconPicker from "./IconPicker.vue";
import { exportFolderAsZip, exportNoteAsMd } from "../../services/api.js";

const props = defineProps({
  item: { type: Object, required: true },
  activeId: { type: String, default: null },
  getChildren: { type: Function, required: true },
  depth: { type: Number, default: 0 },
});

const emit = defineEmits(["select", "delete", "rename", "move"]);

const { updateItemIcon } = useEditorStore();

const expanded = ref(true);
const isRenaming = ref(false);
const renamingName = ref("");
const renameInput = ref(null);
const pickerOpen = ref(false);
const pickerPos = ref({ top: 0, left: 0 });
const isDragOver = ref(false);

const children = computed(() => props.getChildren(props.item.id));

const fileIcon = computed(() => resolveIcon(props.item.icon || "FileText"));
const folderIcon = computed(() => (expanded.value ? FolderOpen : Folder));

function handleClick() {
  if (props.item.type === "folder") {
    expanded.value = !expanded.value;
  } else {
    emit("select", props.item.id);
  }
}

function openPicker(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  pickerPos.value = {
    top: rect.bottom + 4,
    left: Math.min(rect.left, window.innerWidth - 270),
  };
  pickerOpen.value = true;
}

function handleIconSelect(iconName) {
  updateItemIcon(props.item.id, iconName);
}

function startRename() {
  isRenaming.value = true;
  renamingName.value = props.item.name;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function finishRename() {
  if (isRenaming.value && renamingName.value.trim()) {
    emit("rename", props.item.id, renamingName.value.trim(), props.item.type);
  }
  isRenaming.value = false;
}

function cancelRename() {
  isRenaming.value = false;
}

async function handleDownload() {
  if (props.item.type === "folder") {
    await exportFolderAsZip(props.item.id, props.item.name);
  } else {
    await exportNoteAsMd(props.item.id, props.item.name);
  }
}

function onDragStart(e) {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(props.item.id));
  e.dataTransfer.setData("text/itemtype", props.item.type);
}

function onDragEnd() {
  isDragOver.value = false;
}

function onDragOver() {
  // Only folders are valid drop targets
  if (props.item.type === "folder") {
    isDragOver.value = true;
    // Auto-expand folder on hover so user can drop into nested folders
    expanded.value = true;
  }
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e) {
  isDragOver.value = false;
  if (props.item.type !== "folder") return;
  const draggedId = e.dataTransfer.getData("text/plain");
  const draggedType = e.dataTransfer.getData("text/itemtype");
  if (!draggedId || !draggedType) return;
  if (draggedType === "folder" && draggedId === String(props.item.id)) return;
  emit("move", draggedId, draggedType, props.item.id);
}
</script>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-dim);
  transition:
    background 0.12s,
    color 0.12s;
  position: relative;
}
.tree-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.tree-item.active {
  background: color-mix(in srgb, var(--label-to) 20%, transparent);
  color: var(--text);
}
.tree-item.drop-target {
  background: color-mix(in srgb, var(--label-to) 25%, transparent);
  outline: 1px dashed var(--label-to);
  outline-offset: -1px;
}
.toggle-icon {
  flex-shrink: 0;
  transition: transform 0.15s;
}
.toggle-icon.rotated {
  transform: rotate(90deg);
}
/* Clickable icon button for files */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition:
    background 0.1s,
    color 0.1s;
}
.icon-btn:hover {
  background: var(--border);
  color: var(--label-to);
}
.tree-item.active .icon-btn {
  color: var(--label-to);
}
.item-icon {
  color: var(--text-muted);
}
.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rename-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--label-to);
  border-radius: 3px;
  color: var(--text);
  font-size: 13px;
  padding: 1px 4px;
  outline: none;
}
.dl-btn {
  display: none;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
}
.dl-btn:hover {
  color: var(--label-to);
  background: color-mix(in srgb, var(--label-to) 10%, transparent);
}
.tree-item:hover .dl-btn {
  display: flex;
}
.delete-btn {
  display: none;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
}
.delete-btn:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
.tree-item:hover .delete-btn {
  display: flex;
}
</style>
