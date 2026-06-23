import { fyersModel } from "fyers-api-v3";
import { env } from "../../config/env.ts";
import { getToken } from "./token.service.ts";

export function createFyersClient() {
    const tokenData = getToken();

    if (!tokenData) {
        throw new Error("Token not found");
    }

    const fyers = new fyersModel();

    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setAccessToken(tokenData.access_token);

    return fyers;
}