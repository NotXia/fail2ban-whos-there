import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";


export async function initDB(db_path: string = "./db.sqlite"): Promise<Database> {
	const db: Database = await open({
		filename: db_path,
		driver: sqlite3.Database
	});

	await db.exec(`
		CREATE TABLE IF NOT EXISTS bans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip TEXT NOT NULL,
			jail_name TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			country TEXT NOT NULL,
			lat REAL NOT NULL,
			lon REAL NOT NULL,
			UNIQUE (ip, jail_name, timestamp)
		);
	`);
	await db.exec("CREATE INDEX IF NOT EXISTS bans_index ON bans (timestamp)");

	return db
}