import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { posts, postDestination, socialAccount, workspace, apiToken, media } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess, sha256Hex } from "../lib/workspace";
import { assertQuota, consumeQuota, planErrorResponse } from "../lib/entitlements";
import { makePosterSvg } from "../lib/media-gen";
import { aiImageModel, generateTextToVideo, snapVideoDuration } from "../lib/ai-models";

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

const CHANNEL_RULES = {
  instagram: {
    collaborators: "Up to 3 usernames. Stories ignore them.",
    trialReel: "Reels only. The reel stays a trial until you graduate it on Instagram.",
    reelAudio: "Paste an Instagram audio id on a reel. Duskly does not browse a music catalog.",
    story: "Set postType to story.",
    reel: "Set postType to reel and attach a video.",
  },
  facebook: { story: "Set postType to story and attach an image." },
  x: {
    replySettings: ["everyone", "following", "mentionedUsers"],
    communityId: "Optional community id. Everyone is the default reply setting.",
  },
  linkedin: { carousel: "Turn on linkedinCarousel and attach 2 to 9 images." },
  "linkedin-page": "Connect LinkedIn Page as its own channel. When you administer more than one Page, pick it after login.",
  youtube: {
    madeForKids: "madeForKids marks the upload as made for kids.",
    tags: "Comma-separated tags, up to 12.",
    thumbnail: "coverId is uploaded as the custom thumbnail.",
  },
  repeat: {
    rules: ["none", "daily", "weekly", "interval"],
    everyDays: "1 to 90 when the rule is interval.",
    cap: 52,
    pause: "POST /v1/posts/:id/pause returns later runs in that series to drafts. Each run stays on the calendar.",
  },
  shortLink: "extras.shortLink rewrites https links in the caption to /v1/go/:code.",
};

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
  {
    name: "channel_rules",
    description: "Posting rules Duskly applies: Instagram collaborators, trial reels, and reel audio; Facebook stories; X replies and communities; LinkedIn carousels and Pages; YouTube kids, tags, and thumbnails; repeat intervals; short links.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "generate_image",
    description: "Generate an image from a prompt and store it in the workspace media library.",
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string", description: "What the picture should show" } },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description: "Generate a short video from a prompt and store it in the workspace media library.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What the clip should show" },
        durationSec: { type: "number", description: "6 or 8 seconds" },
      },
      required: ["prompt"],
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

async function toolFailure(e: unknown) {
  const pe = planErrorResponse(e);
  if (!pe) return null;
  const payload = await pe.json().catch(() => ({ error: "plan_error" }));
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: true as const };
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

  if (name === "channel_rules") {
    return { content: [{ type: "text", text: JSON.stringify(CHANNEL_RULES, null, 2) }] };
  }

  if (name === "generate_image") {
    const prompt = String(args.prompt || "").trim().slice(0, 500);
    if (!prompt) return { content: [{ type: "text", text: "prompt is required" }], isError: true };
    try {
      await consumeQuota(env, workspaceId, "aiImages", 1);
      const model = aiImageModel(env);
      let bytes: Uint8Array;
      let contentType = "image/svg+xml";
      try {
        const result = (await env.AI.run(model as keyof AiModels, { prompt })) as { image?: string } | ReadableStream | ArrayBuffer;
        if (result && typeof result === "object" && "image" in result && result.image) {
          bytes = Uint8Array.from(atob(result.image), (ch) => ch.charCodeAt(0));
          contentType = "image/png";
        } else {
          bytes = new TextEncoder().encode(makePosterSvg(prompt));
        }
      } catch {
        bytes = new TextEncoder().encode(makePosterSvg(prompt));
      }
      const id = crypto.randomUUID();
      const key = `${workspaceId}/${id}-ai.${contentType.includes("svg") ? "svg" : "png"}`;
      await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
      await db.insert(media).values({
        id,
        workspaceId,
        r2Key: key,
        contentType,
        bytes: bytes.byteLength,
        kind: "image",
        metaJson: JSON.stringify({ ai: true, prompt, model }),
      });
      return { content: [{ type: "text", text: JSON.stringify({ id, url: `/v1/media/${id}/file?workspaceId=${workspaceId}`, model }, null, 2) }] };
    } catch (e) {
      const quota = await toolFailure(e);
      if (quota) return quota;
      throw e;
    }
  }

  if (name === "generate_video") {
    const prompt = String(args.prompt || "").trim().slice(0, 2000);
    if (!prompt) return { content: [{ type: "text", text: "prompt is required" }], isError: true };
    const durationSec = snapVideoDuration(Number(args.durationSec) || 8);
    try {
      await assertQuota(env, workspaceId, "aiVideos", 1);
      let generated: Awaited<ReturnType<typeof generateTextToVideo>>;
      try {
        generated = await generateTextToVideo(env, prompt, durationSec);
      } catch (e) {
        return {
          content: [{ type: "text", text: e instanceof Error ? e.message : "Text-to-video failed. No quota was charged." }],
          isError: true,
        };
      }
      const id = crypto.randomUUID();
      const ext = generated.contentType.includes("webm") ? "webm" : "mp4";
      const key = `${workspaceId}/${id}-clip.${ext}`;
      await env.MEDIA.put(key, generated.bytes, { httpMetadata: { contentType: generated.contentType } });
      await db.insert(media).values({
        id,
        workspaceId,
        r2Key: key,
        contentType: generated.contentType,
        bytes: generated.bytes.byteLength,
        kind: "clip",
        metaJson: JSON.stringify({ ai: true, model: generated.model, prompt, durationSec: generated.durationSec }),
      });
      await consumeQuota(env, workspaceId, "aiVideos", 1);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ id, url: `/v1/media/${id}/file?workspaceId=${workspaceId}`, model: generated.model, durationSec: generated.durationSec }, null, 2),
        }],
      };
    } catch (e) {
      const quota = await toolFailure(e);
      if (quota) return quota;
      throw e;
    }
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
