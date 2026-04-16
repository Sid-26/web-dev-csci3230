// POST /api/notes/:id/analyze
// Accepts a note's content and existing tags, calls Gemini to produce: tags: string[]  (3-6 tags selected from the available tags list)
// Requires GEMINI_API_KEY in the environment.

import { GoogleGenerativeAI } from "@google/generative-ai";
import express, { type Request, type Response } from "express";

const router = express.Router();

router.post("/notes/:id/analyze", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { content, tags: existingTags = [] } = req.body;

		// Validation
		if (!content || (content as string).trim().length === 0) {
			return res.status(400).json({ error: "Note content is empty" });
		}

		if (!process.env.GEMINI_API_KEY) {
			return res
				.status(500)
				.json({ error: "GEMINI_API_KEY is not configured" });
		}

		const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

		// Tag extraction via gemini-2.5-flash
		const tagList = (existingTags as string[]).join(", ");

		const prompt = `
You are an assistant that analyzes personal notes.

Given the following note content and a list of available tags, return a JSON object with exactly this field:
1. "tags": an array of 3-6 tags selected ONLY from the available tags list below. Do not invent new tags.

Available tags: ${tagList}

If none of the available tags are relevant, return an empty array for "tags".

Return ONLY valid JSON. No explanation. No markdown. No code blocks.

Note content:
"""
${content}
"""
		`.trim();

		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
		const result = await model.generateContent(prompt);
		const text = result.response.text().trim();

		let parsed: { tags: string[] };
		try {
			parsed = JSON.parse(text);
		} catch {
			console.error("Gemini returned non-JSON:", text);
			return res
				.status(500)
				.json({ error: "Failed to parse Gemini response", raw: text });
		}

		const { tags } = parsed;

		if (!Array.isArray(tags)) {
			return res.status(500).json({
				error: "Unexpected response shape from Gemini",
				raw: parsed,
			});
		}

		return res.json({ id, tags });
	} catch (err) {
		console.error("Analyze route error:", err);
		return res.status(500).json({
			error: "Internal server error",
			details: (err as Error).message,
		});
	}
});

export default router;
