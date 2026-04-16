import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../db/db.js";
import { JWT_SECRET } from "../constants/jwt_secret.js";

interface LoginRequestBody {
	username: string;
	password: string;
}

export const ApiPostLogin = (
	req: Request<object, object, LoginRequestBody>,
	res: Response,
) => {
	const { username, password } = req.body;

	if (username.trim().length === 0) {
		res.status(400);
		res.send(`Expected non-zero length for username / email`);
		return;
	}

	if (password.length < 2) {
		res.status(400);
		res.send(`Password must be at least 2 characters`);
		return;
	}

	const db = DB.Instance();
	const result = db.GetUser(username, password);

	if (result.error !== null) {
		console.error(`error logging in: ${result.error}`);
		res.status(500);
		res.send(`Internal server error`);
	} else {
		const token = jwt.sign(result.data, JWT_SECRET, {
			expiresIn: "60m",
		});

		const payload = {
			token: token,
			type: "Bearer",
			user: result.data,
		};

		res.status(200).json(payload);
	}
};
