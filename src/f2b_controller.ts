import fs from "node:fs/promises";
import { BanWithoutLocation, Ban } from "./types/ban";
import { Database } from "sqlite";



async function loadBansFromLog(log_path: string) : Promise<BanWithoutLocation[]> {
    /**
     * Parses a fail2ban log and extracts ban actions.
     * Note: the generated timestamp is off by 1 sec compared to the one given by fail2ban. Need to investigate.
     */
    let bans: BanWithoutLocation[] = []
    const data: string = await fs.readFile(log_path, { encoding: "utf8" });
    const log_lines: string[] = data.split("\n");
    const pattern = RegExp(
        /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2}),(?<mseconds>\d{3}) fail2ban\.actions\s+\[\d+\]: NOTICE\s+\[(?<jail_name>\w+)\] Ban (?<ip>\d+.\d+.\d+.\d+)/
    );

    for (const log of log_lines) {
        const match = pattern.exec(log);
        if (match && match.groups && Object.values(match.groups).every(x => x !== null)) {
            bans.push({
                "ip": match.groups.ip,
                "timestamp": new Date(
                    Number(match.groups.year), Number(match.groups.month)-1, Number(match.groups.day), 
                    Number(match.groups.hours), Number(match.groups.minutes), Number(match.groups.seconds)
                ).getTime(),
                "jail_name": match.groups.jail_name
            });
        }
    }

    return bans
}


async function addLocationInfo(bans: BanWithoutLocation[], batch_size: number=100) : Promise<Ban[]>{
    /**
     * Adds location information of the banned IPs.
     */
    let out_bans: Ban[] = []

    for (let i=0; i<bans.length; i+=batch_size) {
        const batch = bans.slice(i, i+batch_size);
        let ips_info: any = [];

        // Fetch IPs info
        if (batch.length == 1) {
            // Be polite! (+ max 45 requests per minute)
            if (((i+1) % 45) == 0) { await new Promise(r => setTimeout(r, 60000)); }
            const res = await fetch(`http://ip-api.com/json/${batch[0].ip}?fields=status,country,lat,lon,query`, { method: "GET" });
            ips_info = [ await res.json() ];
        } 
        else {
            // Be even more polite! (+ max 15 requests per minute)
            if (((i+1) % 15) == 0) { await new Promise(r => setTimeout(r, 60000)); }
            const res = await fetch("http://ip-api.com/batch", {
                method: "POST",
                body: JSON.stringify(
                    batch.map(x => ({
                        "query": x.ip,
                        "fields": "status,country,lat,lon,query"
                    }))
                )
            });
            ips_info = await res.json();
        }

        // Format output
        for (let j=0; j<batch.length; j++) {
            if (ips_info[j].status && ips_info[j].status == "fail") { continue; }
            out_bans.push({
                "ip": batch[j].ip,
                "jail_name": batch[j].jail_name,
                "timestamp": batch[j].timestamp,
                "country": ips_info[j].country as string,
                "lat": ips_info[j].lat as number,
                "lon": ips_info[j].lon as number,
            })
        }
    }

    return out_bans
}



export async function storeBansInDb(bans_from_log: BanWithoutLocation[], db: Database) {
    let bans_not_in_db: BanWithoutLocation[] = [];

    // Check which ban is not recorded in DB.
    for (const ban of bans_from_log) {
        const res = await db.get("SELECT ip FROM bans WHERE ip=@ip AND timestamp=@timestamp LIMIT 1;", { "@ip": ban.ip, "@timestamp": ban.timestamp });
        if (!res) {
            bans_not_in_db.push(ban);
        }
    }

    const bans: Ban[] = await addLocationInfo(bans_not_in_db);

    // Store new bans.
    for (const ban of bans) {
        try {
            await db.run(
                "INSERT INTO bans (ip, jail_name, timestamp, country, lat, lon) VALUES (?, ?, ?, ?, ?, ?) ;", 
                ban.ip, ban.jail_name, ban.timestamp, ban.country, ban.lat, ban.lon
            );
        }
        catch (error) {
            console.error(error);
            if (error.code != "SQLITE_CONSTRAINT") {
                throw error;
            }
        }
    }
}


export async function storeBansFromLog(logs_path: string, db: Database) {
    const log_bans = await loadBansFromLog(logs_path);
    await storeBansInDb(log_bans, db);
}


export async function storeBan(ban: BanWithoutLocation, db: Database) {
    await storeBansInDb([ban], db);
}


export async function fetchBans(
    db: Database, 
    page_number: number|null=null, page_size: number|null=null,
    start_time: number|null=null, end_time: number|null=null,
    jail_name: string|null = null
) : Promise<Ban[]> {
    /**
     * Fetches the bans stored in DB.
     * It is possible to paginate the response, filter by date and jail name.
     */
    let query = "SELECT * FROM bans <WHERE-CLAUSE> ORDER BY timestamp DESC";
    let where_clauses: string[] = [];
    if (start_time != null && end_time != null) {
        where_clauses.push("timestamp BETWEEN @start_time AND @end_time");
    }
    if (jail_name != null) {
        where_clauses.push("jail_name = @jail_name");
    }
    if (page_number != null && page_size != null) {
        query += " LIMIT @page_size OFFSET @page_offset";
    }

    query = query.replace("<WHERE-CLAUSE>", where_clauses.length > 0 ? `WHERE ${where_clauses.join(" AND ")}` : "");

    const stmt = await db.prepare(query);
    let params = {}
    if (start_time != null && end_time != null) {
        params["@start_time"] = start_time;
        params["@end_time"] = end_time;
    }
    if (jail_name != null) {
        params["@jail_name"] = jail_name;
    }
    if (page_number != null && page_size != null) {
        params["@page_size"] = page_size;
        params["@page_offset"] = page_size*page_number;
    }
    await stmt.bind(params);
    const res: Ban[] = await stmt.all();

    return res.map(x => ({
        ip: x.ip,
        jail_name: x.jail_name,
        timestamp: x.timestamp,
        country: x.country,
        lat: x.lat,
        lon: x.lon
    }));
}