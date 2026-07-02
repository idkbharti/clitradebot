import { initDataSocket, subscribeToSymbol } from "./src/core/FyersAPI.ts";
import { env } from "./src/config/env.ts";
subscribeToSymbol("NSE:RELIANCE-EQ");
initDataSocket((msg) => {
    console.log("TICK:", msg);
});
setTimeout(() => process.exit(0), 10000);
