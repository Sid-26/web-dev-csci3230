// POST /api/search/hybrid
// Full-text search using SQLite FTS5 with BM25 ranking and Porter stemming.
// Each query term is prefix-matched (guitar* matches guitars, guitarist).
// Field weights: title=10×, content=1×.
// BM25 returns negative values most negative = best match.
// Scores are normalised to 0-1 before returning to the frontend.

import express, { type Request, type Response } from "express";
import { DB } from "../db/db.js";

const router = express.Router();

router.post("/search/hybrid", (req: Request, res: Response) => {
	const { query, topK = 8 } = req.body as { query?: string; topK?: number };

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		res.status(400).json({ error: "query is required" });
		return;
	}

	const db = DB.Instance().DB();

	// Strip FTS5 special characters to prevent query syntax errors
	const sanitized = query.trim().replace(/["'*()^:]/g, " ");
	const terms = sanitized.split(/\s+/).filter((t) => t.length > 0);

	if (terms.length === 0) {
		res.json({ query, total_searched: 0, results: [] });
		return;
	}

	// Prefix-match each term guitar* matches guitars, guitarist, etc.
	const ftsQuery = terms.map((t) => `${t}*`).join(" ");

	try {
		type FtsRow = {
			note_id: string;
			title: string;
			rank: number;
		};

		const rows = db
			.prepare(
				`SELECT
					note_id,
					title,
					bm25(notes_fts, 0, 10, 1) AS rank
				FROM notes_fts
				WHERE notes_fts MATCH ?
				ORDER BY rank
				LIMIT ?`,
			)
			.all(ftsQuery, topK) as FtsRow[];

		if (rows.length === 0) {
			res.json({ query, total_searched: 0, results: [] });
			return;
		}

		// BM25 returns negative values most negative = best match.
		// Normalise so the frontend can display a "% match".
		const scores = rows.map((r) => r.rank);
		const minScore = Math.min(...scores);
		const maxScore = Math.max(...scores);
		const range = minScore === maxScore ? 1 : maxScore - minScore;

		const results = rows.map((r) => ({
			id: r.note_id,
			title: r.title,
			score: (maxScore - r.rank) / range,
		}));

		res.json({ query, total_searched: rows.length, results });
	} catch (err) {
		console.error("Hybrid search error:", err);
		res.status(500).json({
			error: "Search index unavailable",
		});
	}
});

export default router;
