import app from './app.ts'
import { env } from './config/env.ts'
import { startMarketScanner } from "./scripts/marketScanner.ts";

console.log("CLIENT ID:", env.FYERS_CLIENT_ID);
console.log("REDIRECT URI:", env.FYERS_REDIRECT_URI);

app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`)
    startMarketScanner();
})
