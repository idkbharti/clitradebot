import { createFyersClient } from "./fyersClient.ts";

interface HistoryParams {
    symbol: string;
    resolution?: string;
    days?: number;
}

export async function getHistory({
    symbol,
    resolution = "D",
    days = 100,
}: HistoryParams) {
    const fyers = createFyersClient();

    const rangeTo = Math.floor(Date.now() / 1000);
    const rangeFrom = rangeTo - days * 24 * 60 * 60;

    return fyers.getHistory({
        symbol,
        resolution,
        date_format: "0",
        range_from: rangeFrom.toString(),
        range_to: rangeTo.toString(),
        cont_flag: "1",
    });
}