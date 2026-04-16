import { type Response } from "express";
import { DB } from "../db/db.js";
import type { AuthenticatedRequest } from "../types/user.js";

interface LinkNoteRequestBody {
	links: Array<{
		from_id: number;
		to_ids: number[];
	}>;
}

export const ApiPostLinkNote = (
	req: AuthenticatedRequest<LinkNoteRequestBody>,
	res: Response,
): void => {
	if (!req.user) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	const { links } = req.body as LinkNoteRequestBody;

	if (links.length === 0) {
		res.status(400).json({ message: "Expected non-empty links array" });
		return;
	}

	const db = DB.Instance();

	const tx = db.DB().transaction(() => {
		for (let i = 0; i < links.length; i++) {
			const link = links[i]!;
			const from = link.from_id;

			for (let j = 0; j < link.to_ids.length; j++) {
				const to = link.to_ids[j]!;
				const res = db.LinkNote(from, to);

				if (res.error !== null) {
					if (res.error.isUniqueConstraint()) {
						continue;
					}
					throw res.error;
				}
			}
		}
	});

	try {
		tx();
		res.status(200).end();
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: "Internal server error" });
	}
};
