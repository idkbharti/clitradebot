import { Router } from "express";
import { NIFTY_100 } from "../services/fyers/nifty100.ts";
import { getQuotes } from "../services/fyers/getQuotes.ts";

const router = Router();

import { getTopGainers } from "../scanners/topGainers.ts";

router.get("/top-gainers", async (_, res) => {
    try {
        const data = await getQuotes(NIFTY_100);

        const gainers = getTopGainers(data);

        return res.json({
            count: gainers.length,
            data: gainers,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error,
        });
    }
});

export default router;