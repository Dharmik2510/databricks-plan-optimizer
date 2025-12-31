require("dotenv").config();
const { ChromaClient } = require("chromadb");

async function run() {
    const apiKey = process.env.CHROMA_API_KEY;
    const tenant = process.env.CHROMA_TENANT;
    const database = process.env.CHROMA_DATABASE;

    const client = new ChromaClient({
        // IMPORTANT: Chroma Cloud commonly uses :8000
        path: "https://api.trychroma.com",
        tenant,
        database,
        auth: {
            provider: "token",
            credentials: apiKey,
            // IMPORTANT: Chroma Cloud examples often require this header type
            tokenHeaderType: "X_CHROMA_TOKEN",
        },
    });

    // Heartbeat may succeed even without auth, so don't trust it as auth validation.
    console.log("Heartbeat:", await client.heartbeat());

    // This is the real auth test:
    const cols = await client.listCollections();
    console.log("Collections Raw:", JSON.stringify(cols, null, 2));
}

run().catch((e) => {
    console.error("ERROR:", e?.message || e);
    process.exit(1);
});
