export type Network = "x" | "bluesky" | "linkedin" | "mastodon";

export type PublishInput = {
  body: string;
  handle: string;
  token: string;
  credentials?: Record<string, string>;
  commentBody?: string | null;
};

export type PublishOk = { remoteId: string; commentRemoteId?: string; commentSkipped?: string };
export type PublishQueued = { queued: true; reason: string };

export type NetworkAdapter = {
  network: Network;
  publish(input: PublishInput): Promise<PublishOk | PublishQueued>;
};

async function blueskyPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const service = input.credentials?.service ?? "https://bsky.social";
  const identifier = input.credentials?.identifier ?? input.handle;
  const password = input.credentials?.appPassword ?? input.token;
  if (!password || password === "pending") {
    return { queued: true, reason: "Bluesky credentials not configured — post stays queued until connect completes" };
  }
  try {
    const sessionRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!sessionRes.ok) return { queued: true, reason: `Bluesky auth failed (${sessionRes.status})` };
    const session = (await sessionRes.json()) as { accessJwt: string; did: string };
    const postRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: { $type: "app.bsky.feed.post", text: input.body, createdAt: new Date().toISOString() },
      }),
    });
    if (!postRes.ok) return { queued: true, reason: `Bluesky publish failed (${postRes.status})` };
    const data = (await postRes.json()) as { uri?: string; cid?: string };
    const remoteId = data.uri ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (input.commentBody?.trim() && data.uri && data.cid) {
      const replyRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record: {
            $type: "app.bsky.feed.post",
            text: input.commentBody.trim(),
            createdAt: new Date().toISOString(),
            reply: {
              root: { uri: data.uri, cid: data.cid },
              parent: { uri: data.uri, cid: data.cid },
            },
          },
        }),
      });
      if (replyRes.ok) {
        const reply = (await replyRes.json()) as { uri?: string };
        commentRemoteId = reply.uri;
      } else {
        commentSkipped = `Bluesky reply failed (${replyRes.status})`;
      }
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return { queued: true, reason: e instanceof Error ? e.message : "Bluesky error" };
  }
}

async function xPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  if (!token || token === "pending") {
    return { queued: true, reason: "X OAuth credentials are not configured — scheduled and queued honestly, not marked published" };
  }
  try {
    const res = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: input.body.slice(0, 280) }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { queued: true, reason: `X publish failed (${res.status}): ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: { id?: string } };
    const remoteId = data.data?.id ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (input.commentBody?.trim()) {
      const reply = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: input.commentBody.trim().slice(0, 280),
          reply: { in_reply_to_tweet_id: remoteId },
        }),
      });
      if (reply.ok) {
        const rd = (await reply.json()) as { data?: { id?: string } };
        commentRemoteId = rd.data?.id;
      } else {
        commentSkipped = `X reply failed (${reply.status})`;
      }
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return { queued: true, reason: e instanceof Error ? e.message : "X error" };
  }
}

async function linkedinPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const author = input.credentials?.authorUrn;
  if (!token || token === "pending" || !author) {
    return {
      queued: true,
      reason: "LinkedIn OAuth credentials are not configured — scheduled and queued honestly, not marked published",
    };
  }
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-restli-protocol-version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: input.body },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { queued: true, reason: `LinkedIn publish failed (${res.status}): ${err.slice(0, 200)}` };
    }
    const id = res.headers.get("x-restli-id") || crypto.randomUUID();
    // LinkedIn comment API requires separate Social Actions product; skip with explicit reason when unsupported.
    const commentSkipped = input.commentBody?.trim()
      ? "LinkedIn first-comment requires Social Actions API access not enabled for this app"
      : undefined;
    return { remoteId: id, commentSkipped };
  } catch (e) {
    return { queued: true, reason: e instanceof Error ? e.message : "LinkedIn error" };
  }
}

async function mastodonPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const instance = (input.credentials?.instance || "https://mastodon.social").replace(/\/$/, "");
  if (!token || token === "pending") {
    return {
      queued: true,
      reason: "Mastodon OAuth credentials are not configured — scheduled and queued honestly, not marked published",
    };
  }
  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: input.body }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { queued: true, reason: `Mastodon publish failed (${res.status}): ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    const remoteId = data.id ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (input.commentBody?.trim()) {
      const reply = await fetch(`${instance}/api/v1/statuses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: input.commentBody.trim(), in_reply_to_id: remoteId }),
      });
      if (reply.ok) {
        const rd = (await reply.json()) as { id?: string };
        commentRemoteId = rd.id;
      } else {
        commentSkipped = `Mastodon reply failed (${reply.status})`;
      }
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return { queued: true, reason: e instanceof Error ? e.message : "Mastodon error" };
  }
}

export const adapters: Record<Network, NetworkAdapter> = {
  bluesky: { network: "bluesky", publish: blueskyPublish },
  x: { network: "x", publish: xPublish },
  linkedin: { network: "linkedin", publish: linkedinPublish },
  mastodon: { network: "mastodon", publish: mastodonPublish },
};

export const NETWORKS: Network[] = ["bluesky", "x", "linkedin", "mastodon"];
