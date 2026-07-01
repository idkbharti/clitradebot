import express from "express";
import path from "path";
import apiRoutes from "./routes/api.ts";

const app = express();

app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(process.cwd(), 'public')));

app.use("/api", apiRoutes);

app.get("/health", (_, res) => {
    res.json({ success: true });
});

export default app;