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
    kind: (file.type || "").startsWith("video") || (file.type || "").includes("svg") ? "clip" : "image",
  });
  return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${workspaceId}` }, 201);
});

const editSchema = z.object({
  workspaceId: z.string(),
  sourceMediaId: z.string().optional(),
  prompt: z.string().optional(),
  overlayText: z.string().max(80).optional(),
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
});

mediaRoutes.post("/edit", async (c) => {
  const body = editSchema.parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);

  let svg: string;
  if (body.sourceMediaId) {
    const [src] = await db.select().from(media).where(eq(media.id, body.sourceMediaId)).limit(1);
    if (!src || src.workspaceId !== body.workspaceId) return c.json({ error: "source_missing" }, 404);
    const obj = await c.env.MEDIA.get(src.r2Key);
    if (!obj) return c.json({ error: "source_missing" }, 404);
    const raw = await obj.text();
    if (src.contentType.includes("svg")) {
      const overlay = body.overlayText
        ? `<text x="50%" y="92%" text-anchor="middle" font-family="system-ui" font-size="42" fill="#ff5c33">${body.overlayText.replace(/[<>&]/g, "")}</text>`
        : "";
      svg = raw.includes("</svg>")
        ? raw.replace("</svg>", `${overlay}</svg>`)
        : makePosterSvg(body.prompt || "Edited", body.overlayText || "");
    } else {
      svg = makePosterSvg(body.prompt || "Edited image", body.overlayText || "");
    }
  } else {
    svg = makePosterSvg(body.prompt || "Poster", body.overlayText || "");
  }

  if (body.crop) {
    svg = svg.replace(
      /viewBox="[^"]+"/,
      `viewBox="${body.crop.x} ${body.crop.y} ${body.crop.w} ${body.crop.h}"`,
    );
  }

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
    metaJson: JSON.stringify({ editor: true, crop: body.crop ?? null, overlay: body.overlayText ?? null }),
  });
  return c.json({ id, url: `/v1/media/${id}/file?workspaceId=${body.workspaceId}` }, 201);
});
