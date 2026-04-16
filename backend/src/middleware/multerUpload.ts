import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import multer from "multer";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOAD_DIR_NAME } from "../constants/upload.js";
import type { AuthenticatedRequest } from "../types/user.js";

function ensureUploadRoot(): void {
	const root = path.join(process.cwd(), UPLOAD_DIR_NAME);
	if (!fs.existsSync(root)) {
		fs.mkdirSync(root, { recursive: true });
	}
}

const storage = multer.diskStorage({
	destination(req, _file, cb) {
		ensureUploadRoot();
		const user = (req as AuthenticatedRequest).user;
		if (!user) {
			cb(new Error("Unauthorized"), "");
			return;
		}
		const dir = path.join(process.cwd(), UPLOAD_DIR_NAME, String(user.ID));
		fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename(_req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase();
		cb(null, `${crypto.randomUUID()}${ext}`);
	},
});

export const uploadSingleFileMiddleware = multer({
	storage,
	limits: { fileSize: MAX_UPLOAD_BYTES },
	fileFilter(_req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase();
		if (!ALLOWED_EXTENSIONS.has(ext)) {
			cb(
				new Error(
					"Only .md, .png, .jpg, .jpeg, .gif, and .pdf files are allowed",
				),
			);
			return;
		}
		cb(null, true);
	},
}).single("file");

const MAGIC_BYTES: Record<string, number[]> = {
	".png": [0x89, 0x50, 0x4e, 0x47],
	".jpg": [0xff, 0xd8, 0xff],
	".jpeg": [0xff, 0xd8, 0xff],
	".gif": [0x47, 0x49, 0x46, 0x38],
	".pdf": [0x25, 0x50, 0x44, 0x46], 
};

function fileContentMatchesExtension(filePath: string, ext: string): boolean {
	const expected = MAGIC_BYTES[ext];
	if (!expected) return true; // .md and other text formats nothing to check

	const fd = fs.openSync(filePath, "r");
	const buf = Buffer.alloc(expected.length);
	fs.readSync(fd, buf, 0, expected.length, 0);
	fs.closeSync(fd);

	return expected.every((byte, i) => buf[i] === byte);
}

export function runUploadThen(
	handler: (req: AuthenticatedRequest, res: Response) => void,
): (req: AuthenticatedRequest, res: Response) => void {
	return (req: AuthenticatedRequest, res: Response) => {
		uploadSingleFileMiddleware(req, res, (err: unknown) => {
			if (err) {
				if (err instanceof multer.MulterError) {
					if (err.code === "LIMIT_FILE_SIZE") {
						res.status(413).json({ message: "File too large" });
						return;
					}
				}
				const msg = err instanceof Error ? err.message : "Upload failed";
				res.status(400).json({ message: msg });
				return;
			}

			const file = req.file;
			if (file) {
				const ext = path.extname(file.originalname).toLowerCase();
				if (!fileContentMatchesExtension(file.path, ext)) {
					fs.unlink(file.path, () => {});
					res.status(400).json({
						message: "File content does not match its extension",
					});
					return;
				}
			}

			handler(req, res);
		});
	};
}
