import type { DB } from "./db.js";
import { DBError } from "./errors.js";

type MigrationFunc = (
	db: DB,
	fromVersion: number,
	toVersion: number,
) => DBError | null;

const migrate_0: MigrationFunc = (
	database: DB,
	_: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(
				`CREATE TABLE IF NOT EXISTS DB_VERSION (VERSION INTEGER PRIMARY KEY NOT NULL)`,
			);

			db.prepare("INSERT INTO DB_VERSION (VERSION) VALUES (?)").run(
				toVersion,
			);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_1: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(
				`CREATE TABLE IF NOT EXISTS DB_USER (` +
					`ID        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,` +
					`NAME      TEXT UNIQUE,` +
					`EMAIL     TEXT,` +
					`PASSWORD  BLOB,` +
					`CREATED   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` +
					`);`,
			);

			// just copy paste this at the end of every transaction in every migration function
			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_2: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(
				`CREATE TABLE IF NOT EXISTS DB_NOTES (
					ID INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
					USER_ID INTEGER NOT NULL,
					TITLE TEXT NOT NULL,
					CONTENT TEXT NOT NULL DEFAULT "",
					CREATED TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UPDATED TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (USER_ID) REFERENCES DB_USER(ID) ON DELETE CASCADE
				)`,
			);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

// ── Migration 3 (David) ───────────────────────────────────────────────────────
// Creates the notes_fts FTS5 virtual table for hybrid keyword search.
// Porter stemmer: "running" and "run" match the same note.
// Field weights via bm25(): title=10×, content=1×.
const migrate_3: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`
				CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
					note_id  UNINDEXED,
					title,
					content,
					tokenize = 'porter ascii'
				)
			`);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_4: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS DB_NOTES_LINKS(
                    FROM_NOTE_ID    INTEGER NOT NULL,
                      TO_NOTE_ID    INTEGER NOT NULL,
                    PRIMARY KEY (FROM_NOTE_ID, TO_NOTE_ID),
					FOREIGN KEY (FROM_NOTE_ID) REFERENCES DB_NOTES(ID) ON DELETE CASCADE,
					FOREIGN KEY (TO_NOTE_ID) REFERENCES DB_NOTES(ID) ON DELETE CASCADE
				)
			`);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_5: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS DB_FOLDER(
					ID           INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    USER_ID      INTEGER NOT NULL,
                    PARENT_ID    INTEGER,
                    NAME         TEXT NOT NULL,
					FOREIGN KEY (PARENT_ID) REFERENCES DB_FOLDER(ID) ON DELETE CASCADE,
					FOREIGN KEY (USER_ID) REFERENCES DB_USER(ID) ON DELETE CASCADE
				)
			`);

			// to alter the table with a foreign key, we can just make a new table, copy the old data, drop it, and rename the new table in place of the old one.
			db.exec(
				`CREATE TABLE IF NOT EXISTS NEW_DB_NOTES (
					ID INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    PARENT_ID INTEGER DEFAULT NULL,
					USER_ID INTEGER NOT NULL,
					TITLE TEXT NOT NULL,
					CONTENT TEXT NOT NULL DEFAULT "",
					CREATED TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UPDATED TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (USER_ID) REFERENCES DB_USER(ID) ON DELETE CASCADE,
					FOREIGN KEY (PARENT_ID) REFERENCES DB_FOLDER(ID) ON DELETE CASCADE
				)`,
			);
			db.exec(
				`INSERT INTO NEW_DB_NOTES (ID, USER_ID, TITLE, CONTENT, CREATED, UPDATED) SELECT * FROM DB_NOTES`,
			);
			db.exec(`DROP TABLE DB_NOTES`);
			db.exec(`ALTER TABLE NEW_DB_NOTES RENAME TO DB_NOTES`);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_6: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS DB_TAGS (
					ID       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
					USER_ID  INTEGER NOT NULL,
					NAME     TEXT NOT NULL,
					CREATED  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(USER_ID, NAME),
					FOREIGN KEY (USER_ID) REFERENCES DB_USER(ID) ON DELETE CASCADE
				)
			`);

			db.exec(`
				CREATE TABLE IF NOT EXISTS DB_NOTE_TAGS (
					NOTE_ID  INTEGER NOT NULL,
					TAG_ID   INTEGER NOT NULL,
					PRIMARY KEY (NOTE_ID, TAG_ID),
					FOREIGN KEY (NOTE_ID) REFERENCES DB_NOTES(ID) ON DELETE CASCADE,
					FOREIGN KEY (TAG_ID)  REFERENCES DB_TAGS(ID)  ON DELETE CASCADE
				)
			`);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_7: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`ALTER TABLE DB_NOTES ADD COLUMN ICON TEXT`);

			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

const migrate_8: MigrationFunc = (
	database: DB,
	fromVersion: number,
	toVersion: number,
) => {
	const db = database.DB();

	try {
		const tx = db.transaction(() => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS DB_FILES (
					ID             INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
					USER_ID        INTEGER NOT NULL,
					ORIGINAL_NAME  TEXT NOT NULL,
					STORED_NAME    TEXT NOT NULL,
					MIME_TYPE      TEXT NOT NULL,
					EXTENSION      TEXT,
					SIZE_BYTES     INTEGER NOT NULL,
					STORAGE_PATH   TEXT NOT NULL,
					CREATED        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (USER_ID) REFERENCES DB_USER(ID) ON DELETE CASCADE
				)
			`);
			
			db.prepare(
				"UPDATE DB_VERSION SET VERSION = ? WHERE VERSION = ?",
			).run(toVersion, fromVersion);
		});

		tx();
	} catch (err) {
		return DBError.from(err);
	}

	return null;
};

export const Migrations: Array<{
	fromVersion: number;
	toVersion: number;
	func: MigrationFunc;
}> = [
	{ fromVersion: 0, toVersion: 1, func: migrate_0 },
	{ fromVersion: 1, toVersion: 2, func: migrate_1 },
	{ fromVersion: 2, toVersion: 3, func: migrate_2 },
	{ fromVersion: 3, toVersion: 4, func: migrate_3 },
	{ fromVersion: 4, toVersion: 5, func: migrate_4 },
	{ fromVersion: 5, toVersion: 6, func: migrate_5 },
	{ fromVersion: 6, toVersion: 7, func: migrate_6 },
	{ fromVersion: 7, toVersion: 8, func: migrate_7 },
	{ fromVersion: 8, toVersion: 9, func: migrate_8 },
];
