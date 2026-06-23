import fs from "fs";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "src/data/token.json");

export const state = {
    running: false,
    interval: null as NodeJS.Timeout | null,
};

export function getToken() {
    try {
        return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    } catch {
        return null;
    }
}

export function hasToken() {
    return !!getToken();
}