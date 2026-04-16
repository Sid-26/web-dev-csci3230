import { useAuth } from "../composables/useAuth.js";

const API_BASE = "http://localhost:3000/api";

// ─── Notes (Visualizations) ───────────────────────────────────────────────────

/**
 * Fetch all notes for visualizations (authenticated).
 * Returns: [{ id, folder_id, title, created_at, updated_at, tags: string[] }]
 */
export async function getNotes() {
  return fetchNotes();
}

/**
 * Fetch a single note by ID for visualizations (authenticated).
 */
export async function getNote(id) {
  return fetchNote(id);
}

// ─── Note CRUD (David) ───────────────────────────────────────────────────────
// These functions talk to DB_NOTES — the real notes table.
// All require an authenticated session (Bearer token from cookie).

/** Fetch all notes for the logged-in user. Returns: [{ id, title, updated_at }] */
export async function fetchNotes() {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

/** Fetch a single note with full content. Returns: { id, title, content, created_at, updated_at } */
export async function fetchNote(id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch note ${id}`);
  return res.json();
}

/** Create a new note. Returns: { id } */
export async function createNote(title, content = "") {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
}

/** Update a note's title and/or content. Returns: { id, title, content, created_at, updated_at } */
export async function updateNote(id, title, content) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Failed to update note ${id}`);
  return res.json();
}

/** Delete a note permanently. Returns: { id } */
export async function deleteNote(id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}/delete`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete note ${id}`);
  return res.json();
}

/** Fetch all tags for the logged-in user. Returns: [{ id, name, note_count }] */
export async function fetchTags() {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/tags`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch tags");
  const { tags } = await res.json();
  return tags ?? [];
}

/** Create a new global tag. Returns: { id, name } */
export async function createTag(name) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create tag");
  return res.json();
}

/** Delete a global tag by ID. */
export async function deleteTag(tagId) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/tags/${tagId}/delete`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete tag ${tagId}`);
}

/** Fetch tags for a specific note. Returns: [{ id, name }] */
export async function fetchNoteTags(noteId) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${noteId}/tags`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch tags for note ${noteId}`);
  const { tags } = await res.json();
  return tags ?? [];
}

/** Fetch all wiki-links for the logged-in user. Returns: [{ from_note_id, to_note_id }] */
export async function fetchAllLinks() {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/links`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch all note links");
  return res.json();
}

/** Replace all tags on a note. Returns: { tags: [{ id, name }] } */
export async function syncNoteTags(noteId, tags) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${noteId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error(`Failed to sync tags for note ${noteId}`);
  return res.json();
}

export async function linkNotes(linkNoteRequestBody) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/link`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(linkNoteRequestBody),
  });
  if (!res.ok) throw new Error("Failed to link notes");
}

// This returns:
// [
//   {
//     "from_note_id": 2,
//     "to_note_id": 1
//   },
//   {
//     "from_note_id": 3,
//     "to_note_id": 1
//   },
//   {
//     "from_note_id": 1,
//     "to_note_id": 4
//   },
// ]
// Where FROM_NOTE_ID or TO_NOTE_ID can be your given ID, the caller needs to figure out which way it wants
export async function getNoteLinks(nodeId) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${nodeId}/links`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get note links ${nodeId}`);
  return res.json();
}

// Links is this type:
// interface DeleteNoteLinkRequestBody {
// 	links: Array<NoteLink>;
// }
export async function deleteNoteLinks(links) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/link/delete`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(links),
  });
  if (!res.ok) throw new Error("Failed to delete note links");
}
export async function apiCreateFolder(parent_folder_id, title) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folder`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      parent_folder_id: parent_folder_id,
      title: title,
    }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
  return res.json();
}
export async function apiDeleteFolder(folder_id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folder/delete`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      folder_id: folder_id,
    }),
  });
  if (!res.ok) throw new Error(`Failed to delete folder ${folder_id}`);
}
/*
returns an array of this type:
export type Folder = {
    id: number;
    parent_folder_id: number | null;
    name: string;
};
*/
export async function apiGetFolders() {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folders`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch folders");
  return res.json();
}
/*
returns an array of this type:
export type FolderChildren = {
    files: Note[];
    folders: Folder[];
};
*/
export async function apiGetFolderChildren(folder_id) {
  if (folder_id == null) {
    folder_id = 0;
  }
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folder/${folder_id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get folder children");
  return res.json();
}


export async function apiMoveNote(note_id, parent_folder_id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${note_id}/move`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ parent_folder_id }),
  });
  if (!res.ok) throw new Error(`Failed to move note ${note_id}`);
}

export async function apiMoveFolder(folder_id, parent_folder_id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folder/move`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id, parent_folder_id }),
  });
  if (!res.ok) throw new Error(`Failed to move folder ${folder_id}`);
}

export async function apiRenameFolder(folder_id, name) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/folder/rename`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id, name }),
  });
  if (!res.ok) throw new Error(`Failed to rename folder ${folder_id}`);
}

// ─── File & Export ────────────────────────────────────────────────────────────

async function triggerAuthenticatedDownload(url, fallbackName) {
  const { authHeaders } = useAuth();
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const name = match ? match[1] : fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** Download a note as a .md file. */
export async function exportNoteAsMd(id, title = `note-${id}`) {
  return triggerAuthenticatedDownload(
    `${API_BASE}/notes/${id}/export`,
    `${title}.md`,
  );
}

/** Download a note rendered as .html. */
export async function exportNoteAsHtml(id, title = `note-${id}`) {
  return triggerAuthenticatedDownload(
    `${API_BASE}/notes/${id}/export/html`,
    `${title}.html`,
  );
}

/** Upload a file asset (md, png, jpg, jpeg, gif, pdf). Returns FileAsset. */
export async function uploadFile(file) {
  const { authHeaders } = useAuth();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

/** List all uploaded file assets for the logged-in user. */
export async function listFiles() {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/files`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to list files");
  return res.json();
}

/** Download a file asset by ID. */
export async function downloadFile(id) {
  return triggerAuthenticatedDownload(
    `${API_BASE}/files/${id}/download`,
    `file-${id}`,
  );
}

/** Export a folder as ZIP. Pass null for the full workspace. */
export async function exportFolderAsZip(id = null, title = null) {
  const url =
    id == null
      ? `${API_BASE}/folders/export`
      : `${API_BASE}/folder/${id}/export`;
  const fallback =
    id == null ? "workspace.zip" : `${title ?? `folder-${id}`}.zip`;
  return triggerAuthenticatedDownload(url, fallback);
}

// ─── Gemini Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a note with Gemini — returns suggested tags from the existing tag pool.
 */
export async function analyzeNote(id, content, existingTags = []) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, tags: existingTags }),
  });
  if (!res.ok) throw new Error("Failed to analyze note");
  return res.json();
}

// ─── Hybrid Search (David) ───────────────────────────────────────────────────
// Full-text search via SQLite FTS5 + BM25 ranking. Each term is prefix-matched
// (guitar* → guitars, guitarist). Returns note IDs + normalised scores.
// The frontend resolves IDs to node objects for the graph dropdown.

/**
 * Search notes using FTS5 BM25 hybrid search.
 * Returns: { query, total_searched, results: [{ id, title, tags, score }] }
 */
export async function hybridSearch(query, topK = 8) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/search/hybrid`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, topK }),
  });
  if (!res.ok) throw new Error("Hybrid search failed");
  return res.json();
}

// ─── Note Indexing (FTS) ────────────────────────────────────────────────────
// Upsert / remove a note from the FTS5 search index.
// Called by the editor store when notes are saved or deleted.

/**
 * Upsert a note into the FTS5 index.
 */
export async function indexNote(
  id,
  { title = "", tags = "", content = "" } = {},
) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, tags, content }),
  });
  if (!res.ok) throw new Error("Failed to index note");
  return res.json();
}

/**
 * Remove a note from the FTS5 index.
 */
export async function deleteNoteIndex(id) {
  const { authHeaders } = useAuth();
  const res = await fetch(`${API_BASE}/notes/${id}/index`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove note from index");
  return res.json();
}

// ─── Graph Helpers ────────────────────────────────────────────────────────────

/**
 * Build graph data from notes and wiki-links.
 *
 * Returns four separate collections so GraphView can combine them based on toggles:
 *   noteNodes  — one node per note
 *   tagNodes   — one node per unique tag (id = "tag-{name}")
 *   wikiEdges  — explicit note↔note links from [[wiki-links]] (DB_NOTES_LINKS)
 *   tagEdges   — note↔tag edges derived from each note's tags array
 *
 * connectionCount on noteNodes counts all edges (wiki + tag) so node sizing
 * reflects total connectivity regardless of which toggles are active.
 */
export function buildGraphData(notes, wikiLinks = []) {
  // Build tag nodes from all unique tags across notes
  const tagMap = new Map();
  notes.forEach((n) => {
    (n.tags ?? []).forEach((tag) => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          id: `tag-${tag}`,
          name: tag,
          noteCount: 0,
          type: "tag",
        });
      }
      tagMap.get(tag).noteCount++;
    });
  });
  const tagNodes = [...tagMap.values()];

  // Build tag edges (note → tag node)
  const tagEdges = [];
  notes.forEach((n) => {
    (n.tags ?? []).forEach((tag) => {
      if (tagMap.has(tag)) {
        tagEdges.push({ source: n.id, target: `tag-${tag}`, type: "tag" });
      }
    });
  });

  // Normalise wiki-links from backend shape { from_note_id, to_note_id }
  const wikiEdges = wikiLinks.map((l) => ({
    source: l.from_note_id,
    target: l.to_note_id,
    type: "wiki",
  }));

  // Connection count per note — sum of wiki edges + tag edges
  const connectionCount = {};
  notes.forEach((n) => {
    connectionCount[n.id] = 0;
  });
  wikiEdges.forEach((l) => {
    if (connectionCount[l.source] !== undefined) connectionCount[l.source]++;
    if (connectionCount[l.target] !== undefined) connectionCount[l.target]++;
  });
  tagEdges.forEach((l) => {
    if (connectionCount[l.source] !== undefined) connectionCount[l.source]++;
  });

  const noteNodes = notes.map((n) => ({
    id: n.id,
    title: n.title,
    tags: n.tags ?? [],
    created_at: n.created_at,
    updated_at: n.updated_at,
    connectionCount: connectionCount[n.id] ?? 0,
    type: "note",
  }));

  return { noteNodes, tagNodes, wikiEdges, tagEdges };
}

// ─── Activity Calendar Helpers ────────────────────────────────────────────────

/**
 * Group notes by date for the activity calendar.
 * Returns: { "2026-03-01": { count: 3, notes: [...] }, ... }
 */
export function buildCalendarData(notes) {
  const byDate = {};
  notes.forEach((n) => {
    const dateStr = n.created_at || n.updated_at;
    if (!dateStr) return;
    const date = dateStr.slice(0, 10); // "YYYY-MM-DD"
    if (!byDate[date]) byDate[date] = { notes: [] };
    byDate[date].notes.push({ id: n.id, title: n.title });
  });
  const result = {};
  Object.entries(byDate).forEach(([date, { notes }]) => {
    result[date] = { count: notes.length, notes };
  });
  return result;
}

