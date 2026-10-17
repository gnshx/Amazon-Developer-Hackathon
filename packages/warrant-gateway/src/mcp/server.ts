import express, { Request, Response, NextFunction } from "express";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { IdempotencyService } from "../idempotency/service.js";
import { createAdminRouter } from "../admin/routes.js";
import { evaluatePolicy, isToolInScope } from "../policy/engine.js";
import { canonicalSha256 } from "../crypto/canonical.js";
import { Grant, Plan, PlanAction } from "../types.js";
import { randomUUID } from "node:crypto";

import { SagaOrchestrator } from "../saga/orchestrator.js";
import { ReceiptService } from "../receipt/service.js";
import { MockHotelProvider } from "../providers/hotel.js";
import { MockTrainProvider } from "../providers/train.js";
import { MockRestaurantProvider } from "../providers/restaurant.js";
import { FaultType, IMockProvider } from "../providers/types.js";
import { createDemoOAuthRouter } from "../auth/demo-oauth.js";

export interface GatewayServerOptions {
  repo?: WarrantRepository;
  approvalService?: ApprovalService;
  port?: number;
  hotelProvider?: MockHotelProvider;
  trainProvider?: MockTrainProvider;
  restaurantProvider?: MockRestaurantProvider;
  receiptService?: ReceiptService;
  disableUserIsolation?: boolean;
}

export function createGatewayApp(options: GatewayServerOptions = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const disableUserIsolation = options.disableUserIsolation ?? false;
  const repo = options.repo ?? new WarrantRepository();
  const approvalService = options.approvalService ?? new ApprovalService(repo);
  const idempotencyService = new IdempotencyService(repo);
  const receiptService = options.receiptService ?? new ReceiptService(repo);

  const hotelProvider = options.hotelProvider ?? new MockHotelProvider();
  const trainProvider = options.trainProvider ?? new MockTrainProvider();
  const restaurantProvider = options.restaurantProvider ?? new MockRestaurantProvider();

  const sagaOrchestrator = new SagaOrchestrator(
    repo,
    approvalService,
    hotelProvider,
    trainProvider,
    restaurantProvider,
    receiptService
  );

  // Mount Demo OAuth 2.1 Server (RFC 8414, RFC 7636 PKCE S256, RFC 8707)
  app.use(createDemoOAuthRouter(repo));

  // Mount Out-of-band Admin Channel (Inaccessible to agent via MCP)
  app.use("/admin", createAdminRouter(repo, approvalService, sagaOrchestrator, receiptService));

  // Provider Control & Verification API (For adversarial harness & testing)
  app.post("/admin/providers/:name/fault", (req: Request, res: Response) => {
    const name = String(req.params.name).toLowerCase();
    const { fault, calls } = req.body as { fault: FaultType; calls?: number };
    let provider: IMockProvider | null = null;
    if (name === "hotel") provider = hotelProvider;
    if (name === "train") provider = trainProvider;
    if (name === "restaurant") provider = restaurantProvider;

    if (!provider) {
      return res.status(404).json({ error: `Provider '${name}' not found` });
    }

    provider.injectFault(fault, calls ?? 1);
    return res.json({
      status: "fault_injected",
      provider: name,
      fault,
      calls: calls ?? 1
    });
  });

  app.get("/admin/providers/:name/bookings", (req: Request, res: Response) => {
    const name = String(req.params.name).toLowerCase();
    let provider: IMockProvider | null = null;
    if (name === "hotel") provider = hotelProvider;
    if (name === "train") provider = trainProvider;
    if (name === "restaurant") provider = restaurantProvider;

    if (!provider) {
      return res.status(404).json({ error: `Provider '${name}' not found` });
    }

    const bookings = provider.getBookings();
    return res.json({
      provider: name,
      count: bookings.length,
      bookings
    });
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", protocolVersion: "2025-11-25" });
  });

  // Receipts API (Non-repudiable Proof Verification)
  app.get("/receipts/public-key", (_req: Request, res: Response) => {
    res.json({ publicKey: receiptService.getPublicKeyPem() });
  });

  app.get("/receipts/:id", (req: Request, res: Response) => {
    const receipt = receiptService.getReceipt(String(req.params.id));
    if (!receipt) return res.status(404).json({ error: "Receipt not found" });
    return res.json({ receipt });
  });

  app.post("/receipts/verify", (req: Request, res: Response) => {
    const { receipt, expectedPublicKey } = req.body;
    if (!receipt) return res.status(400).json({ error: "Missing receipt object" });
    const result = ReceiptService.verifyReceipt(receipt, expectedPublicKey);
    return res.json(result);
  });

  // RFC 9728 OAuth 2.0 / 2.1 Protected Resource Metadata
  app.get("/.well-known/oauth-protected-resource", (req: Request, res: Response) => {
    const host = req.get("host") || "localhost:8000";
    const protocol = req.protocol;
    res.setHeader("Content-Type", "application/json");
    res.json({
      resource: `${protocol}://${host}/mcp`,
      authorization_servers: [
        `${protocol}://${host}`,
        "https://auth.amazon.com/oauth2/v2"
      ],
      scopes_supported: ["hotel:search", "hotel:book", "train:search", "train:book", "dining:search", "dining:book"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://github.com/gnshx/Amazon-Developer-Hackathon"
    });
  });

  // Bearer Token Authentication Middleware for /mcp
  const requireGrantAuth = (req: Request, res: Response, next: NextFunction) => {
    // Reject tokens in query parameters per Alexa+ checklist (header-only tokens)
    if (req.query.token || req.query.access_token || req.query.bearer_token) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32000,
          message: "Bad Request: Bearer tokens in query parameters are strictly forbidden. Pass token in 'Authorization: Bearer <token>' header only."
        }
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.setHeader("WWW-Authenticate", 'Bearer resource_metadata="/.well-known/oauth-protected-resource", error="invalid_token"');
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
      res.setHeader("WWW-Authenticate", 'Bearer resource_metadata="/.well-known/oauth-protected-resource", error="invalid_token"');
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
  app.get("/mcp", (req: Request, res: Response) => {
    if (req.query.token || req.query.access_token || req.query.bearer_token) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Bearer tokens in query parameters are strictly forbidden. Pass token in 'Authorization: Bearer <token>' header only."
      });
    }
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
          annotations: {
            readOnly: true,
            destructive: false,
            idempotent: true,
            riskTier: "T0"
          },
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
          annotations: {
            readOnly: true,
            destructive: false,
            idempotent: true,
            riskTier: "T0"
          },
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
          annotations: {
            readOnly: true,
            destructive: false,
            idempotent: true,
            riskTier: "T0"
          },
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
          annotations: {
            readOnly: false,
            destructive: false,
            idempotent: true,
            riskTier: "T1"
          },
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
          description: "Execute an approved plan. Enforces idempotency, spend cap, cryptographic approval parameter binding, and optional undo grace window.",
          annotations: {
            readOnly: false,
            destructive: true,
            idempotent: true,
            riskTier: "T2"
          },
          inputSchema: {
            type: "object",
            properties: {
              planId: { type: "string" },
              idempotencyKey: { type: "string" },
              approvals: {
                type: "object",
                description: "Map of actionId or toolName to approvalToken"
              },
              undoWindowSeconds: {
                type: "number",
                description: "Hold duration in seconds before external settlement (Invariant I10)"
              }
            },
            required: ["planId", "idempotencyKey"]
          }
        },
        {
          name: "undo_plan",
          description: "Cancel a booking or plan that is currently held in an undo grace window.",
          annotations: {
            readOnly: false,
            destructive: true,
            idempotent: true,
            riskTier: "T2"
          },
          inputSchema: {
            type: "object",
            properties: {
              planId: { type: "string" }
            },
            required: ["planId"]
          }
        },
        {
          name: "get_plan_status",
          description: "Retrieve plan execution status, remaining spend, and step compensation states.",
          annotations: {
            readOnly: true,
            destructive: false,
            idempotent: true,
            riskTier: "T0"
          },
          inputSchema: {
            type: "object",
            properties: { planId: { type: "string" } },
            required: ["planId"]
          }
        },
        {
          name: "request_cancellation",
          description: "Compensating action to cancel an existing booking idempotently.",
          annotations: {
            readOnly: false,
            destructive: true,
            idempotent: true,
            riskTier: "T2"
          },
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
            userId: grant.userId ?? grant.id,
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
                status: "PENDING",
                elicitation: {
                  mode: "url",
                  url: `http://localhost:3000/approval?actionId=${action.id}&hash=${action.paramsHash}`,
                  description: "Approve this high-risk action out-of-band on your mobile device"
                }
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

          // Invariant I6: User Identity Binding & Cross-User Plan Execution Protection
          if (!disableUserIsolation) {
            const planUserId = plan.userId ?? repo.getGrantById(plan.grantId)?.userId ?? plan.grantId;
            const currentUserId = grant.userId ?? grant.id;
            if (planUserId !== currentUserId) {
              return res.status(403).json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32008,
                  message: `Forbidden: Cross-user violation. Cannot execute plan ${plan.id} belonging to user ${planUserId}.`
                }
              });
            }
          }

          const undoWindowSeconds = Number(toolArgs.undoWindowSeconds ?? 0);

          if (undoWindowSeconds > 0) {
            const heldResult = await sagaOrchestrator.executePlanWithUndoWindow(
              planId,
              grant.id,
              userApprovals,
              undoWindowSeconds
            );
            toolResult = {
              data: heldResult,
              spoken_summary: heldResult.spoken_summary
            };
          } else {
            // Execute with strict Idempotency (Invariant I1) and Saga Orchestration (Invariants I4, I8)
            const executionResult = await idempotencyService.executeWithIdempotency(
              grant.id,
              "execute_plan",
              idempotencyKey,
              { planId, userApprovals },
              async () => {
                const res = await sagaOrchestrator.executePlan(planId, grant.id, userApprovals);
                if (res.state === "COMPENSATION_FAILED" || (res.state === "FAILED" && res.error)) {
                  throw new Error(res.error || "Plan execution failed");
                }
                return res;
              }
            );

            toolResult = {
              data: executionResult.result,
              spoken_summary: executionResult.result.spoken_summary,
              cached: executionResult.cached
            };
          }
        } else if (toolName === "undo_plan") {
          const planId = toolArgs.planId;
          if (!planId) {
            return res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing required field: planId" }
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

          // Invariant I6: Cross-User Plan Cancellation Protection
          if (!disableUserIsolation) {
            const planUserId = plan.userId ?? repo.getGrantById(plan.grantId)?.userId ?? plan.grantId;
            const currentUserId = grant.userId ?? grant.id;
            if (planUserId !== currentUserId) {
              return res.status(403).json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32008,
                  message: `Forbidden: Cross-user violation. Cannot cancel/undo plan ${plan.id} belonging to user ${planUserId}.`
                }
              });
            }
          }

          const undoResult = await sagaOrchestrator.undoPlan(planId);
          toolResult = {
            data: undoResult,
            spoken_summary: undoResult.spoken_summary
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

          // Invariant I6: Cross-User Plan Read Protection
          if (!disableUserIsolation) {
            const planUserId = plan.userId ?? repo.getGrantById(plan.grantId)?.userId ?? plan.grantId;
            const currentUserId = grant.userId ?? grant.id;
            if (planUserId !== currentUserId) {
              return res.status(403).json({
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32008,
                  message: `Forbidden: Cross-user violation. Plan ${plan.id} belongs to user ${planUserId}, not authenticated user ${currentUserId}.`
                }
              });
            }
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
