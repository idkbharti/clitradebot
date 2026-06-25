import express from "express";
import path from "path";
import authRoutes from "./routes/auth.ts";
import profileRoutes from "./routes/profile.ts";
import scannerRoutes from "./routes/scanner.ts";
import historyRoutes from "./routes/history.ts";
import dashboardRoutes from "./routes/dashboard.ts";

const app = express();

app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(process.cwd(), 'public')));

app.use("/auth", authRoutes);
app.use("/history", historyRoutes);
app.use("/profile", profileRoutes);
app.use("/scanner", scannerRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/health", (_, res) => {
    res.json({ success: true });
});

export default app;