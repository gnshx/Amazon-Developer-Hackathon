/**
 * Naive Unprotected Booking Server (DEMO ONLY)
 *
 * ⚠️ WARNING: Intentionally insecure implementation demonstrating failure modes
 * when voice assistants execute real-world actions without Warrant's transactional safety layer.
 */

import express from "express";

export function createNaiveApp() {
  const app = express();
  app.use(express.json());

  const bookings: any[] = [];
  let totalSpentMinor = 0;

  // MCP JSON-RPC 2.0 endpoint (Unprotected)
  app.post("/mcp", (req, res) => {
    const { id, method, params } = req.body;

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "search_hotels",
              description: "Search hotels (Naive)",
              inputSchema: { type: "object", properties: { destination: { type: "string" } } }
            },
            {
              name: "book_hotel",
              description: "Book hotel (Naive - No idempotency, no approvals)",
              inputSchema: { type: "object", properties: { hotelId: { type: "string" }, priceMinor: { type: "number" } } }
            },
            {
              name: "execute_trip_plan",
              description: "Execute multi-step plan (Naive - No saga rollback)",
              inputSchema: { type: "object", properties: { plan: { type: "object" } } }
            }
          ]
        }
      });
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params;

      // 1. Booking: NO idempotency, NO spend cap, NO approval verification
      if (name === "book_hotel" || name === "execute_booking") {
        const bookingId = `naive_book_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        bookings.push({ id: bookingId, ...args, timestamp: new Date().toISOString() });
        totalSpentMinor += args.priceMinor || 10000;

        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "CONFIRMED",
                  bookingId,
                  totalBookingsCreated: bookings.length,
                  totalSpentMinor
                })
              }
            ],
            spoken_summary: `Booked hotel successfully. Total bookings: ${bookings.length}.`
          }
        });
      }

      // 2. Multi-step Trip Plan: NO saga rollback on failure
      if (name === "execute_trip_plan") {
        // Step 1: Hotel succeeds
        const hotelId = `naive_htl_${Date.now()}`;
        bookings.push({ id: hotelId, type: "hotel", priceMinor: 12000 });
        totalSpentMinor += 12000;

        // Step 2: Train fails mid-flight
        // NAIVE ERROR: Leaves hotel booked with zero compensation!
        return res.status(500).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "Train service unavailable. (Notice: Hotel booking was NOT rolled back!)"
          }
        });
      }

      if (name === "search_hotels") {
        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify([{ id: "h1", name: "Grand Hotel", priceMinor: 12000 }]) }],
            spoken_summary: "Found 1 hotel."
          }
        });
      }
    }

    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Tool not found" }
    });
  });

  return { app, getBookings: () => [...bookings], getTotalSpent: () => totalSpentMinor };
}

if (process.argv[1]?.endsWith("index.ts")) {
  const { app } = createNaiveApp();
  const PORT = process.env.PORT || 8088;
  app.listen(PORT, () => {
    console.log(`⚠️  Naive Unprotected Booking Server listening on port ${PORT}`);
    console.log(`   (Demonstration only: Zero idempotency, zero saga rollback, zero spend caps)`);
  });
}
