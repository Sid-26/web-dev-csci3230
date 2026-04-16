// POST   /api/notes/:id/index upsert a note into the notes_fts table
// DELETE /api/notes/:id/index remove a note from the notes_fts table
// FTS5 virtual tables do not support UPDATE or INSERT OR REPLACE, so the pattern is delete-then-insert wrapped in a transaction.

import express, { type Request, type Response } from "express";
import { DB } from "../db/db.js";

const router = express.Router();

// delete then insert, since FTS5 has no UPDATE
router.post("/notes/:id/index", (req: Request, res: Response) => {
	const { id } = req.params;
	const { title = "", content = "" } = req.body as {
		title?: string;
		content?: string;
	};

	const db = DB.Instance().DB();

	try {
		const tx = db.transaction(() => {
			db.prepare("DELETE FROM notes_fts WHERE note_id = ?").run(id);
			db.prepare(
				"INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)",
			).run(id, title, content);
		});
		tx();

		res.json({ ok: true, note_id: id });
	} catch (err) {
		console.error("Index upsert error:", err);
		res.status(500).json({ error: "Failed to index note" });
	}
});

// delete from index
router.delete("/notes/:id/index", (req: Request, res: Response) => {
	const { id } = req.params;
	const db = DB.Instance().DB();

	try {
		db.prepare("DELETE FROM notes_fts WHERE note_id = ?").run(id);
		res.json({ ok: true, note_id: id });
	} catch (err) {
		console.error("Index delete error:", err);
		res.status(500).json({ error: "Failed to remove note from index" });
	}
});

export default router;
