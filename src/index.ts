import express from "express";
import { initDB } from "./db.js";
import { storeBansFromLog, storeBan, fetchBans } from "./f2b_controller.js"
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PORT = process.env.PORT ? process.env.PORT : 3000;


const db = await initDB(process.env.DB_PATH as string);
const app = express();
app.use(express.json());


app.get("/", async (req, res) => {
    let data: string = await fs.readFile(path.join(__dirname, "./public/index.html"), { encoding: "utf8" });
	data = data.replace("<PUBLIC_URL>", process.env.PUBLIC_URL as string);
	res.send(data);
});

app.use("/", express.static(path.join(__dirname, "./public")));

app.get("/api/bans", async (req, res) => {
	try {
		res.status(200).json(await fetchBans(db));
	}
	catch (error) {
		console.error(error);
		res.sendStatus(500);
	}
});

app.post("/api/bans", async (req, res) => {
	if (!req.body.ip || !req.body.jail_name || !req.body.timestamp) {
		res.status(400).json({ "error": "Missing parameters" });
		return;
	}
	try {
		console.info(`Received ban ${req.body.timestamp} [${req.body.jail_name}] ${req.body.ip}`);
		await storeBan({
			ip: req.body.ip,
			jail_name: req.body.jail_name,
			timestamp: req.body.timestamp * 1000
		}, db);
		res.sendStatus(200);
	}
	catch (error) {
		console.error(error);
		res.sendStatus(500);
	}
});


async function init() {
	// try {
	// 	if (process.env.LOG_PATH) {
	// 		await storeBansFromLog(process.env.LOG_PATH as string, db);
	// 	}
	// }
	// catch (error) {
	// 	console.error("Cannot load old bans from logs");
	// }

	app.listen(PORT, () => {
		console.log(`Listening on port ${PORT}`);
	});
}

init();
