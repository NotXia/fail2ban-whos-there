import express from "express";
import { initDB } from "./db.js";
import { storeBansFromLog, storeBan, fetchBans, storeBansInDb } from "./f2b_controller.js"
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import { BanWithoutLocation } from "./types/ban.js";
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
	const page_number: number = Number(req.query.page);
	const page_size: number = Number(req.query.page_size);
	try {
		res.status(200).json(await fetchBans(db, page_number, page_size));
	}
	catch (error) {
		console.error(error);
		res.sendStatus(500);
	}
});


// Batch requests to not overload ip-api.com
let bans_insert_batch: BanWithoutLocation[] = [];
let curr_insert_call: NodeJS.Timeout | null = null;

app.post("/api/bans", async (req, res) => {
	if (!req.body.ip || !req.body.jail_name || !req.body.timestamp) {
		res.status(400).json({ "error": "Missing parameters" });
		return;
	}
	try {
		console.info(`Received ban ${req.body.timestamp} [${req.body.jail_name}] ${req.body.ip}`);
		bans_insert_batch.push({
			ip: req.body.ip,
			jail_name: req.body.jail_name,
			timestamp: req.body.timestamp * 1000
		});

		if (curr_insert_call) {
			clearTimeout(curr_insert_call);
			curr_insert_call = null;
		}
		curr_insert_call = setTimeout(async () => {
			curr_insert_call = null
			for (let i=0; i<3; i++) {
				try {
					const to_insert = bans_insert_batch;
					bans_insert_batch = [];
					await storeBansInDb(to_insert, db);
				}
				catch (error) {
					console.error(error);
					await new Promise(r => setTimeout(r, 60000));
					continue;
				}
			}
		}, 1000);

		res.sendStatus(202);
	}
	catch (error) {
		console.error(error);
		res.sendStatus(500);
	}
});


async function init() {
	app.listen(PORT, () => {
		console.log(`Listening on port ${PORT}`);
	});
}

init();
