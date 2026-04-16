import { reactive, computed } from "vue";
import {
  apiCreateFolder,
  apiGetFolders,
  apiMoveNote,
  apiMoveFolder,
  apiRenameFolder,
  indexNote,
  deleteNoteIndex,
  fetchNotes,
  fetchNote,
  createNote,
  updateNote,
  linkNotes,
  deleteNote,
  getNoteLinks,
  deleteNoteLinks,
  fetchTags,
  fetchNoteTags,
  syncNoteTags,
  createTag,
} from "../services/api.js";

let indexDebounceTimer = null;
const INDEX_DEBOUNCE_MS = 1000;

function debouncedIndexNote(id, name, content) {
  if (indexDebounceTimer) clearTimeout(indexDebounceTimer);
  indexDebounceTimer = setTimeout(() => {
    indexNote(id, { title: name, content }).catch((err) => {
      console.warn("Failed to index note:", err.message);
    });
  }, INDEX_DEBOUNCE_MS);
}

let saveDebounceTimer = null;

function debouncedSaveNote(id, title, content) {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    updateNote(id, title, content).catch((err) => {
      console.warn("Failed to save note:", err.message);
    });
    syncNoteLinks(id, content).catch((err) => {
      console.warn("Failed to sync note links:", err.message);
    });
    syncContentTags(id, content).catch((err) => {
      console.warn("Failed to sync note tags:", err.message);
    });
  }, INDEX_DEBOUNCE_MS);
}

function noteToItem(note) {
  return {
    id: note.id,
    name: note.title,
    content: note.content ?? null,
    parentId: note.folder_id ?? null,
    type: "file",
    icon: note.icon ?? "FileText",
    updatedAt: note.updated_at,
    lastVisitedAt: null,
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const state = reactive({ items: [], activeFileId: null, loading: true });

const noteLinkCache = reactive({});
const noteTagCache = reactive({});
const contentTagCache = reactive({});
const panelTagCache = reactive({});
const globalTags = reactive([]);

function parseContentTags(content) {
  const tagRegex = /#([a-zA-Z0-9]+)/g;
  const found = new Set();
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    if (match[1].length <= 30) found.add(match[1].toLowerCase());
  }
  return [...found];
}

function rebuildNoteTagCache(noteId) {
  const union = new Set([
    ...(contentTagCache[noteId] ?? []),
    ...(panelTagCache[noteId] ?? []),
  ]);
  noteTagCache[noteId] = [...union];
}

async function syncContentTags(noteId, content) {
  const allContentTags = parseContentTags(content);
  const existingNames = new Set(globalTags.map((t) => t.name));
  contentTagCache[noteId] = allContentTags.filter((t) => existingNames.has(t));
  rebuildNoteTagCache(noteId);
  const { tags: saved } = await syncNoteTags(noteId, noteTagCache[noteId]);
  noteTagCache[noteId] = saved.map((t) => t.name);
}

async function ensureGlobalTag(name) {
  if (!/^[a-zA-Z0-9]{1,30}$/.test(name)) return;
  if (globalTags.find((t) => t.name === name)) return;
  try {
    const result = await createTag(name);
    globalTags.push({ id: result.id, name, note_count: 0 });
  } catch {
    /* ignore tag may have been created concurrently */
  }
}

async function syncNoteLinks(noteId, content) {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const linkedNames = new Set();
  let match;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    linkedNames.add(match[1].trim());
  }

  const newLinkedIds = [];
  for (const name of linkedNames) {
    const item = state.items.find(
      (i) =>
        i.type === "file" &&
        i.name.toLowerCase() === name.toLowerCase() &&
        i.id !== noteId,
    );
    if (item) newLinkedIds.push(item.id);
  }
  const newLinkedSet = new Set(newLinkedIds);

  const current = noteLinkCache[noteId];
  const currentOutbound = current ? current.outbound : new Set();

  const toAdd = newLinkedIds.filter((id) => !currentOutbound.has(id));
  const toRemove = [...currentOutbound].filter((id) => !newLinkedSet.has(id));

  if (toAdd.length > 0) {
    await linkNotes({ links: [{ from_id: noteId, to_ids: toAdd }] });
  }
  if (toRemove.length > 0) {
    await deleteNoteLinks({
      links: toRemove.map((id) => ({ from_note_id: noteId, to_note_id: id })),
    });
  }

  if (!noteLinkCache[noteId])
    noteLinkCache[noteId] = { outbound: new Set(), inbound: new Set() };
  noteLinkCache[noteId].outbound = newLinkedSet;
}

export function useEditorStore() {
  /** The currently open file object or null if none is selected. */
  const activeFile = computed(
    () =>
      state.items.find(
        (i) => i.id === state.activeFileId && i.type === "file",
      ) || null,
  );

  function foldersFirst(a, b) {
    if (a.type === b.type) return 0;
    return a.type === "folder" ? -1 : 1;
  }

  /** All top-level items (files and folders with no parent). */
  const rootItems = computed(() =>
    state.items.filter((i) => i.parentId === null).sort(foldersFirst),
  );

  function getChildren(parentId) {
    return state.items
      .filter((i) => i.parentId === parentId)
      .sort(foldersFirst);
  }

  async function setActiveFile(id) {
    const item = state.items.find((i) => i.id === id && i.type === "file");
    if (item) {
      item.lastVisitedAt = new Date().toISOString();
      // Lazyload content on first open
      if (item.content === null) {
        try {
          const note = await fetchNote(id);
          item.content = note.content ?? "";
        } catch (err) {
          console.warn(`Failed to fetch note ${id}:`, err.message);
          item.content = "";
        }
      }
      // set active id only after content is ready so the editor watch fires with real content
      state.activeFileId = id;
      if (panelTagCache[id] === undefined) {
        try {
          const tags = await fetchNoteTags(id);
          const dbTagNames = tags.map((t) => t.name);
          const contentTags = new Set(parseContentTags(item.content ?? ""));
          contentTagCache[id] = [...contentTags];
          panelTagCache[id] = dbTagNames.filter(
            (name) => !contentTags.has(name),
          );
          noteTagCache[id] = dbTagNames;
        } catch {
          contentTagCache[id] = [];
          panelTagCache[id] = [];
          noteTagCache[id] = [];
        }
      }
      // Load note links if not yet cached
      if (!noteLinkCache[id]) {
        try {
          const links = await getNoteLinks(id);
          noteLinkCache[id] = {
            outbound: new Set(
              links
                .filter((l) => l.from_note_id === id)
                .map((l) => l.to_note_id),
            ),
            inbound: new Set(
              links
                .filter((l) => l.to_note_id === id)
                .map((l) => l.from_note_id),
            ),
          };
        } catch (err) {
          console.warn(`Failed to load links for note ${id}:`, err.message);
          noteLinkCache[id] = { outbound: new Set(), inbound: new Set() };
        }
      }
    }
  }

  const recentFiles = computed(() =>
    state.items
      .filter((i) => i.type === "file")
      .slice()
      .sort((a, b) => {
        const ta = a.lastVisitedAt || a.updatedAt || "";
        const tb = b.lastVisitedAt || b.updatedAt || "";
        return tb.localeCompare(ta);
      })
      .slice(0, 8),
  );

  async function createFile(parentId = null, title = "Untitled") {
    const { id } = await createNote(title, "");
    const item = noteToItem({
      id,
      title,
      content: "",
      updated_at: new Date().toISOString(),
    });
    item.parentId = parentId;
    state.items.push(item);
    state.activeFileId = id;
    indexNote(id, { title, content: "" }).catch((err) => {
      console.warn("Failed to index new note:", err.message);
    });
    return id;
  }

  async function importNote(title, content, parentId = null) {
    const { id } = await createNote(title, content);
    const item = {
      id,
      name: title,
      content: content,
      parentId: parentId,
      type: "file",
      icon: "FileText",
      updatedAt: new Date().toISOString(),
      lastVisitedAt: null,
    };
    state.items.push(item);
    state.activeFileId = id;
    indexNote(id, { title, content }).catch((err) => {
      console.warn("Failed to index imported note:", err.message);
    });
    // Register any #hashtags found in imported content as global tags and sync to note
    const contentTags = parseContentTags(content);
    if (contentTags.length) {
      await Promise.all(contentTags.map((t) => ensureGlobalTag(t)));
      const fresh = await fetchTags();
      globalTags.splice(0, globalTags.length, ...fresh);
      await syncContentTags(id, content);
    }
    return id;
  }

  async function createFolder(parentId = null) {
    const res = await apiCreateFolder(parentId, "New Folder");
    const id = res.id;

    state.items.push({
      id,
      name: "New Folder",
      parentId,
      type: "folder",
      updatedAt: new Date().toISOString(),
    });
    return id;
  }

  function updateFileContent(id, content) {
    const item = state.items.find((i) => i.id === id);
    if (item && item.type === "file") {
      item.content = content;
      item.updatedAt = new Date().toISOString();
      debouncedSaveNote(id, item.name, content);
      debouncedIndexNote(id, item.name, content);
    }
  }

  function updateItemIcon(id, iconName) {
    const item = state.items.find((i) => i.id === id);
    if (item) {
      item.icon = iconName;
      item.updatedAt = new Date().toISOString();
    }
  }

  function renameItem(id, newName, type = null) {
    const item = type
      ? state.items.find((i) => String(i.id) === String(id) && i.type === type)
      : state.items.find((i) => i.id === id);
    if (item) {
      item.name = newName;
      item.updatedAt = new Date().toISOString();
      if (item.type === "file") {
        updateNote(id, newName, item.content || "").catch((err) => {
          console.warn(`Failed to rename note ${id}:`, err.message);
        });
        debouncedIndexNote(id, newName, item.content || "");
      } else if (item.type === "folder") {
        apiRenameFolder(item.id, newName).catch((err) => {
          console.warn(`Failed to rename folder ${id}:`, err.message);
        });
      }
    }
  }

  function deleteItem(id) {
    const item = state.items.find((i) => i.id === id);
    if (item && item.type === "file") {
      deleteNote(id).catch((err) => {
        console.warn(`Failed to delete note ${id} from backend:`, err.message);
      });
      deleteNoteIndex(id).catch((err) => {
        console.warn("Failed to remove note from index:", err.message);
      });
    }
    const children = state.items.filter((i) => i.parentId === id);
    children.forEach((c) => deleteItem(c.id));
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx !== -1) state.items.splice(idx, 1);
    if (state.activeFileId === id) {
      const firstFile = state.items.find((i) => i.type === "file");
      state.activeFileId = firstFile ? firstFile.id : null;
    }
  }

  const fileCount = computed(
    () => state.items.filter((i) => i.type === "file").length,
  );

  function moveItem(itemId, itemType, newParentId) {
    const item = state.items.find(
      (i) => String(i.id) === String(itemId) && i.type === itemType,
    );
    if (!item) return;
    // No op if already in the target parent
    if (String(item.parentId) === String(newParentId)) return;
    // Cycle guard: reject if moving a folder into itself or a descendant
    if (itemType === "folder" && newParentId !== null) {
      let cursor = newParentId;
      while (cursor !== null) {
        if (String(cursor) === String(itemId)) return;
        const parent = state.items.find(
          (i) => String(i.id) === String(cursor) && i.type === "folder",
        );
        cursor = parent ? parent.parentId : null;
      }
    }
    const previousParentId = item.parentId;
    const numericItemId = Number(itemId);
    const numericParentId = newParentId === null ? null : Number(newParentId);
    item.parentId = numericParentId;
    if (itemType === "file") {
      apiMoveNote(numericItemId, numericParentId).catch((err) => {
        console.warn(`Failed to move note ${numericItemId}:`, err.message);
        item.parentId = previousParentId;
      });
    } else {
      apiMoveFolder(numericItemId, numericParentId).catch((err) => {
        console.warn(`Failed to move folder ${numericItemId}:`, err.message);
        item.parentId = previousParentId;
      });
    }
  }

  function searchItems(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    return state.items.filter((i) => i.name.toLowerCase().includes(q));
  }

  function searchByTag(tagName) {
    const name = tagName.toLowerCase();
    return state.items.filter((i) => {
      if (i.type !== "file") return false;
      return (noteTagCache[i.id] ?? []).includes(name);
    });
  }

  async function preloadNoteTags() {
    const files = state.items.filter((i) => i.type === "file");
    await Promise.all(
      files.map(async (item) => {
        if (panelTagCache[item.id] !== undefined) return;
        try {
          const tags = await fetchNoteTags(item.id);
          const dbTagNames = tags.map((t) => t.name);
          contentTagCache[item.id] = [];
          panelTagCache[item.id] = dbTagNames;
          noteTagCache[item.id] = dbTagNames;
        } catch {
          /* ignore tag search will just miss this note */
        }
      }),
    );
  }

  function getNoteTags(noteId) {
    return noteTagCache[noteId] ?? [];
  }

  function getContentTags(noteId) {
    return contentTagCache[noteId] ?? [];
  }

  function getPanelTags(noteId) {
    return panelTagCache[noteId] ?? [];
  }

  async function setNoteTags(noteId, tags) {
    const merged = new Set([...(panelTagCache[noteId] ?? []), ...tags]);
    panelTagCache[noteId] = [...merged];
    rebuildNoteTagCache(noteId);
    const { tags: saved } = await syncNoteTags(noteId, noteTagCache[noteId]);
    noteTagCache[noteId] = saved.map((t) => t.name);
    const fresh = await fetchTags();
    globalTags.splice(0, globalTags.length, ...fresh);
  }

  async function reloadNoteTags(noteId) {
    const item = state.items.find((i) => i.id === noteId);
    if (!item) return;
    try {
      const tags = await fetchNoteTags(noteId);
      const dbTagNames = tags.map((t) => t.name);
      const existingNames = new Set(globalTags.map((g) => g.name));
      const contentTags = new Set(
        parseContentTags(item.content ?? "").filter((t) =>
          existingNames.has(t),
        ),
      );
      contentTagCache[noteId] = [...contentTags];
      panelTagCache[noteId] = dbTagNames.filter(
        (name) => !contentTags.has(name),
      );
      noteTagCache[noteId] = dbTagNames;
    } catch {
      /* keep existing cache on error */
    }
  }

  async function deletePanelTag(noteId, tagName) {
    panelTagCache[noteId] = (panelTagCache[noteId] ?? []).filter(
      (t) => t !== tagName,
    );
    rebuildNoteTagCache(noteId);
    const { tags: saved } = await syncNoteTags(noteId, noteTagCache[noteId]);
    noteTagCache[noteId] = saved.map((t) => t.name);
    const fresh = await fetchTags();
    globalTags.splice(0, globalTags.length, ...fresh);
  }

  function addTagsToContent(noteId, tagNames) {
    const item = state.items.find((i) => i.id === noteId && i.type === "file");
    if (!item) return;
    const existing = new Set(parseContentTags(item.content ?? ""));
    const toAdd = tagNames.filter((t) => !existing.has(t.toLowerCase()));
    if (!toAdd.length) return;
    const newContent =
      (item.content ?? "").trimEnd() +
      "\n" +
      toAdd.map((t) => `#${t}`).join(" ");
    updateFileContent(noteId, newContent);
  }

  function removeTagFromContent(noteId, tagName) {
    const item = state.items.find((i) => i.id === noteId && i.type === "file");
    if (!item) return;
    const pattern = new RegExp(`\\s*#${tagName}(?=[\\s,;.!?\\n]|$)`, "gi");
    const newContent = (item.content ?? "")
      .replace(pattern, "")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd();
    updateFileContent(noteId, newContent);
  }

  function getLinkedNotes(noteId) {
    const cache = noteLinkCache[noteId];
    if (!cache) return { outbound: [], inbound: [] };
    const outbound = [...cache.outbound]
      .map((id) => state.items.find((i) => i.id === id))
      .filter(Boolean);
    const inbound = [...cache.inbound]
      .map((id) => state.items.find((i) => i.id === id))
      .filter(Boolean);
    return { outbound, inbound };
  }

  function reset() {
    state.items.splice(0, state.items.length);
    state.activeFileId = null;
    state.loading = true;
    for (const key of Object.keys(noteLinkCache)) delete noteLinkCache[key];
    for (const key of Object.keys(noteTagCache)) delete noteTagCache[key];
    for (const key of Object.keys(contentTagCache)) delete contentTagCache[key];
    for (const key of Object.keys(panelTagCache)) delete panelTagCache[key];
    globalTags.splice(0, globalTags.length);
  }

  async function init() {
    if (state.items.length > 0) return;
    state.loading = true;
    try {
      const [notes, tags, backendFolders] = await Promise.all([
        fetchNotes(),
        fetchTags(),
        apiGetFolders(),
      ]);
      globalTags.splice(0, globalTags.length, ...tags);
      const folderItems = backendFolders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parent_folder_id ?? null,
        type: "folder",
        updatedAt: null,
      }));
      const backendFiles = notes.map(noteToItem);
      state.items.splice(
        0,
        state.items.length,
        ...folderItems,
        ...backendFiles,
      );
      if (!state.items.find((i) => i.id === state.activeFileId)) {
        const firstFile = state.items.find((i) => i.type === "file");
        if (firstFile) await setActiveFile(firstFile.id);
      }
      preloadNoteTags(); // fire and forget: populates tag cache for tag search
    } catch (err) {
      console.warn(
        "Failed to load notes from backend, using local data:",
        err.message,
      );
    } finally {
      state.loading = false;
    }
  }

  return {
    state,
    loading: computed(() => state.loading),
    activeFile,
    rootItems,
    getChildren,
    setActiveFile,
    createFile,
    importNote,
    createFolder,
    updateFileContent,
    renameItem,
    deleteItem,
    moveItem,
    fileCount,
    recentFiles,
    searchItems,
    searchByTag,
    updateItemIcon,
    getLinkedNotes,
    syncNoteLinks,
    globalTags,
    getNoteTags,
    getContentTags,
    getPanelTags,
    setNoteTags,
    deletePanelTag,
    reloadNoteTags,
    ensureGlobalTag,
    addTagsToContent,
    removeTagFromContent,
    parseContentTags,
    init,
    reset,
  };
}
