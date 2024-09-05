export type BanWithoutLocation = {
    ip: string;
    timestamp: number;
    jail_name: string;
}


export type Ban = BanWithoutLocation & {
    country: string;
    lat: number;
    lon: number;
}