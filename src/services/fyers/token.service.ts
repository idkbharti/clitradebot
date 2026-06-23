import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "src/data");
const TOKEN_FILE = path.join(DATA_DIR, "token.json");

export function saveToken(data: any) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(
        TOKEN_FILE,
        JSON.stringify(data, null, 2)
    );
}

export function getToken() {
    try {
        const data = fs.readFileSync(TOKEN_FILE, "utf8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}