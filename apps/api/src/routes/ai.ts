import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { media, agentRun, posts, postDestination, socialAccount } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { consumeQuota, planErrorResponse } from "../lib/entitlements";
import { makeAnimatedSvgClip, makePosterSvg } from "../lib/media-gen";

export const aiRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

aiRoutes.post("/copilot", async (c) => {
  try {
    const body = z
      .object({ workspaceId: z.string(), prompt: z.string().min(1).max(2000), tone: z.string().optional() })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await consumeQuota(c.env, body.workspaceId, "aiCopilot", 1);

    let draft = "";
    try {
      const result = (await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        messages: [
          {
            role: "system",
            content:
              "You write short social media posts. Return only the post text, no quotes or preamble. Keep under 280 characters unless asked otherwise.",
          },
          {
            role: "user",
            content: `Tone: ${body.tone || "clear"}. Draft a post about: ${body.prompt}`,
          },
        ],
      })) as { response?: string };
      draft = (result.response || "").trim();
    } catch {
      draft = `${body.prompt.trim()}\n\n— drafted for ${body.tone || "your"} audience`;
    }
    if (!draft) draft = body.prompt.trim();
    return c.json({ draft });
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

aiRoutes.post("/image", async (c) => {
  try {
    const body = z
      .object({ workspaceId: z.string(), prompt: z.string().min(1).max(500) })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await consumeQuota(c.env, body.workspaceId, "aiImages", 1);

    let bytes: Uint8Array;
    let contentType = "image/svg+xml";
    try {
      const result = (await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell" as keyof AiModels, {
        prompt: body.prompt,
      })) as { image?: string } | ReadableStream | ArrayBuffer;
      if (result && typeof result === "object" && "image" in result && result.image) {
        const bin = Uint8Array.from(atob(result.image), (ch) => ch.charCodeAt(0));
        bytes = bin;
        contentType = "image/png";
      } else {
        bytes = new TextEncoder().encode(makePosterSvg(body.prompt));
      }
    } catch {
      bytes = new TextEncoder().encode(makePosterSvg(body.prompt));
    }

    const id = crypto.randomUUID();
    const key = `${body.workspaceId}/${id}-ai.${contentType.includes("svg") ? "svg" : "png"}`;
    await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
    const db = drizzle(c.env.DB);
    await db.insert(media).values({
      id,
      workspaceId: body.workspaceId,
      r2Key: key,
      contentType,
      bytes: bytes.byteLength,
      kind: "image",
      metaJson: JSON.stringify({ ai: true, prompt: body.prompt }),
    });
    return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}` }, 201);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

aiRoutes.post("/video", async (c) => {
  try {
    const body = z
      .object({
        workspaceId: z.string(),
        prompt: z.string().min(1).max(500),
        minutes: z.number().min(1).max(10).default(1),
      })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await consumeQuota(c.env, body.workspaceId, "aiVideos", 1);
    await consumeQuota(c.env, body.workspaceId, "aiClipMinutes", body.minutes);

    const svg = makeAnimatedSvgClip(body.prompt, body.minutes * 60);
    const bytes = new TextEncoder().encode(svg);
    const id = crypto.randomUUID();
    const key = `${body.workspaceId}/${id}-clip.svg`;
    await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/svg+xml" } });
    const db = drizzle(c.env.DB);
    await db.insert(media).values({
      id,
      workspaceId: body.workspaceId,
      r2Key: key,
      contentType: "image/svg+xml",
      bytes: bytes.byteLength,
      kind: "clip",
      metaJson: JSON.stringify({ ai: true, minutes: body.minutes, prompt: body.prompt, playable: "svg-animation" }),
    });
    return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}`, minutes: body.minutes }, 201);
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

aiRoutes.post("/agent", async (c) => {
  try {
    const body = z
      .object({
        workspaceId: z.string(),
        prompt: z.string().min(1).max(2000),
        channelId: z.string().optional(),
        scheduleInMinutes: z.number().int().min(1).max(10080).default(60),
      })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await consumeQuota(c.env, body.workspaceId, "aiCopilot", 1);

    const db = drizzle(c.env.DB);
    let draft = body.prompt.trim();
    try {
      const result = (await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        messages: [
          { role: "system", content: "Draft one short social post. Return only the post text." },
          { role: "user", content: body.prompt },
        ],
      })) as { response?: string };
      if (result.response) draft = result.response.trim();
    } catch {
      /* template fallback already set */
    }

    let channelId = body.channelId;
    if (!channelId) {
      const [ch] = await db
        .select()
        .from(socialAccount)
        .where(eq(socialAccount.workspaceId, body.workspaceId))
        .limit(1);
      channelId = ch?.id;
    }
    if (!channelId) return c.json({ error: "no_channel", message: "Connect a channel first" }, 400);

    const postId = crypto.randomUUID();
    const when = new Date(Date.now() + body.scheduleInMinutes * 60_000);
    await db.insert(posts).values({
      id: postId,
      workspaceId: body.workspaceId,
      authorId: c.get("userId"),
      body: draft,
      status: "scheduled",
      scheduledAt: when,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(postDestination).values({
      id: crypto.randomUUID(),
      postId,
      socialAccountId: channelId,
      status: "pending",
    });

    const runId = crypto.randomUUID();
    const result = { draft, scheduledAt: when.toISOString(), channelId, postId };
    await db.insert(agentRun).values({
      id: runId,
      workspaceId: body.workspaceId,
      prompt: body.prompt,
      resultJson: JSON.stringify(result),
      postId,
      status: "completed",
      createdAt: new Date(),
    });
    return c.json({ runId, ...result });
  } catch (e) {
    const pe = planErrorResponse(e);
    if (pe) return pe;
    throw e;
  }
});

aiRoutes.get("/agent", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(agentRun).where(eq(agentRun.workspaceId, workspaceId));
  return c.json({ runs: rows });
});
