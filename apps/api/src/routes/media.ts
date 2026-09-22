import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { media } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { makePosterSvg } from "../lib/media-gen";

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

mediaRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(media).where(eq(media.workspaceId, workspaceId));
  return c.json({
    media: rows.map((m) => ({
      ...m,
      url: `/v1/media/${m.id}/file?workspaceId=${workspaceId}`,
    })),
  });
});

mediaRoutes.get("/:id/file", async (c) => {
  const id = c.req.param("id");
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row || row.workspaceId !== workspaceId) return c.json({ error: "not_found" }, 404);
  const obj = await c.env.MEDIA.get(row.r2Key);
  if (!obj) return c.json({ error: "missing" }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": row.contentType,
      "cache-control": "private, max-age=3600",
    },
  });
});

mediaRoutes.post("/upload", async (c) => {
  const form = await c.req.formData();
  const workspaceId = String(form.get("workspaceId") || "");
  const file = form.get("file");
  if (!workspaceId || !(file instanceof File)) return c.json({ error: "workspaceId and file required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const id = crypto.randomUUID();
  const key = `${workspaceId}/${id}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const buf = await file.arrayBuffer();
  await c.env.MEDIA.put(key, buf, { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  const db = drizzle(c.env.DB);
  await db.insert(media).values({
    id,
    workspaceId,
    r2Key: key,
    contentType: file.type || "application/octet-stream",
    bytes: buf.byteLength,
    kind: (file.type || "").startsWith("video") ? "clip" : "image",
  });
  return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${workspaceId}` }, 201);
});

const editSchema = z.object({
  workspaceId: z.string(),
  sourceMediaId: z.string().optional(),
  prompt: z.string().optional(),
  overlayText: z.string().max(80).optional(),
  /** Client canvas export as data URL or raw base64 (PNG/JPEG). Preferred path for real raster edits. */
  imageBase64: z.string().optional(),
  contentType: z.enum(["image/png", "image/jpeg"]).optional(),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  brightness: z.number().min(0).max(2).optional(),
  contrast: z.number().min(0).max(2).optional(),
});

function decodeDataUrl(input: string): { bytes: Uint8Array; contentType: string } | null {
  const m = input.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/i);
  if (m) {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType: m[1].toLowerCase() };
  }
  try {
    const bin = atob(input.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType: "image/png" };
  } catch {
    return null;
  }
}

mediaRoutes.post("/edit", async (c) => {
  const body = editSchema.parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);

  if (body.imageBase64) {
    const decoded = decodeDataUrl(body.imageBase64);
    if (!decoded) return c.json({ error: "invalid_image" }, 400);
    const contentType = body.contentType || decoded.contentType;
    const id = crypto.randomUUID();
    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const key = `${body.workspaceId}/${id}-edit.${ext}`;
    await c.env.MEDIA.put(key, decoded.bytes, { httpMetadata: { contentType } });
    await db.insert(media).values({
      id,
      workspaceId: body.workspaceId,
      r2Key: key,
      contentType,
      bytes: decoded.bytes.byteLength,
      kind: "image",
      metaJson: JSON.stringify({
        editor: "canvas",
        overlay: body.overlayText ?? null,
        crop: body.crop ?? null,
        brightness: body.brightness ?? null,
        contrast: body.contrast ?? null,
      }),
    });
    return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}` }, 201);
  }

  // Fallback: generate a poster SVG only when no raster payload is supplied (e.g. create-from-prompt).
  const svg = makePosterSvg(body.prompt || "Poster", body.overlayText || "");
  const id = crypto.randomUUID();
  const key = `${body.workspaceId}/${id}-edit.svg`;
  const bytes = new TextEncoder().encode(svg);
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/svg+xml" } });
  await db.insert(media).values({
    id,
    workspaceId: body.workspaceId,
    r2Key: key,
    contentType: "image/svg+xml",
    bytes: bytes.byteLength,
    kind: "image",
    metaJson: JSON.stringify({ editor: "poster", overlay: body.overlayText ?? null }),
  });
  return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}` }, 201);
});
