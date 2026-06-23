import express from "express";
import authRoutes from "./routes/auth.ts";
import profileRoutes from "./routes/profile.ts";
import scannerRoutes from "./routes/scanner.ts";
import historyRoutes from "./routes/history.ts";


const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/history", historyRoutes);
app.use("/profile", profileRoutes);

app.use("/scanner", scannerRoutes);

app.get("/health", (_, res) => {
    res.json({ success: true });
});

export default app;