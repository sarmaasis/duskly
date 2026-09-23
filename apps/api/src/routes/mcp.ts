import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { posts, postDestination, socialAccount, workspace, apiToken } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess, sha256Hex } from "../lib/workspace";
import { planErrorResponse } from "../lib/entitlements";

type JsonRpcId = string | number | null;
type JsonRpcReq = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function ok(id: JsonRpcId | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: JsonRpcId | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export const MCP_TOOLS = [
  {
    name: "list_channels",
    description: "List connected social channels/accounts in the Duskly workspace for this API token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "schedule_post",
    description:
      "Create a scheduled social post. Provide body text, channelIds (from list_channels), and scheduledAt ISO-8601 or unix ms.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Post text" },
        channelIds: {
          type: "array",
          items: { type: "string" },
          description: "One or more social account ids",
        },
        scheduledAt: {
          type: "string",
          description: "ISO-8601 datetime or unix milliseconds when the post should publish",
        },
      },
      required: ["body", "channelIds", "scheduledAt"],
    },
  },
  {
    name: "list_posts",
    description: "List recent posts in the workspace (newest scheduled first). Optional limit (default 20, max 50).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max posts to return" },
      },
      additionalProperties: false,
    },
  },
];

async function authWorkspace(c: {
  req: { header: (n: string) => string | undefined };
  env: Env;
}): Promise<{ workspaceId: string; userId: string } | Response> {
  const token = c.req.header("x-api-token") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("dk_")) {
    return Response.json({ error: "unauthorized", message: "Bearer dk_ API token required" }, { status: 401 });
  }
  const hash = await sha256Hex(token);
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(apiToken).where(eq(apiToken.tokenHash, hash)).limit(1);
  if (!row) {
    return Response.json({ error: "unauthorized", message: "Invalid API token" }, { status: 401 });
  }
  await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
  return { workspaceId: row.workspaceId, userId: `token:${row.workspaceId}` };
}

async function callTool(
  env: Env,
  workspaceId: string,
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const ws = await assertWorkspaceAccess(env, workspaceId, userId);
  if (!ws) {
    return { content: [{ type: "text", text: "Forbidden: workspace mismatch" }], isError: true };
  }
  const db = drizzle(env.DB);

  if (name === "list_channels") {
    const rows = await db
      .select({
        id: socialAccount.id,
        network: socialAccount.network,
        handle: socialAccount.handle,
        status: socialAccount.status,
      })
      .from(socialAccount)
      .where(eq(socialAccount.workspaceId, workspaceId));
    return { content: [{ type: "text", text: JSON.stringify({ channels: rows }, null, 2) }] };
  }

  if (name === "list_posts") {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const rows = await db
      .select({
        id: posts.id,
        body: posts.body,
        status: posts.status,
        scheduledAt: posts.scheduledAt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.workspaceId, workspaceId))
      .orderBy(desc(posts.scheduledAt))
      .limit(limit);
    return { content: [{ type: "text", text: JSON.stringify({ posts: rows }, null, 2) }] };
  }

  if (name === "schedule_post") {
    try {
      const body = String(args.body || "").trim();
      const channelIds = Array.isArray(args.channelIds) ? args.channelIds.map(String) : [];
      if (!body) return { content: [{ type: "text", text: "body is required" }], isError: true };
      if (!channelIds.length) {
        return { content: [{ type: "text", text: "channelIds is required" }], isError: true };
      }
      let scheduledAt: Date;
      const raw = args.scheduledAt;
      if (typeof raw === "number") scheduledAt = new Date(raw);
      else if (typeof raw === "string" && /^\d+$/.test(raw)) scheduledAt = new Date(Number(raw));
      else if (typeof raw === "string") scheduledAt = new Date(raw);
      else {
        return { content: [{ type: "text", text: "scheduledAt is required (ISO or unix ms)" }], isError: true };
      }
      if (Number.isNaN(scheduledAt.getTime())) {
        return { content: [{ type: "text", text: "scheduledAt is invalid" }], isError: true };
      }

      const [ownerWs] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
      const authorId = ownerWs?.ownerId;
      if (!authorId) {
        return { content: [{ type: "text", text: "Workspace owner missing" }], isError: true };
      }

      const accounts = await db.select().from(socialAccount).where(eq(socialAccount.workspaceId, workspaceId));
      const allowed = new Set(accounts.map((a) => a.id));
      for (const id of channelIds) {
        if (!allowed.has(id)) {
          return { content: [{ type: "text", text: `Unknown channel id: ${id}` }], isError: true };
        }
      }

      const postId = crypto.randomUUID();
      const now = new Date();
      await db.insert(posts).values({
        id: postId,
        workspaceId,
        authorId,
        body,
        status: "scheduled",
        scheduledAt,
        createdAt: now,
        updatedAt: now,
      });
      for (const socialAccountId of channelIds) {
        await db.insert(postDestination).values({
          id: crypto.randomUUID(),
          postId,
          socialAccountId,
          status: "pending",
        });
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { id: postId, status: "scheduled", scheduledAt: scheduledAt.toISOString(), channelIds },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      const pe = planErrorResponse(e);
      if (pe) {
        const payload = await pe.json().catch(() => ({ error: "plan_error" }));
        return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: true };
      }
      throw e;
    }
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
}

export const mcpRoutes = new Hono<{ Bindings: Env }>();

mcpRoutes.options("/", (c) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Token, Accept, MCP-Protocol-Version");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return c.body(null, 204);
});

mcpRoutes.get("/", async (c) => {
  const auth = await authWorkspace(c);
  if (auth instanceof Response) return auth;
  return c.json({
    name: "duskly",
    version: "1.0.0",
    transport: "streamable-http",
    protocolVersion: "2025-03-26",
    workspaceId: auth.workspaceId,
    tools: MCP_TOOLS.map((t) => t.name),
  });
});

mcpRoutes.post("/", async (c) => {
  const auth = await authWorkspace(c);
  if (auth instanceof Response) return auth;

  let req: JsonRpcReq;
  try {
    req = (await c.req.json()) as JsonRpcReq;
  } catch {
    return c.json(err(null, -32700, "Parse error"), 400);
  }

  const method = req.method || "";
  const id = req.id;

  if (method === "initialize") {
    return c.json(
      ok(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "duskly", version: "1.0.0" },
      }),
    );
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return c.body(null, 204);
  }

  if (method === "ping") {
    return c.json(ok(id, {}));
  }

  if (method === "tools/list") {
    return c.json(ok(id, { tools: MCP_TOOLS }));
  }

  if (method === "tools/call") {
    const name = String((req.params as { name?: string })?.name || "");
    const args = ((req.params as { arguments?: Record<string, unknown> })?.arguments || {}) as Record<
      string,
      unknown
    >;
    const result = await callTool(c.env, auth.workspaceId, auth.userId, name, args);
    return c.json(ok(id, result));
  }

  return c.json(err(id, -32601, `Method not found: ${method}`), 400);
});
