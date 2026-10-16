import { createGatewayApp } from "./mcp/server.js";
import { WarrantRepository } from "./storage/db.js";

export * from "./types.js";
export * from "./crypto/canonical.js";
export * from "./policy/engine.js";
export * from "./audit/chain.js";
export * from "./storage/db.js";
export * from "./approval/service.js";
export * from "./idempotency/service.js";
export * from "./receipt/service.js";
export * from "./mcp/server.js";
export * from "./providers/train.js";
export * from "./providers/hotel.js";
export * from "./providers/restaurant.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
const DB_PATH = process.env.DB_PATH || "warrant.sqlite";

if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  const repo = new WarrantRepository(DB_PATH);
  const { app } = createGatewayApp({ repo, port: PORT });

  app.listen(PORT, () => {
    console.log(`[Warrant Gateway] Listening on http://localhost:${PORT}`);
    console.log(`[Warrant Gateway] MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`[Warrant Gateway] Admin API:    http://localhost:${PORT}/admin`);
  });
}
