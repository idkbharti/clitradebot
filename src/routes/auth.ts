import { Router } from "express";
import { fyersModel } from "fyers-api-v3";
import { env } from "../config/env.ts";
import { saveToken } from "../services/fyers/token.service.ts";

const router = Router();

const fyers = new fyersModel();

router.get("/login", async (_, res) => {
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);

    const url = fyers.generateAuthCode();

    res.redirect(url);
});

router.get("/callback", async (req, res) => {
    try {
        const authCode = req.query.auth_code as string;

        const response = await fyers.generate_access_token({
            client_id: env.FYERS_CLIENT_ID,
            secret_key: env.FYERS_SECRET_KEY,
            auth_code: authCode,
        });

        // console.log("TOKEN RESPONSE:", response);

        if (response.s !== "ok") {
            return res.status(400).json(response);
        }

        saveToken(response);

        res.json({
            success: true,
            message: "Token saved successfully",
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error,
        });
    }
});

export default router;