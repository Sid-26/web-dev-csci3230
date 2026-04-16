import { type Response } from "express";
import type { AuthenticatedRequest } from "../types/user.js";
import { DB } from "../db/db.js";

export const ApiGetWhoAmI = (req: AuthenticatedRequest, res: Response) => {
	const me = req.user;

	if (!me) {
		res.status(401).json({ message: "Not authenticated" });
		return;
	}

	const { data: user, error } = DB.Instance().GetUserById(me.ID);

	if (error || !user) {
		res.status(401).json({ message: "User no longer exists" });
		return;
	}

	res.status(200).json({
		ID: user.ID,
		NAME: user.NAME,
		EMAIL: user.EMAIL,
		CREATED: user.CREATED,
	});
};
