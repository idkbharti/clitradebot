import dotenv from 'dotenv';
dotenv.config();

export const env = {
    PORT: process.env.PORT || 5000,

    FYERS_CLIENT_ID: process.env.FYERS_CLIENT_ID || "",
    FYERS_SECRET_KEY: process.env.FYERS_SECRET_KEY || "",
    FYERS_REDIRECT_URI: process.env.FYERS_REDIRECT_URI || "",

    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
}
