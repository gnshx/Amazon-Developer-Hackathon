import express, { Request, Response, NextFunction } from "express";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { IdempotencyService } from "../idempotency/service.js";
import { createAdminRouter } from "../admin/routes.js";
import { evaluatePolicy, isToolInScope } from "../policy/engine.js";
import { canonicalSha256 } from "../crypto/canonical.js";
import { Grant, Plan, PlanAction } from "../types.js";
import { randomUUID } from "node:crypto";

export interface GatewayServerOptions {
  repo?: WarrantRepository;
  port?: number;
}

export function createGatewayApp(options: GatewayServerOptions = {}) {
  const app = express();
  app.use(express.json());

  const repo = options.repo ?? new WarrantRepository();
  const approvalService = new ApprovalService(repo);
  const idempotencyService = new IdempotencyService(repo);

  // Mount Out-of-band Admin Channel (Inaccessible to agent via MCP)
  app.use("/admin", createAdminRouter(repo, approvalService));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", protocolVersion: "2025-11-25" });
  });

  // Bearer Token Authentication Middleware for /mcp
  const requireGrantAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32001,
          message: "Unauthorized: Missing or invalid Authorization Bearer token."
        }
      });
    }

    const token = authHeader.slice(7).trim();
    const grant = repo.getGrantBySessionToken(token);

    if (!grant) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32001,
          message: "Unauthorized: No active grant found for provided token."
        }
      });
    }

    if (grant.status === "REVOKED") {
      return res.status(403).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32002,
          message: `Forbidden: Grant ${grant.id} has been revoked by user.`
        }
      });
    }

    if (new Date().getTime() >= new Date(grant.expiresAt).getTime() || grant.status === "EXPIRED") {
      return res.status(403).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32003,
          message: `Forbidden: Grant ${grant.id} expired at ${grant.expiresAt}.`
        }
      });
    }

    (req as any).grant = grant;
    next();
  };

  // MCP Streamable HTTP GET handshake
  app.get("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.json({
      name: "warrant-gateway",
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} }
    });
  });

  // MCP Streamable HTTP POST endpoint
  app.post("/mcp", requireGrantAuth, async (req: Request, res: Response) => {
    const grant: Grant = (req as any).grant;
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" }
      });
    }

    // 1. MCP initialize
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-11-25",
          serverInfo: { name: "warrant-gateway", version: "1.0.0" },
          capabilities: { tools: {} }
        }
      });
    }

    // 2. MCP tools/list
    if (method === "tools/list") {
      const allTools = [
        {
          name: "search_hotels",
          description: "Search for hotels in a destination city. Risk tier T0 (read-only).",
          inputSchema: {
            type: "object",
            properties: {
              destination: { type: "string" },
              nights: { type: "number" }
            },
            required: ["destination"]
          }
        },
        {
          name: "search_trains",
          description: "Search for train connections between origin and destination. Risk tier T0 (read-only).",
          inputSchema: {
            type: "object",
            properties: {
              origin: { type: "string" },
              destination: { type: "string" }
            },
            required: ["origin", "destination"]
          }
        },
        {
          name: "search_restaurants",
          description: "Search dining and table availability in a city. Risk tier T0 (read-only).",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string" },
              cuisine: { type: "string" }
            },
            required: ["city"]
          }
        },
        {
          name: "propose_plan",
          description: "Propose a multi-step travel or transaction plan. Evaluates spend caps and creates approvals for T2 steps.",
          inputSchema: {
            type: "object",
            properties: {
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    toolName: { type: "string" },
                    params: { type: "object" },
                    estimatedCostMinor: { type: "number" },
                    compensationTool: { type: "string" },
                    compensationParams: { type: "object" }
                  },
                  required: ["toolName", "params", "estimatedCostMinor"]
                }
              }
            },
            required: ["steps"]
          }
        },
        {
          name: "execute_plan",
          description: "Execute an approved plan. Enforces idempotency, spend cap, and cryptographic approval parameter binding.",
          inputSchema: {
            type: "object",
            properties: {
              planId: { type: "string" },
              idempotencyKey: { type: "string" },
              approvals: {
                type: "object",
                description: "Map of actionId or toolName to approvalToken"
              }
            },
            required: ["planId", "idempotencyKey"]
          }
        },
        {
          name: "get_plan_status",
          description: "Retrieve plan execution status, remaining spend, and step compensation states.",
          inputSchema: {
            type: "object",
            properties: { planId: { type: "string" } },
            required: ["planId"]
          }
        },
        {
          name: "request_cancellation",
          description: "Compensating action to cancel an existing booking idempotently.",
          inputSchema: {
            type: "object",
            properties: {
              bookingRef: { type: "string" },
              idempotencyKey: { type: "string" }
            },
            required: ["bookingRef", "idempotencyKey"]
          }
        }
      ];

      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: allTools.filter((t) => isToolInScope(t.name, grant.scopes))
        }
      });
    }

    // 3. MCP tools/call
    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      // Scope check
      if (!isToolInScope(toolName, grant.scopes)) {
        return res.status(403).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32004,
            message: `Scope Violation: Tool '${toolName}' is not authorized by grant scopes.`
          }
        });
      }

      try {
        let toolResult: any;

        if (toolName === "search_hotels") {
          const destination = toolArgs.destination || "City Center";
          const hotels = [
            { id: "hotel_grand", name: "Grand Plaza Hotel", priceMinor: 12000, rating: 4.8 },
            { id: "hotel_boutique", name: "Harbor Boutique Inn", priceMinor: 9500, rating: 4.6 }
          ];
          toolResult = {
            data: { destination, hotels },
            spoken_summary: `Found 2 hotels in ${destination} starting at $95.00 per night.`
          };
        } else if (toolName === "search_trains") {
          const origin = toolArgs.origin || "Station A";
          const destination = toolArgs.destination || "Station B";
          const trains = [
            { id: "train_exp_1", departure: "08:30", priceMinor: 4500, duration: "1h 45m" },
            { id: "train_exp_2", departure: "11:15", priceMinor: 5200, duration: "1h 40m" }
          ];
          toolResult = {
            data: { origin, destination, trains },
            spoken_summary: `Found 2 trains from ${origin} to ${destination} starting at $45.00.`
          };
        } else if (toolName === "search_restaurants") {
          const city = toolArgs.city || "Downtown";
          const cuisine = toolArgs.cuisine || "Italian";
          toolResult = {
            data: { city, cuisine, places: ["Trattoria Bella", "Osteria Roma"] },
            spoken_summary: `Found top ${cuisine} dining options in ${city} with open tables.`
          };
        } else if (toolName === "propose_plan") {
          const stepsInput = toolArgs.steps as any[];
          if (!Array.isArray(stepsInput) || stepsInput.length === 0) {
            return res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "propose_plan requires non-empty steps array" }
            });
          }

          let totalEstimatedMinor = 0;
          const planId = `plan_${randomUUID().replace(/-/g, "")}`;
          const planActions: PlanAction[] = [];
          const pendingApprovalItems: any[] = [];

          for (let i = 0; i < stepsInput.length; i++) {
            const step = stepsInput[i];
            const cost = Number(step.estimatedCostMinor ?? 0);
            totalEstimatedMinor += cost;

            const decision = evaluatePolicy(grant, {
              toolName: step.toolName,
              estimatedCostMinor: cost
            });

            if (!decision.allowed) {
              return res.status(400).json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32005,
                  message: `Policy Rejection on step ${i + 1} (${step.toolName}): ${decision.reasonMessage}`
                }
              });
            }

            const actionId = `act_${randomUUID().replace(/-/g, "")}`;
            const paramsCanonical = JSON.stringify(step.params);
            const paramsHash = canonicalSha256(step.params);
            const actionState = decision.requiresApproval ? "PENDING_APPROVAL" : "PROPOSED";

            planActions.push({
              id: actionId,
              planId,
              seq: i + 1,
              toolName: step.toolName,
              params: step.params,
              paramsCanonical,
              paramsHash,
              riskTier: decision.riskTier,
              state: actionState,
              idempotencyKey: step.idempotencyKey ?? `step_${actionId}`,
              estimatedCostMinor: cost,
              compensationTool: step.compensationTool,
              compensationParams: step.compensationParams
            });
          }

          // Enforce Total Spend Cap across the entire plan - Invariant I2
          if (grant.spentMinor + totalEstimatedMinor > grant.spendCapMinor) {
            return res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32006,
                message: `Spend Cap Exceeded: Total plan cost ($${(totalEstimatedMinor / 100).toFixed(2)}) exceeds remaining grant cap ($${((grant.spendCapMinor - grant.spentMinor) / 100).toFixed(2)}).`
              }
            });
          }

          const plan: Plan = {
            id: planId,
            grantId: grant.id,
            state: "PROPOSED",
            totalEstimatedMinor,
            totalConfirmedMinor: 0,
            actions: planActions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Save plan and actions first to satisfy foreign key references
          repo.createPlan(plan);

          for (const action of planActions) {
            if (action.riskTier === "T2") {
              const approval = approvalService.createPendingApproval(action.id, planId, action.params);
              pendingApprovalItems.push({
                actionId: action.id,
                toolName: action.toolName,
                params: action.params,
                paramsHash: action.paramsHash,
                approvalId: approval.id,
                status: "PENDING"
              });
            }
          }

          const needsApproval = pendingApprovalItems.length > 0;
          const spoken = needsApproval
            ? `I prepared a plan with ${planActions.length} steps totaling $${(totalEstimatedMinor / 100).toFixed(2)}. ${pendingApprovalItems.length} step requires your approval on your phone.`
            : `I prepared a plan with ${planActions.length} steps totaling $${(totalEstimatedMinor / 100).toFixed(2)}, ready to execute.`;

          toolResult = {
            data: {
              planId,
              state: "PROPOSED",
              totalEstimatedMinor,
              actions: planActions.map((a) => ({
                id: a.id,
                seq: a.seq,
                toolName: a.toolName,
                riskTier: a.riskTier,
                state: a.state,
                estimatedCostMinor: a.estimatedCostMinor
              })),
              pendingApprovals: pendingApprovalItems
            },
            spoken_summary: spoken
          };
        } else if (toolName === "execute_plan") {
          const planId = toolArgs.planId;
          const idempotencyKey = toolArgs.idempotencyKey;
          const userApprovals = toolArgs.approvals || {};

          if (!planId || !idempotencyKey) {
            return res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing required fields: planId, idempotencyKey" }
            });
          }

          const plan = repo.getPlanById(planId);
          if (!plan) {
            return res.status(404).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32007, message: `Plan ${planId} not found` }
            });
          }

          // Execute with strict Idempotency (Invariant I1)
          const executionResult = await idempotencyService.executeWithIdempotency(
            grant.id,
            "execute_plan",
            idempotencyKey,
            { planId, userApprovals },
            async () => {
              // 1. Verify all T2 actions have approved, untampered approval tokens (Invariant I3)
              for (const act of plan.actions) {
                if (act.riskTier === "T2") {
                  let token = userApprovals[act.id] || userApprovals[act.toolName];
                  if (!token) {
                    const storedApproval = repo.getApprovalByActionId(act.id);
                    if (storedApproval && storedApproval.status === "APPROVED") {
                      token = storedApproval.approvalToken;
                    }
                  }

                  if (!token) {
                    throw new Error(`APPROVAL_REQUIRED: Action ${act.toolName} (id: ${act.id}) requires phone approval token.`);
                  }

                  const verifyResult = approvalService.verifyApprovalToken(token, act.params);
                  if (!verifyResult.valid) {
                    throw new Error(`APPROVAL_VALIDATION_FAILED: ${verifyResult.reason}`);
                  }
                }
              }

              // 2. Execute plan steps sequentially
              repo.updatePlanState(planId, "EXECUTING");
              let confirmedSpend = 0;
              const stepResults: any[] = [];

              for (const act of plan.actions) {
                repo.updateActionState(act.id, "EXECUTING");
                const cost = act.estimatedCostMinor;

                // Simulate booking success (wired to external providers in Phase 3)
                const bookingRef = `bk_${act.toolName}_${randomUUID().slice(0, 8)}`;
                const payload = { bookingRef, status: "CONFIRMED", costMinor: cost };

                repo.updateActionState(act.id, "SUCCEEDED", payload, cost);
                confirmedSpend += cost;
                stepResults.push({ actionId: act.id, toolName: act.toolName, ...payload });

                repo.appendAuditEvent("ACTION_SUCCEEDED", act.id, {
                  toolName: act.toolName,
                  bookingRef,
                  costMinor: cost
                });
              }

              // 3. Deduct total confirmed spend from grant - Invariant I2
              repo.updateGrantSpent(grant.id, confirmedSpend);
              repo.updatePlanState(planId, "COMPLETED");

              return {
                planId,
                state: "COMPLETED",
                confirmedSpendMinor: confirmedSpend,
                results: stepResults,
                spoken_summary: `Your trip is booked and confirmed! Total charge was $${(confirmedSpend / 100).toFixed(2)}.`
              };
            }
          );

          toolResult = {
            data: executionResult.result,
            spoken_summary: executionResult.result.spoken_summary,
            cached: executionResult.cached
          };
        } else if (toolName === "get_plan_status") {
          const plan = repo.getPlanById(toolArgs.planId);
          if (!plan) {
            return res.status(404).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32007, message: `Plan ${toolArgs.planId} not found` }
            });
          }
          toolResult = {
            data: plan,
            spoken_summary: `Plan ${plan.id} is currently ${plan.state.toLowerCase()} with ${plan.actions.length} steps.`
          };
        } else if (toolName === "request_cancellation") {
          toolResult = {
            data: { bookingRef: toolArgs.bookingRef, status: "CANCELLED" },
            spoken_summary: `Booking ${toolArgs.bookingRef} has been cancelled.`
          };
        } else {
          return res.status(404).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: Tool '${toolName}'` }
          });
        }

        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(toolResult.data)
              }
            ],
            spoken_summary: toolResult.spoken_summary,
            cached: toolResult.cached
          }
        });
      } catch (err: any) {
        return res.status(500).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: err.message }
        });
      }
    }

    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method '${method}'` }
    });
  });

  return { app, repo, approvalService, idempotencyService };
}
