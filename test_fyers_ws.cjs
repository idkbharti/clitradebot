require('dotenv').config();
const fyersApiV3 = require("fyers-api-v3");
const { fyersDataSocket } = fyersApiV3;
const fs = require("fs");
const tokenData = JSON.parse(fs.readFileSync("src/data/token.json", "utf8"));
const appId = process.env.FYERS_CLIENT_ID || "M9R4G84YXY-100";
const authFormat = `${appId}:${tokenData.access_token}`;

const skt = fyersDataSocket.getInstance(authFormat, "src/data");

skt.on("connect", () => {
    console.log("Connected!");
    skt.subscribe(["NSE:RELIANCE-EQ"]);
});

skt.on("message", (msg) => {
    console.log("Msg:", JSON.stringify(msg));
});

skt.on("error", (err) => {
    console.error("Error:", err);
});

skt.connect();
setTimeout(() => { console.log("Done"); process.exit(0); }, 5000);
