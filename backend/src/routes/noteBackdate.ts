// POST /api/notes/:id/created-at
// Sets the creation date of a note. Authenticated: only affects notes owned
// by the requesting user.

import express, { type Request, type Response } from "express";
import { DB } from "../db/db.js";
import { MiddleWareAuthenticateToken } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/user.js";

const router = express.Router();

router.post(
	"/notes/:id/created-at",
	MiddleWareAuthenticateToken,
	(req: Request, res: Response) => {
		const authReq = req as AuthenticatedRequest;
		if (!authReq.user) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const noteId = Number(req.params.id);
		if (Number.isNaN(noteId) || noteId <= 0) {
			res.status(400).json({ error: "Invalid note id" });
			return;
		}

		const { created_at } = req.body as { created_at?: string };
		if (!created_at || typeof created_at !== "string") {
			res.status(400).json({ error: "created_at is required" });
			return;
		}

		try {
			const db = DB.Instance().DB();
			const result = db
				.prepare(
					"UPDATE DB_NOTES SET CREATED = ? WHERE ID = ? AND USER_ID = ?",
				)
				.run(created_at, noteId, authReq.user.ID);

			if (result.changes === 0) {
				res.status(404).json({ error: "Note not found" });
				return;
			}

			res.json({ ok: true });
		} catch (err) {
			console.error("Set created-at error:", err);
			res.status(500).json({ error: "Internal server error" });
		}
	},
);

export default router;
