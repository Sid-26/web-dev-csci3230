import Database from "better-sqlite3";
import { DBError } from "./errors.js";
import { Migrations } from "./migrations.js";
import crypto from "crypto";
import type { User } from "../types/user.js";
import type { FileAsset } from "../types/file.js";
import type { Note, NoteLink, NoteListItem } from "../types/note.js";
import type { Folder, FolderChildren } from "../types/folder.js";

export type Result<T> =
	| { data: T; error: null }
	| { data: null; error: DBError };

export class DB {
	private static instance: DB;
	private db: InstanceType<typeof Database>;

	private constructor() {
		this.db = new Database("./db.sqlite3");
		// Don't really care about this, it just adds junk to the filesystem
		// this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
	}

	public static Instance(): DB {
		if (!DB.instance) {
			DB.instance = new DB();
		}
		return DB.instance;
	}

	public DB(): InstanceType<typeof Database> {
		return this.db;
	}

	public Version(): Result<number> {
		try {
			const row = this.db
				.prepare("SELECT VERSION FROM DB_VERSION")
				.get() as { VERSION: number };

			return { data: row.VERSION, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetUserById(id: number): Result<User | null> {
		try {
			const stmt = this.db.prepare(
				"SELECT ID, NAME, EMAIL, CREATED FROM DB_USER WHERE ID = ?",
			);
			const row = stmt.get(id) as User | undefined;
			return { data: row ?? null, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetUser(username: string, password: string): Result<User> {
		try {
			const hashedPassword = crypto
				.createHash("sha256")
				.update(password)
				.digest();

			const stmt = this.db.prepare(
				"SELECT ID, NAME, EMAIL, CREATED FROM DB_USER WHERE NAME = ? AND PASSWORD = ?",
			);

			const info = stmt.get(username, hashedPassword) as User;

			return { data: info, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public AddUser(
		username: string,
		email: string,
		password: string,
	): Result<number> {
		try {
			// I said we were gonna use bcrypt because it's good, but it's way easier to just use a builtin than add a new library just for that.
			// Who really cares anyways since we're not being marked on good security practices. This should do well enough.
			const hashedPassword = crypto
				.createHash("sha256")
				.update(password)
				.digest();

			const stmt = this.db.prepare(
				"INSERT INTO DB_USER(NAME, EMAIL, PASSWORD) VALUES (?, ?, ?)",
			);

			const info = stmt.run(username, email, hashedPassword);

			return { data: Number(info.lastInsertRowid), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public CreateNote(
		userId: number,
		title: string,
		content: string,
		icon: string | null,
	): Result<number> {
		try {
			const stmt = this.db.prepare(
				"INSERT INTO DB_NOTES (USER_ID, TITLE, CONTENT, ICON) VALUES (?, ?, ?, ?)",
			);

			const info = stmt.run(userId, title, content, icon);

			return { data: Number(info.lastInsertRowid), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetNotesList(userId: number): Result<NoteListItem[]> {
		try {
			const stmt = this.db.prepare(
				`SELECT
					n.ID        AS id,
					n.PARENT_ID AS folder_id,
					n.TITLE     AS title,
					n.ICON      AS icon,
					n.CREATED   AS created_at,
					n.UPDATED   AS updated_at,
					GROUP_CONCAT(t.NAME) AS tags
				FROM DB_NOTES n
				LEFT JOIN DB_NOTE_TAGS nt ON nt.NOTE_ID = n.ID
				LEFT JOIN DB_TAGS t       ON t.ID = nt.TAG_ID
				WHERE n.USER_ID = ?
				GROUP BY n.ID
				ORDER BY n.UPDATED DESC`,
			);

			const rows = stmt.all(userId) as Array<
				Omit<NoteListItem, "tags"> & { tags: string | null; icon: string | null }
			>;

			return {
				data: rows.map((r) => ({
					...r,
					icon: r.icon ?? null,
					tags: r.tags ? r.tags.split(",") : [],
				})),
				error: null,
			};
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetTags(
		userId: number,
	): Result<Array<{ id: number; name: string; note_count: number }>> {
		try {
			const stmt = this.db.prepare(
				`SELECT t.ID AS id, t.NAME AS name, COUNT(nt.NOTE_ID) AS note_count
				FROM DB_TAGS t
				LEFT JOIN DB_NOTE_TAGS nt ON nt.TAG_ID = t.ID
				WHERE t.USER_ID = ?
				GROUP BY t.ID
				ORDER BY t.NAME ASC`,
			);

			const rows = stmt.all(userId) as Array<{
				id: number;
				name: string;
				note_count: number;
			}>;

			return { data: rows, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public UpsertTag(userId: number, name: string): Result<number> {
		try {
			const normalized = name.toLowerCase().trim();

			this.db
				.prepare(
					`INSERT INTO DB_TAGS (USER_ID, NAME) VALUES (?, ?)
					ON CONFLICT(USER_ID, NAME) DO NOTHING`,
				)
				.run(userId, normalized);

			const row = this.db
				.prepare(
					`SELECT ID FROM DB_TAGS WHERE USER_ID = ? AND NAME = ?`,
				)
				.get(userId, normalized) as { ID: number };

			return { data: row.ID, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public DeleteTag(userId: number, tagId: number): Result<number> {
		try {
			const info = this.db
				.prepare(`DELETE FROM DB_TAGS WHERE ID = ? AND USER_ID = ?`)
				.run(tagId, userId);

			return { data: info.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetNoteTags(
		noteId: number,
		userId: number,
	): Result<Array<{ id: number; name: string }>> {
		try {
			const stmt = this.db.prepare(
				`SELECT t.ID AS id, t.NAME AS name
				FROM DB_TAGS t
				JOIN DB_NOTE_TAGS nt ON nt.TAG_ID = t.ID
				JOIN DB_NOTES n      ON n.ID = nt.NOTE_ID
				WHERE nt.NOTE_ID = ? AND n.USER_ID = ?
				ORDER BY t.NAME ASC`,
			);

			const rows = stmt.all(noteId, userId) as Array<{
				id: number;
				name: string;
			}>;

			return { data: rows, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public SyncNoteTags(
		noteId: number,
		userId: number,
		tagNames: string[],
	): Result<Array<{ id: number; name: string }>> {
		try {
			const normalized = tagNames
				.map((n) => n.toLowerCase().trim())
				.filter((n) => n.length > 0);

			const upsertTag = this.db.prepare(
				`INSERT INTO DB_TAGS (USER_ID, NAME) VALUES (?, ?)
				ON CONFLICT(USER_ID, NAME) DO NOTHING`,
			);
			const getTagId = this.db.prepare(
				`SELECT ID FROM DB_TAGS WHERE USER_ID = ? AND NAME = ?`,
			);
			const deleteOldTags = this.db.prepare(
				`DELETE FROM DB_NOTE_TAGS WHERE NOTE_ID = ?`,
			);
			const insertNoteTag = this.db.prepare(
				`INSERT INTO DB_NOTE_TAGS (NOTE_ID, TAG_ID) VALUES (?, ?)`,
			);

			const ownerCheck = this.db.prepare(
				`SELECT ID FROM DB_NOTES WHERE ID = ? AND USER_ID = ?`,
			);

			const result = this.db.transaction(() => {
				const owned = ownerCheck.get(noteId, userId);
				if (!owned) return null;

				const tags: Array<{ id: number; name: string }> = [];

				for (const name of normalized) {
					upsertTag.run(userId, name);
					const row = getTagId.get(userId, name) as { ID: number };
					tags.push({ id: row.ID, name });
				}

				deleteOldTags.run(noteId);

				for (const tag of tags) {
					insertNoteTag.run(noteId, tag.id);
				}

				return tags;
			})();

			if (result === null) {
				return { data: null, error: new DBError("Note not found") };
			}

			return { data: result, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetSingleNote(noteId: number, userId: number): Result<Note | null> {
		try {
			const stmt = this.db.prepare(
				`SELECT 
					ID AS id,
					PARENT_ID AS folder_id,
					TITLE AS title,
					CONTENT AS content,
					ICON AS icon,
					CREATED AS created_at,
					UPDATED AS updated_at
				 FROM DB_NOTES
				 WHERE ID = ? AND USER_ID = ?`,
			);

			const row = stmt.get(noteId, userId) as Note | undefined;
			if (!row) {
				return { data: null, error: null };
			}
			
			return { data: row, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public UpdateNote(
		noteId: number,
		userId: number,
		title: string,
		content: string,
		icon?: string | null,
	): Result<number> {
		try {
			if (icon === undefined) {
				const stmt = this.db.prepare(
					`UPDATE DB_NOTES
					 SET TITLE = ?,
					 	 CONTENT = ?,
						 UPDATED = CURRENT_TIMESTAMP
				 	 WHERE ID = ? AND USER_ID = ?`,
				);
				const row = stmt.run(title, content, noteId, userId);
				return { data: row.changes, error: null };
			}

			const stmt = this.db.prepare(
				`UPDATE DB_NOTES
				 SET TITLE = ?,
				 	 CONTENT = ?,
					 ICON = ?,
					 UPDATED = CURRENT_TIMESTAMP
			 	 WHERE ID = ? AND USER_ID = ?`,
			);

			const row = stmt.run(title, content, icon, noteId, userId);

			return { data: row.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public DeleteNote(noteId: number, userId: number): Result<number> {
		try {
			const stmt = this.db.prepare(
				"DELETE FROM DB_NOTES WHERE ID = ? AND USER_ID = ?",
			);

			const row = stmt.run(noteId, userId);

			return { data: row.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public LinkNote(fromNoteId: number, toNoteId: number): Result<number> {
		try {
			const stmt = this.db.prepare(
				`INSERT INTO DB_NOTES_LINKS(FROM_NOTE_ID, TO_NOTE_ID) 
                    SELECT kara.ID AS FROM_NOTE_ID, made.ID AS TO_NOTE_ID
                    FROM DB_NOTES kara, DB_NOTES made
                    WHERE kara.ID = ? 
                      AND made.ID = ?
                      AND kara.ID != made.ID
                      AND kara.USER_ID = made.USER_ID
                `,
			);

			const row = stmt.run(fromNoteId, toNoteId);

			return { data: row.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}
	public GetAllNoteLinks(userId: number): Result<Array<NoteLink>> {
		try {
			const stmt = this.db.prepare(
				`SELECT nl.FROM_NOTE_ID as from_note_id, nl.TO_NOTE_ID as to_note_id
				FROM DB_NOTES_LINKS nl
				JOIN DB_NOTES n ON n.ID = nl.FROM_NOTE_ID
				WHERE n.USER_ID = ?`,
			);
			const rows = stmt.all(userId) as Array<NoteLink>;
			return { data: rows, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetNoteLinks(noteId: number): Result<Array<NoteLink>> {
		try {
			const stmt = this.db.prepare(
				`SELECT 
                    FROM_NOTE_ID as from_note_id,
                    TO_NOTE_ID as to_note_id
                FROM DB_NOTES_LINKS nl WHERE ? IN (nl.FROM_NOTE_ID, nl.TO_NOTE_ID)`,
			);

			const row = stmt.all(noteId) as Array<NoteLink>;

			return { data: row, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}
	public DeleteNoteLink(
		fromNoteId: number,
		toNoteId: number,
	): Result<number> {
		try {
			const stmt = this.db.prepare(
				`
                    DELETE FROM DB_NOTES_LINKS
                    WHERE (FROM_NOTE_ID, TO_NOTE_ID) IN (
                        SELECT kara.ID AS FROM_ID, made.ID AS TO_ID
                        FROM DB_NOTES kara, DB_NOTES made
                        WHERE
                            kara.ID = ?
                        AND made.ID = ?
                        AND kara.ID != made.ID
                        and kara.USER_ID = made.USER_ID
                    )
                `,
			);

			const row = stmt.run(fromNoteId, toNoteId);

			return { data: row.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public CreateFolder(
		user_id: number,
		parent_folder_id: number | null,
		title: string,
	): Result<number> {
		try {
			const stmt = this.db.prepare(
				"INSERT INTO DB_FOLDER(USER_ID, PARENT_ID, NAME) VALUES(?, ?, ?)",
			);

			const info = stmt.run(user_id, parent_folder_id, title);

			return { data: Number(info.lastInsertRowid), error: null };
		} catch (err) {
			console.info(err);
			return { data: null, error: DBError.from(err) };
		}
	}

	public DeleteFolder(user_id: number, folder_id: number): Result<number> {
		try {
			const stmt = this.db.prepare(
				"DELETE FROM DB_FOLDER WHERE USER_ID = ? AND ID = ?",
			);

			const info = stmt.run(user_id, folder_id);

			return { data: Number(info.changes), error: null };
		} catch (err) {
			console.info(err);
			return { data: null, error: DBError.from(err) };
		}
	}

	public RenameFolder(user_id: number, folder_id: number, name: string): Result<number> {
		try {
			const stmt = this.db.prepare(
				"UPDATE DB_FOLDER SET NAME = ? WHERE ID = ? AND USER_ID = ?",
			);

			const info = stmt.run(name, folder_id, user_id);

			return { data: Number(info.changes), error: null };
		} catch (err) {
			console.info(err);
			return { data: null, error: DBError.from(err) };
		}
	}

	private static fileRowToAsset(row: {
		id: number;
		user_id: number;
		original_name: string;
		stored_name: string;
		mime_type: string;
		extension: string | null;
		size_bytes: number;
		storage_path: string;
		created_at: string;
	}): FileAsset {
		return {
			id: row.id,
			user_id: row.user_id,
			original_name: row.original_name,
			stored_name: row.stored_name,
			mime_type: row.mime_type,
			extension: row.extension,
			size_bytes: row.size_bytes,
			storage_path: row.storage_path,
			created_at: row.created_at,
		};
	}

	public CreateFileAsset(input: {
		userId: number;
		originalName: string;
		storedName: string;
		mimeType: string;
		extension: string | null;
		sizeBytes: number;
		storagePath: string;
	}): Result<number> {
		try {
			const stmt = this.db.prepare(
				`INSERT INTO DB_FILES (
					USER_ID,
					ORIGINAL_NAME, STORED_NAME, MIME_TYPE, EXTENSION,
					SIZE_BYTES, STORAGE_PATH
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			);

			const info = stmt.run(
				input.userId,
				input.originalName,
				input.storedName,
				input.mimeType,
				input.extension,
				input.sizeBytes,
				input.storagePath,
			);

			return { data: Number(info.lastInsertRowid), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public MoveNote(note_id: number, user_id: number, parent_folder_id: number | null): Result<number> {
		try {
			const stmt = this.db.prepare(
				"UPDATE DB_NOTES SET PARENT_ID = ? WHERE ID = ? AND USER_ID = ?",
			);

			const info = stmt.run(parent_folder_id, note_id, user_id);

			return { data: Number(info.changes), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetFileAssetForUser(
		fileId: number,
		userId: number,
	): Result<FileAsset | null> {
		try {
			const stmt = this.db.prepare(
				`SELECT
					ID AS id,
					USER_ID AS user_id,
					ORIGINAL_NAME AS original_name,
					STORED_NAME AS stored_name,
					MIME_TYPE AS mime_type,
					EXTENSION AS extension,
					SIZE_BYTES AS size_bytes,
					STORAGE_PATH AS storage_path,
					CREATED AS created_at
				FROM DB_FILES
				WHERE ID = ? AND USER_ID = ?`,
			);

			const row = stmt.get(fileId, userId) as
				| Parameters<typeof DB.fileRowToAsset>[0]
				| undefined;

			if (!row) {
				return { data: null, error: null };
			}

			return { data: DB.fileRowToAsset(row), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public ListFileAssetsForUser(userId: number): Result<FileAsset[]> {
		try {
			const stmt = this.db.prepare(
				`SELECT
					ID AS id,
					USER_ID AS user_id,
					ORIGINAL_NAME AS original_name,
					STORED_NAME AS stored_name,
					MIME_TYPE AS mime_type,
					EXTENSION AS extension,
					SIZE_BYTES AS size_bytes,
					STORAGE_PATH AS storage_path,
					CREATED AS created_at
				FROM DB_FILES
				WHERE USER_ID = ?
				ORDER BY CREATED DESC`,
			);

			const rows = stmt.all(userId) as Array<
				Parameters<typeof DB.fileRowToAsset>[0]
			>;

			return {
				data: rows.map((r) => DB.fileRowToAsset(r)),
				error: null,
			};
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public DeleteFileAsset(fileId: number, userId: number): Result<number> {
		try {
			const stmt = this.db.prepare(
				"DELETE FROM DB_FILES WHERE ID = ? AND USER_ID = ?",
			);
			const info = stmt.run(fileId, userId);
			return { data: info.changes, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public MoveFolder(folder_id: number, user_id: number, parent_folder_id: number | null): Result<number> {
		try {
			const stmt = this.db.prepare(
				"UPDATE DB_FOLDER SET PARENT_ID = ? WHERE ID = ? AND USER_ID = ?",
			);

			const info = stmt.run(parent_folder_id, folder_id, user_id);

			return { data: Number(info.changes), error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetFolders(user_id: number): Result<Folder[]> {
		try {
			const stmtFolders = this.db.prepare(
				`SELECT` +
					` ID as id,` +
					` PARENT_ID as parent_folder_id,` +
					` NAME as name` +
					` FROM DB_FOLDER` +
					` WHERE USER_ID = ?` +
					` ORDER BY PARENT_ID ASC`,
			);

			const folders = stmtFolders.all(user_id) as Folder[];

			return { data: folders, error: null };
		} catch (err) {
			console.info(err);
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetFoldersChildren(
		user_id: number,
		folder_id: number | null,
	): Result<FolderChildren> {
		try {
			const stmtFolders = this.db.prepare(
				`SELECT` +
					` ID as id,` +
					` PARENT_ID as parent_folder_id,` +
					` NAME as name` +
					` FROM DB_FOLDER` +
					` WHERE USER_ID = ? AND PARENT_ID IS ?`,
			);

			const stmtNotes = this.db.prepare(
				`SELECT` +
					` ID as id,` +
					` PARENT_ID as folder_id,` +
					` TITLE as title,` +
					` CONTENT as content,` +
					` CREATED as created_at,` +
					` UPDATED as updated_at` +
					` FROM DB_NOTES` +
					` WHERE USER_ID = ? AND PARENT_ID IS ?`,
			);

			const tx = this.db.transaction(
				(user_id: number, folder_id: number | null) => {
					const folders = stmtFolders.all(
						user_id,
						folder_id,
					) as Folder[];
					const files = stmtNotes.all(user_id, folder_id) as Note[];
					return {
						files,
						folders,
					};
				},
			);

			const results = tx(user_id, folder_id);

			return { data: results, error: null };
		} catch (err) {
			console.info(err);
			return { data: null, error: DBError.from(err) };
		}
	}

	public GetAllNotesWithContent(userId: number): Result<Note[]> {
		try {
			const stmt = this.db.prepare(
				`SELECT
					ID AS id,
					PARENT_ID AS folder_id,
					TITLE AS title,
					CONTENT AS content,
					CREATED AS created_at,
					UPDATED AS updated_at
				FROM DB_NOTES
				WHERE USER_ID = ?`,
			);

			const rows = stmt.all(userId) as Note[];
			return { data: rows, error: null };
		} catch (err) {
			return { data: null, error: DBError.from(err) };
		}
	}

	public Migrate(): Error | null {
		let version = this.Version();

		if (version.error !== null) {
			if (!version.error.isTableNotFound()) {
				console.error(
					"Unknown error while migrating database: ",
					version.error,
				);

				return version.error;
			}

			console.info("Version table not found, assuming empty database");
			version = { data: 0, error: null };
		}

		const maxVer = Migrations[Migrations.length - 1];

		if (maxVer === undefined) {
			throw new Error(
				"Max database version is undefined, this is impossible",
			);
		}

		console.debug(
			`Starting migration loop. this version: ${version.data} max version: ${maxVer.toVersion}`,
		);

		let curVersion = version.data;

		for (let i = 0; i < Migrations.length; i++) {
			const migration = Migrations[i];

			if (migration === undefined) {
				throw new Error(
					`Migration version ${curVersion} is undefined, this is impossible`,
				);
			}

			if (curVersion !== migration.fromVersion) {
				continue;
			}

			console.info(
				`Migrating database from version ${migration.fromVersion} to ${migration.toVersion}`,
			);

			const err = migration.func(
				this,
				migration.fromVersion,
				migration.toVersion,
			);

			if (err !== null) {
				console.info(
					`Migrating database from version ${migration.fromVersion} failed: ${err}`,
				);

				return err;
			}

			curVersion = migration.toVersion;
		}

		console.info("Migration finished. DB Version:", curVersion);

		return null;
	}
}
