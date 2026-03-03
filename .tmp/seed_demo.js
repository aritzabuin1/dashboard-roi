const API_KEY = "sk_7e44992f79bb18d94e5d29eff8ad115c";
const WEBHOOK_URL = "http://localhost:3000/api/execution-webhook";

async function send(name, status, timestamp) {
    const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: API_KEY, automation_name: name, status, timestamp })
    });
    console.log(`  ${res.status === 200 ? '✓' : '✗'} ${name} [${status}] -> HTTP ${res.status}`);
}

async function run() {
    const now = new Date();
    const d = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const D1 = d(1), D2 = d(2), D3 = d(3), D4 = d(4), D5 = d(5), D6 = d(6);
    const NOW = now.toISOString();

    console.log("--- Clasificador de Emails ---");
    await send("Clasificador de Emails", "success", D6);
    await send("Clasificador de Emails", "success", D5);
    await send("Clasificador de Emails", "success", D4);
    await send("Clasificador de Emails", "error", D4);
    await send("Clasificador de Emails", "success", D3);
    await send("Clasificador de Emails", "success", D2);
    await send("Clasificador de Emails", "success", D1);
    await send("Clasificador de Emails", "success", NOW);

    console.log("\n--- Procesado de Facturas ---");
    await send("Procesado de Facturas", "success", D5);
    await send("Procesado de Facturas", "success", D3);
    await send("Procesado de Facturas", "error", D3);
    await send("Procesado de Facturas", "success", D2);
    await send("Procesado de Facturas", "success", D1);
    await send("Procesado de Facturas", "success", NOW);

    console.log("\n--- Generación de Informes ---");
    await send("Generacion de Informes", "success", D6);
    await send("Generacion de Informes", "success", D4);
    await send("Generacion de Informes", "success", D2);
    await send("Generacion de Informes", "success", NOW);

    console.log("\n--- Sync CRM ---");
    await send("Sync CRM", "success", D5);
    await send("Sync CRM", "success", D4);
    await send("Sync CRM", "success", D3);
    await send("Sync CRM", "error", D2);
    await send("Sync CRM", "success", D1);
}

run().catch(console.error);
