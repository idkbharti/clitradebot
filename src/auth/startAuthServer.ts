import app from "../app.ts";

export function startAuthServer() {
    return app.listen(5000, () => {
        console.log("✅ Auth server running on 5000");
    });
}