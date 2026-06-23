import { createFyersClient } from "./fyersClient.ts";

export async function getQuotes(symbols: string[]) {
    const fyers = createFyersClient();

    return fyers.getQuotes(symbols);
}