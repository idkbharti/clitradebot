import { Router } from "express";
import { getHistory } from "../services/fyers/getHistory.ts";

const router = Router();

router.get("/:symbol", async (req, res) => {
    try {
        const symbol = decodeURIComponent(req.params.symbol);

        const data = await getHistory({
            symbol,
            resolution: "D",
            days: 100,
        });

        res.json(data);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error,
        });
    }
});

export default router;