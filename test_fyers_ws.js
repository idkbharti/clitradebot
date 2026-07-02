const { fyersDataSocket } = require("fyers-api-v3");
const fs = require("fs");
const tokenData = JSON.parse(fs.readFileSync("src/data/token.json", "utf8"));
const appId = process.env.FYERS_CLIENT_ID || "M9R4G84YXY-100"; // Fallback just in case
const authFormat = `${appId}:${tokenData.access_token}`;

const skt = fyersDataSocket.getInstance(authFormat, "./logs");

skt.on("connect", () => {
    console.log("Connected!");
    skt.subscribe(["NSE:RELIANCE-EQ"]);
});

skt.on("message", (msg) => {
    console.log("Tick:", JSON.stringify(msg));
    process.exit(0);
});

skt.on("error", (err) => {
    console.error("Error:", err);
    process.exit(1);
});

skt.connect();
setTimeout(() => { console.log("Timeout"); process.exit(1); }, 5000);
