import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { media, agentRun, posts, postDestination, socialAccount } from "../db/schema";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { assertQuota, consumeQuota, planErrorResponse } from "../lib/entitlements";
import { makePosterSvg } from "../lib/media-gen";
import {
  CLIP_DURATION_SEC,
  VIDEO_DURATION_OPTIONS,
  aiCopilotModel,
  aiImageModel,
  generateCopilotDraft,
  generateTextToVideo,
  snapVideoDuration,
} from "../lib/ai-models";

export const aiRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

aiRoutes.post("/copilot", async (c) => {
  try {
    const body = z
      .object({ workspaceId: z.string(), prompt: z.string().min(1).max(2000), tone: z.string().optional() })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);
    await assertQuota(c.env, body.workspaceId, "aiCopilot", 1);

    let generated: Awaited<ReturnType<typeof generateCopilotDraft>>;
    try {
      generated = await generateCopilotDraft(c.env, body.prompt, body.tone);
    } catch (e) {
      return c.json(
        {
          error: "copilot_generation_failed",
          message: e instanceof Error ? e.message : "Caption generation failed",
          hint: "Check AI binding and AI_COPILOT_MODEL. No quota was charged.",
        },
        502,
      );
    }

    await consumeQuota(c.env, body.workspaceId, "aiCopilot", 1);
    return c.json({ draft: generated.draft, model: generated.model });
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

    const model = aiImageModel(c.env);
    let bytes: Uint8Array;
    let contentType = "image/svg+xml";
    try {
      const result = (await c.env.AI.run(model as keyof AiModels, {
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
      metaJson: JSON.stringify({ ai: true, prompt: body.prompt, model }),
    });
    return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}`, model }, 201);
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
        prompt: z.string().min(1).max(2000),
        /** Seconds for the T2V model. Default is one short AI video credit. */
        durationSec: z.number().int().min(6).max(CLIP_DURATION_SEC).optional(),
        /** Legacy billing field; if set without durationSec, mapped via snapVideoDuration(minutes*60). */
        minutes: z.number().min(1).max(10).optional(),
      })
      .parse(await c.req.json());
    const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
    if (!ws) return c.json({ error: "forbidden" }, 403);

    const durationSec = snapVideoDuration(
      body.durationSec ?? (body.minutes ? Math.min(CLIP_DURATION_SEC, body.minutes * 60) : CLIP_DURATION_SEC),
    );

    await assertQuota(c.env, body.workspaceId, "aiVideos", 1);

    let generated: Awaited<ReturnType<typeof generateTextToVideo>>;
    try {
      generated = await generateTextToVideo(c.env, body.prompt, durationSec);
    } catch (e) {
      return c.json(
        {
          error: "video_generation_failed",
          message: e instanceof Error ? e.message : "Text-to-video failed",
          hint: "Check AI binding and AI_VIDEO_MODEL. No quota was charged.",
        },
        502,
      );
    }

    const id = crypto.randomUUID();
    const ext = generated.contentType.includes("webm") ? "webm" : "mp4";
    const key = `${body.workspaceId}/${id}-clip.${ext}`;
    await c.env.MEDIA.put(key, generated.bytes, { httpMetadata: { contentType: generated.contentType } });
    const db = drizzle(c.env.DB);
    await db.insert(media).values({
      id,
      workspaceId: body.workspaceId,
      r2Key: key,
      contentType: generated.contentType,
      bytes: generated.bytes.byteLength,
      kind: "clip",
      metaJson: JSON.stringify({
        ai: true,
        model: generated.model,
        prompt: body.prompt,
        durationSec: generated.durationSec,
        playable: generated.contentType,
      }),
    });

    await consumeQuota(c.env, body.workspaceId, "aiVideos", 1);

    return c.json(
      {
        id,
        url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}`,
        model: generated.model,
        durationSec: generated.durationSec,
        contentType: generated.contentType,
        allowedDurations: VIDEO_DURATION_OPTIONS,
      },
      201,
    );
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
    const model = aiCopilotModel(c.env);
    try {
      const result = (await c.env.AI.run(model as keyof AiModels, {
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
    const [channel] = await db
      .select({ id: socialAccount.id })
      .from(socialAccount)
      .where(and(eq(socialAccount.id, channelId), eq(socialAccount.workspaceId, body.workspaceId)))
      .limit(1);
    if (!channel) return c.json({ error: "invalid_channel" }, 400);

    const userId = c.get("userId");
    const authorId = userId.startsWith("token:") ? ws.ownerId : userId;

    const postId = crypto.randomUUID();
    const when = new Date(Date.now() + body.scheduleInMinutes * 60_000);
    await db.insert(posts).values({
      id: postId,
      workspaceId: body.workspaceId,
      authorId,
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
    return c.json({ runId, ...result, model });
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
