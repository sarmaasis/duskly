import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { postDestination, posts, socialAccount } from "../db/schema";
import type { Env } from "../env";
import { assertWorkspaceAccess } from "../lib/workspace";
import { decryptCredentials, decryptSecret } from "../lib/secrets";

export const inboxRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

type Item = { id: string; network: string; handle: string; text: string; accountId: string };

inboxRoutes.get("/", async (c) => {
  const workspaceId = c.req.query("workspaceId") || "";
  if (!workspaceId) return c.json({ error: "workspaceId required" }, 400);
  const ws = await assertWorkspaceAccess(c.env, workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db
    .select({
      remoteId: postDestination.remoteId,
      network: socialAccount.network,
      handle: socialAccount.handle,
      accountId: socialAccount.id,
      externalId: socialAccount.externalId,
      tokenCipher: socialAccount.tokenCipher,
      credentialsJson: socialAccount.credentialsJson,
    })
    .from(postDestination)
    .innerJoin(socialAccount, eq(postDestination.socialAccountId, socialAccount.id))
    .innerJoin(posts, eq(postDestination.postId, posts.id))
    .where(and(eq(posts.workspaceId, workspaceId), eq(postDestination.status, "published")))
    .limit(20);

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.remoteId || seen.has(`${row.network}:${row.accountId}:${row.remoteId}`)) continue;
    if (!["x", "instagram", "facebook", "threads"].includes(row.network)) continue;
    seen.add(`${row.network}:${row.accountId}:${row.remoteId}`);
    try {
      const creds = (await decryptCredentials(c.env, row.credentialsJson)) || {};
      const token = creds.accessToken || (await decryptSecret(c.env, row.tokenCipher));
      if (row.network === "x") {
        if (seen.has(`x-mentions:${row.accountId}`)) continue;
        seen.add(`x-mentions:${row.accountId}`);
        const res = await fetch(`https://api.x.com/2/users/${row.externalId}/mentions?max_results=5&tweet.fields=text`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { data?: { id: string; text?: string }[] };
        for (const tweet of data.data || []) {
          items.push({ id: tweet.id, network: "x", handle: row.handle, text: tweet.text || "", accountId: row.accountId });
        }
        continue;
      }
      const url =
        row.network === "threads"
          ? `https://graph.threads.net/v1.0/${row.remoteId}/replies?fields=id,text,username&access_token=${encodeURIComponent(token)}`
          : `${creds.authKind === "instagram_login" ? "https://graph.instagram.com" : "https://graph.facebook.com/v21.0"}/${row.remoteId}/comments?fields=id,text,message,username&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: { id: string; text?: string; message?: string }[] };
      for (const comment of data.data || []) {
        items.push({
          id: comment.id,
          network: row.network,
          handle: row.handle,
          text: comment.text || comment.message || "",
          accountId: row.accountId,
        });
      }
    } catch {
      /* skip a channel that does not return comments */
    }
  }
  return c.json({ items });
});

inboxRoutes.post("/reply", async (c) => {
  const body = z
    .object({
      workspaceId: z.string(),
      accountId: z.string(),
      commentId: z.string(),
      network: z.string(),
      text: z.string().min(1).max(2000),
    })
    .parse(await c.req.json());
  const ws = await assertWorkspaceAccess(c.env, body.workspaceId, c.get("userId"));
  if (!ws) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB);
  const [account] = await db
    .select()
    .from(socialAccount)
    .where(and(eq(socialAccount.id, body.accountId), eq(socialAccount.workspaceId, body.workspaceId)))
    .limit(1);
  if (!account) return c.json({ error: "not_found" }, 404);
  const creds = (await decryptCredentials(c.env, account.credentialsJson)) || {};
  const token = creds.accessToken || (await decryptSecret(c.env, account.tokenCipher));
  let res: Response;
  if (body.network === "x") {
    res = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: body.text.slice(0, 280), reply: { in_reply_to_tweet_id: body.commentId } }),
    });
  } else if (body.network === "threads") {
    const userId = creds.threadsUserId || account.externalId;
    const created = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads?${new URLSearchParams({
        media_type: "TEXT",
        text: body.text.slice(0, 500),
        reply_to_id: body.commentId,
        access_token: token,
      })}`,
      { method: "POST" },
    );
    const container = (await created.json()) as { id?: string };
    if (!created.ok || !container.id) return c.json({ error: "reply_failed" }, 502);
    res = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads_publish?${new URLSearchParams({ creation_id: container.id, access_token: token })}`,
      { method: "POST" },
    );
  } else {
    const host = creds.authKind === "instagram_login" ? "https://graph.instagram.com" : "https://graph.facebook.com/v21.0";
    res = await fetch(`${host}/${body.commentId}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: body.text, access_token: token }),
    });
  }
  if (!res.ok) return c.json({ error: "reply_failed", message: (await res.text()).slice(0, 180) }, 502);
  return c.json({ ok: true });
});
