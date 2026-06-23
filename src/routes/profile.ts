import { Router } from "express";
import { fyersModel } from "fyers-api-v3";
import { getToken } from "../services/fyers/token.service.ts";
import { env } from "../config/env.ts";

const router = Router();

router.get("/", async (_, res) => {
    try {
        const tokenData = getToken();

        if (!tokenData) {
            return res.status(401).json({
                success: false,
                message: "Token not found",
            });
        }

        const fyers = new fyersModel();

        fyers.setAppId(env.FYERS_CLIENT_ID);
        fyers.setAccessToken(tokenData.access_token);

        console.log("APP ID:", env.FYERS_CLIENT_ID);
        console.log("TOKEN:", tokenData.access_token?.substring(0, 20));

        const profile = await fyers.get_profile();

        return res.json(profile);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error,
        });
    }
});

export default router;