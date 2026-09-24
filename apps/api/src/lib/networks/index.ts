import { REDDIT_UA } from "../oauth-tokens";

export type Network =
  | "linkedin"
  | "x"
  | "instagram"
  | "threads"
  | "facebook"
  | "youtube"
  | "reddit"
  | "bluesky"
  | "mastodon"
  | "hashnode"
  | "medium"
  | "devto"
  | "telegram"
  | "discord"
  | "slack";

export type PublishInput = {
  body: string;
  handle: string;
  token: string;
  credentials?: Record<string, string>;
  commentBody?: string | null;
  /** When true, adapters skip first-comment (publisher will schedule it later). */
  skipComment?: boolean;
  videoBytes?: ArrayBuffer;
  videoContentType?: string;
  imageBytes?: ArrayBuffer;
  imageContentType?: string;
};

export type CommentInput = {
  remoteId: string;
  commentBody: string;
  handle: string;
  token: string;
  credentials?: Record<string, string>;
};

export type PublishOk = { remoteId: string; commentRemoteId?: string; commentSkipped?: string };
export type PublishQueued = { queued: true; reason: string };

export type NetworkAdapter = {
  network: Network;
  publish(input: PublishInput): Promise<PublishOk | PublishQueued>;
  comment?(input: CommentInput): Promise<{ commentRemoteId?: string; commentSkipped?: string }>;
};

/** First attached item in composer order — extras stay on the post, not dropped. */
export function firstPublishMedia<T extends { id: string }>(mediaIds: string[], rows: T[]): T | undefined {
  const byId = new Map(rows.map((m) => [m.id, m]));
  for (const id of mediaIds) {
    const found = byId.get(id);
    if (found) return found;
  }
  return undefined;
}

export function isVideoMedia(m: { kind: string; contentType: string }) {
  return m.kind === "clip" || m.contentType.startsWith("video/");
}

export function isImageMedia(m: { kind: string; contentType: string }) {
  return m.kind === "image" || m.contentType.startsWith("image/");
}

export function publishImageUrl(input: PublishInput): string | undefined {
  const url = input.credentials?.imageUrl?.trim();
  return url || undefined;
}

function imageFilename(contentType: string): string {
  if (contentType.includes("png")) return "image.png";
  if (contentType.includes("gif")) return "image.gif";
  if (contentType.includes("webp")) return "image.webp";
  return "image.jpg";
}

async function resolvePublishImage(
  input: PublishInput,
): Promise<{ bytes: ArrayBuffer; contentType: string } | undefined> {
  if (input.imageBytes && input.imageBytes.byteLength) {
    return { bytes: input.imageBytes, contentType: input.imageContentType || "image/jpeg" };
  }
  const url = publishImageUrl(input);
  if (!url) return undefined;
  const fetched = await fetch(url);
  if (!fetched.ok) return undefined;
  return {
    bytes: await fetched.arrayBuffer(),
    contentType: fetched.headers.get("content-type") || input.imageContentType || "image/jpeg",
  };
}

function imageBlob(bytes: ArrayBuffer, contentType: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: contentType });
}

export type NetworkGroup = "social" | "blogs" | "chat";

export const NETWORK_META: Record<Network, { label: string; group: NetworkGroup; connect: "oauth" | "token" }> = {
  linkedin: { label: "LinkedIn", group: "social", connect: "oauth" },
  x: { label: "X", group: "social", connect: "oauth" },
  instagram: { label: "Instagram", group: "social", connect: "oauth" },
  threads: { label: "Threads", group: "social", connect: "oauth" },
  facebook: { label: "Facebook", group: "social", connect: "oauth" },
  youtube: { label: "YouTube", group: "social", connect: "oauth" },
  reddit: { label: "Reddit", group: "social", connect: "oauth" },
  bluesky: { label: "Bluesky", group: "social", connect: "token" },
  mastodon: { label: "Mastodon", group: "social", connect: "oauth" },
  hashnode: { label: "Hashnode", group: "blogs", connect: "token" },
  medium: { label: "Medium", group: "blogs", connect: "token" },
  devto: { label: "dev.to", group: "blogs", connect: "token" },
  telegram: { label: "Telegram", group: "chat", connect: "token" },
  discord: { label: "Discord", group: "chat", connect: "token" },
  slack: { label: "Slack", group: "chat", connect: "oauth" },
};

/** Social-first UI order. */
export const NETWORKS: Network[] = [
  "linkedin",
  "x",
  "instagram",
  "threads",
  "facebook",
  "youtube",
  "reddit",
  "bluesky",
  "mastodon",
  "hashnode",
  "devto",
  "telegram",
  "discord",
  "slack",
];

function missingCreds(reason: string): PublishQueued {
  return { queued: true, reason };
}

function hasToken(token: string | undefined): boolean {
  return !!token && token !== "pending";
}

const LINKEDIN_VERSION = "202603";

/* ——— Bluesky ——— */
async function blueskyPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const service = input.credentials?.service ?? "https://bsky.social";
  const identifier = input.credentials?.identifier ?? input.handle;
  const password = input.credentials?.appPassword ?? input.token;
  if (!hasToken(password)) {
    return missingCreds("Bluesky credentials not configured — post stays queued until connect completes");
  }
  try {
    const sessionRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!sessionRes.ok) return missingCreds(`Bluesky auth failed (${sessionRes.status})`);
    const session = (await sessionRes.json()) as { accessJwt: string; did: string };
    const wantsImage = !!(publishImageUrl(input) || input.imageBytes);
    const image = wantsImage ? await resolvePublishImage(input) : undefined;
    if (wantsImage && !image) {
      return missingCreds("Bluesky image fetch failed — queued so the photo is not dropped");
    }
    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text: input.body,
      createdAt: new Date().toISOString(),
    };
    if (image) {
      const blobRes = await fetch(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessJwt}`, "content-type": image.contentType },
        body: image.bytes,
      });
      if (!blobRes.ok) {
        const err = await blobRes.text();
        return missingCreds(`Bluesky blob upload failed (${blobRes.status}): ${err.slice(0, 200)}`);
      }
      const blob = (await blobRes.json()) as { blob?: unknown };
      if (!blob.blob) return missingCreds("Bluesky blob upload returned no blob — queued");
      record.embed = {
        $type: "app.bsky.embed.images",
        images: [{ alt: input.body.slice(0, 300), image: blob.blob }],
      };
    }
    const postRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });
    if (!postRes.ok) return missingCreds(`Bluesky publish failed (${postRes.status})`);
    const data = (await postRes.json()) as { uri?: string; cid?: string };
    const remoteId = data.uri ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (!input.skipComment && input.commentBody?.trim() && data.uri && data.cid) {
      const c = await blueskyComment({
        remoteId: data.uri,
        commentBody: input.commentBody,
        handle: input.handle,
        token: session.accessJwt,
        credentials: { ...input.credentials, did: session.did, service, accessJwt: session.accessJwt, rootCid: data.cid },
      });
      commentRemoteId = c.commentRemoteId;
      commentSkipped = c.commentSkipped;
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Bluesky error");
  }
}

async function blueskyComment(input: CommentInput): Promise<{ commentRemoteId?: string; commentSkipped?: string }> {
  const service = input.credentials?.service ?? "https://bsky.social";
  const accessJwt = input.credentials?.accessJwt ?? input.token;
  const did = input.credentials?.did;
  const rootCid = input.credentials?.rootCid;
  const uri = input.remoteId;
  if (!accessJwt || !did || !rootCid) {
    const identifier = input.credentials?.identifier ?? input.handle;
    const password = input.credentials?.appPassword ?? input.token;
    const sessionRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!sessionRes.ok) return { commentSkipped: `Bluesky re-auth failed (${sessionRes.status})` };
    const session = (await sessionRes.json()) as { accessJwt: string; did: string };
    const thread = await fetch(`${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`, {
      headers: { authorization: `Bearer ${session.accessJwt}` },
    });
    if (!thread.ok) return { commentSkipped: `Bluesky thread lookup failed (${thread.status})` };
    const td = (await thread.json()) as { thread?: { post?: { cid?: string } } };
    const cid = td.thread?.post?.cid;
    if (!cid) return { commentSkipped: "Bluesky post cid missing for reply" };
    const replyRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: input.commentBody.trim(),
          createdAt: new Date().toISOString(),
          reply: { root: { uri, cid }, parent: { uri, cid } },
        },
      }),
    });
    if (!replyRes.ok) return { commentSkipped: `Bluesky reply failed (${replyRes.status})` };
    const reply = (await replyRes.json()) as { uri?: string };
    return { commentRemoteId: reply.uri };
  }
  const replyRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: input.commentBody.trim(),
        createdAt: new Date().toISOString(),
        reply: { root: { uri, cid: rootCid }, parent: { uri, cid: rootCid } },
      },
    }),
  });
  if (!replyRes.ok) return { commentSkipped: `Bluesky reply failed (${replyRes.status})` };
  const reply = (await replyRes.json()) as { uri?: string };
  return { commentRemoteId: reply.uri };
}

/* ——— X ——— */
async function xPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  if (!hasToken(token)) {
    return missingCreds("X OAuth credentials are not configured — scheduled and queued honestly, not marked published");
  }
  try {
    const wantsImage = !!(publishImageUrl(input) || input.imageBytes);
    const image = wantsImage ? await resolvePublishImage(input) : undefined;
    if (wantsImage && !image) {
      return missingCreds("X image fetch failed — queued so the photo is not dropped");
    }
    let mediaId: string | undefined;
    if (image) {
      const form = new FormData();
      form.append("media", imageBlob(image.bytes, image.contentType), imageFilename(image.contentType));
      form.append("media_category", "tweet_image");
      const up = await fetch("https://api.x.com/2/media/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      if (!up.ok) {
        const err = await up.text();
        return missingCreds(`X media upload failed (${up.status}): ${err.slice(0, 200)}`);
      }
      const uploaded = (await up.json()) as {
        data?: { id?: string; media_id_string?: string };
        media_id_string?: string;
      };
      mediaId = uploaded.data?.id ?? uploaded.data?.media_id_string ?? uploaded.media_id_string;
      if (!mediaId) return missingCreds("X media upload returned no media id — queued");
    }
    const payload: Record<string, unknown> = { text: input.body.slice(0, 280) };
    if (mediaId) payload.media = { media_ids: [mediaId] };
    const res = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`X publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { data?: { id?: string } };
    const remoteId = data.data?.id ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (!input.skipComment && input.commentBody?.trim()) {
      const c = await xComment({ remoteId, commentBody: input.commentBody, handle: input.handle, token, credentials: input.credentials });
      commentRemoteId = c.commentRemoteId;
      commentSkipped = c.commentSkipped;
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "X error");
  }
}

async function xComment(input: CommentInput): Promise<{ commentRemoteId?: string; commentSkipped?: string }> {
  const token = input.credentials?.accessToken ?? input.token;
  const reply = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ text: input.commentBody.trim().slice(0, 280), reply: { in_reply_to_tweet_id: input.remoteId } }),
  });
  if (!reply.ok) return { commentSkipped: `X reply failed (${reply.status})` };
  const rd = (await reply.json()) as { data?: { id?: string } };
  return { commentRemoteId: rd.data?.id };
}

/* ——— LinkedIn ——— */
async function linkedinPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const author = input.credentials?.authorUrn;
  if (!hasToken(token) || !author) {
    return missingCreds("LinkedIn OAuth credentials are not configured — scheduled and queued honestly, not marked published");
  }
  try {
    const wantsImage = !!(publishImageUrl(input) || input.imageBytes);
    const image = wantsImage ? await resolvePublishImage(input) : undefined;
    if (wantsImage && !image) {
      return missingCreds("LinkedIn image fetch failed — queued so the photo is not dropped");
    }
    let imageUrn: string | undefined;
    if (image) {
      const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "linkedin-version": LINKEDIN_VERSION,
          "x-restli-protocol-version": "2.0.0",
        },
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      });
      if (!init.ok) {
        const err = await init.text();
        return missingCreds(`LinkedIn image init failed (${init.status}): ${err.slice(0, 200)}`);
      }
      const started = (await init.json()) as { value?: { uploadUrl?: string; image?: string } };
      const uploadUrl = started.value?.uploadUrl;
      imageUrn = started.value?.image;
      if (!uploadUrl || !imageUrn) {
        return missingCreds("LinkedIn image init returned no upload URL — queued");
      }
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": image.contentType },
        body: image.bytes,
      });
      if (!put.ok) {
        const err = await put.text();
        return missingCreds(`LinkedIn image upload failed (${put.status}): ${err.slice(0, 200)}`);
      }
    }
    const postBody: Record<string, unknown> = {
      author,
      commentary: input.body,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    if (imageUrn) postBody.content = { media: { id: imageUrn } };
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "linkedin-version": LINKEDIN_VERSION,
        "x-restli-protocol-version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`LinkedIn publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const id = res.headers.get("x-restli-id") || crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (!input.skipComment && input.commentBody?.trim()) {
      const c = await linkedinComment({
        remoteId: id,
        commentBody: input.commentBody,
        handle: input.handle,
        token,
        credentials: { ...input.credentials, authorUrn: author },
      });
      commentRemoteId = c.commentRemoteId;
      commentSkipped = c.commentSkipped;
    }
    return { remoteId: id, commentRemoteId, commentSkipped };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "LinkedIn error");
  }
}

async function linkedinComment(input: CommentInput): Promise<{ commentRemoteId?: string; commentSkipped?: string }> {
  const token = input.credentials?.accessToken ?? input.token;
  const author = input.credentials?.authorUrn;
  if (!author) return { commentSkipped: "LinkedIn author URN missing for comment" };
  const shareUrn = input.remoteId.startsWith("urn:") ? input.remoteId : `urn:li:share:${input.remoteId}`;
  const encoded = encodeURIComponent(shareUrn);
  const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encoded}/comments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify({ actor: author, message: { text: input.commentBody.trim() } }),
  });
  if (res.ok) return { commentRemoteId: res.headers.get("x-restli-id") || undefined };
  return { commentSkipped: `LinkedIn comment API unavailable (${res.status}) — Social Actions access required` };
}

/* ——— Mastodon ——— */
async function mastodonPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const instance = (input.credentials?.instance || "https://mastodon.social").replace(/\/$/, "");
  if (!hasToken(token)) {
    return missingCreds("Mastodon OAuth credentials are not configured — scheduled and queued honestly, not marked published");
  }
  try {
    const wantsImage = !!(publishImageUrl(input) || input.imageBytes);
    const image = wantsImage ? await resolvePublishImage(input) : undefined;
    if (wantsImage && !image) {
      return missingCreds("Mastodon image fetch failed — queued so the photo is not dropped");
    }
    let mediaId: string | undefined;
    if (image) {
      const form = new FormData();
      form.append("file", imageBlob(image.bytes, image.contentType), imageFilename(image.contentType));
      const up = await fetch(`${instance}/api/v1/media`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      if (!up.ok) {
        const err = await up.text();
        return missingCreds(`Mastodon media upload failed (${up.status}): ${err.slice(0, 200)}`);
      }
      const uploaded = (await up.json()) as { id?: string };
      mediaId = uploaded.id;
      if (!mediaId) return missingCreds("Mastodon media upload returned no id — queued");
    }
    const statusBody: Record<string, unknown> = { status: input.body };
    if (mediaId) statusBody.media_ids = [mediaId];
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(statusBody),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`Mastodon publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: string };
    const remoteId = data.id ?? crypto.randomUUID();
    let commentRemoteId: string | undefined;
    let commentSkipped: string | undefined;
    if (!input.skipComment && input.commentBody?.trim()) {
      const c = await mastodonComment({
        remoteId,
        commentBody: input.commentBody,
        handle: input.handle,
        token,
        credentials: input.credentials,
      });
      commentRemoteId = c.commentRemoteId;
      commentSkipped = c.commentSkipped;
    }
    return { remoteId, commentRemoteId, commentSkipped };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Mastodon error");
  }
}

async function mastodonComment(input: CommentInput): Promise<{ commentRemoteId?: string; commentSkipped?: string }> {
  const token = input.credentials?.accessToken ?? input.token;
  const instance = (input.credentials?.instance || "https://mastodon.social").replace(/\/$/, "");
  const reply = await fetch(`${instance}/api/v1/statuses`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: input.commentBody.trim(), in_reply_to_id: input.remoteId }),
  });
  if (!reply.ok) return { commentSkipped: `Mastodon reply failed (${reply.status})` };
  const rd = (await reply.json()) as { id?: string };
  return { commentRemoteId: rd.id };
}

type IgGraphData = { id?: string; status_code?: string; error?: { message?: string; code?: number } };

async function instagramGraph(
  host: string,
  version: string,
  path: string,
  token: string,
  instagramLogin: boolean,
  method: "GET" | "POST",
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: IgGraphData; detail: string }> {
  const headers: Record<string, string> = {};
  const params = new URLSearchParams(fields);
  params.set("access_token", token);
  let url = `${host}/${version}/${path}`;
  let body: string | undefined;
  if (method === "GET" || instagramLogin) {
    // Instagram Login /media is a query-string POST. A JSON body is Graph error 100: method type post.
    url = `${url}?${params}`;
  } else {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = params.toString();
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data: IgGraphData = {};
  try {
    data = JSON.parse(text) as IgGraphData;
  } catch {
    data = {};
  }
  const detail = (data.error?.message || text).slice(0, 200);
  return { ok: res.ok && !data.error, status: res.status, data, detail };
}

async function waitInstagramContainer(
  host: string,
  version: string,
  containerId: string,
  token: string,
  instagramLogin: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  for (let i = 0; i < 5; i++) {
    const status = await instagramGraph(host, version, containerId, token, instagramLogin, "GET", {
      fields: "status_code",
    });
    const code = status.data.status_code;
    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR" || code === "EXPIRED") {
      return { ok: false, reason: `Instagram media container ${code}: ${status.detail}` };
    }
    if (!status.ok && status.data.error) {
      return { ok: false, reason: `Instagram media container failed (${status.status}): ${status.detail}` };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { ok: false, reason: "Instagram media container was not ready to publish" };
}

/* ——— Meta: Instagram / Threads / Facebook ——— */
async function metaGraphPublish(
  input: PublishInput,
  kind: "instagram" | "threads" | "facebook",
): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const igUserId = input.credentials?.igUserId;
  const pageId = input.credentials?.pageId;
  const threadsUserId = input.credentials?.threadsUserId;
  const instagramLogin = kind === "instagram" && input.credentials?.authKind === "instagram_login";
  if (kind === "instagram" && (!hasToken(token) || !igUserId)) {
    return missingCreds(
      instagramLogin
        ? "Instagram user token / professional account id are not configured — scheduled and queued honestly, not marked published"
        : "Instagram Page token / professional account id are not configured — scheduled and queued honestly, not marked published",
    );
  }
  if (kind === "facebook" && (!hasToken(token) || !pageId)) {
    return missingCreds(
      "Facebook Page id / Page token are not configured — scheduled and queued honestly, not marked published",
    );
  }
  if (kind === "threads" && (!hasToken(token) || !threadsUserId)) {
    return missingCreds(
      "Threads user token / user id are not configured — scheduled and queued honestly, not marked published",
    );
  }
  try {
    if (kind === "facebook") {
      const imageUrl = publishImageUrl(input);
      if (imageUrl) {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: imageUrl, caption: input.body, access_token: token }),
        });
        if (!res.ok) {
          const err = await res.text();
          return missingCreds(`Facebook photo publish failed (${res.status}): ${err.slice(0, 200)}`);
        }
        const data = (await res.json()) as { id?: string; post_id?: string };
        return {
          remoteId: data.post_id ?? data.id ?? crypto.randomUUID(),
          commentSkipped: input.commentBody?.trim() ? "Facebook first-comment not implemented for Page feed posts" : undefined,
        };
      }
      if (input.imageBytes) {
        const form = new FormData();
        form.append(
          "source",
          imageBlob(input.imageBytes, input.imageContentType || "image/jpeg"),
          imageFilename(input.imageContentType || "image/jpeg"),
        );
        form.append("caption", input.body);
        form.append("access_token", token);
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.text();
          return missingCreds(`Facebook photo upload failed (${res.status}): ${err.slice(0, 200)}`);
        }
        const data = (await res.json()) as { id?: string; post_id?: string };
        return {
          remoteId: data.post_id ?? data.id ?? crypto.randomUUID(),
          commentSkipped: input.commentBody?.trim() ? "Facebook first-comment not implemented for Page feed posts" : undefined,
        };
      }
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input.body, access_token: token }),
      });
      if (!res.ok) {
        const err = await res.text();
        return missingCreds(`Facebook publish failed (${res.status}): ${err.slice(0, 200)}`);
      }
      const data = (await res.json()) as { id?: string };
      return {
        remoteId: data.id ?? crypto.randomUUID(),
        commentSkipped: input.commentBody?.trim() ? "Facebook first-comment not implemented for Page feed posts" : undefined,
      };
    }
    if (kind === "instagram") {
      const imageUrl = publishImageUrl(input);
      if (!imageUrl) {
        return missingCreds("Instagram Graph API requires an image URL for feed posts — queued until media is attached");
      }
      const graphHost = instagramLogin ? "https://graph.instagram.com" : "https://graph.facebook.com";
      const graphVersion = instagramLogin ? "v25.0" : "v21.0";
      const igPost = (path: string, fields: Record<string, string>) =>
        instagramGraph(graphHost, graphVersion, path, token, instagramLogin, "POST", fields);
      const created = await igPost(`${igUserId}/media`, { image_url: imageUrl, caption: input.body });
      if (!created.ok || !created.data.id) {
        return missingCreds(`Instagram media create failed (${created.status}): ${created.detail}`);
      }
      const ready = await waitInstagramContainer(graphHost, graphVersion, created.data.id, token, instagramLogin);
      if (!ready.ok) return missingCreds(ready.reason);
      const published = await igPost(`${igUserId}/media_publish`, { creation_id: created.data.id });
      if (!published.ok || !published.data.id) {
        return missingCreds(`Instagram publish failed (${published.status}): ${published.detail}`);
      }
      return {
        remoteId: published.data.id,
        commentSkipped: input.commentBody?.trim() ? "Instagram first-comment requires separate comment API scope" : undefined,
      };
    }
    const imageUrl = publishImageUrl(input);
    if (input.imageBytes && !imageUrl) {
      return missingCreds("Threads image posts need a public image URL — queued so the photo is not dropped");
    }
    const create = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        imageUrl
          ? { media_type: "IMAGE", image_url: imageUrl, text: input.body, access_token: token }
          : { media_type: "TEXT", text: input.body, access_token: token },
      ),
    });
    if (!create.ok) {
      const err = await create.text();
      return missingCreds(`Threads create failed (${create.status}): ${err.slice(0, 200)}`);
    }
    const created = (await create.json()) as { id?: string };
    const pub = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: token }),
    });
    if (!pub.ok) {
      const err = await pub.text();
      return missingCreds(`Threads publish failed (${pub.status}): ${err.slice(0, 200)}`);
    }
    const data = (await pub.json()) as { id?: string };
    return {
      remoteId: data.id ?? crypto.randomUUID(),
      commentSkipped: input.commentBody?.trim() ? "Threads reply API not wired — first comment skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : `${kind} error`);
  }
}

/* ——— YouTube ——— */
async function youtubeUploadVideo(
  token: string,
  input: PublishInput,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<PublishOk | PublishQueued> {
  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": contentType,
        "x-upload-content-length": String(bytes.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: input.body.slice(0, 100) || "Untitled",
          description: input.body,
        },
        status: { privacyStatus: "public" },
      }),
    },
  );
  const location = init.headers.get("location");
  if (!init.ok || !location) {
    const err = await init.text();
    return missingCreds(`YouTube resumable init failed (${init.status}): ${err.slice(0, 200)}`);
  }
  const put = await fetch(location, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!put.ok) {
    const err = await put.text();
    return missingCreds(`YouTube video upload failed (${put.status}): ${err.slice(0, 200)}`);
  }
  const data = (await put.json()) as { id?: string };
  return {
    remoteId: data.id ?? crypto.randomUUID(),
    commentSkipped: input.commentBody?.trim() ? "YouTube first-comment nested replies skipped" : undefined,
  };
}

async function youtubePublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  if (!hasToken(token)) {
    return missingCreds("YouTube OAuth credentials are not configured — scheduled and queued honestly, not marked published");
  }
  try {
    let bytes = input.videoBytes;
    let contentType = input.videoContentType || "video/mp4";
    if (!bytes && input.credentials?.videoUrl) {
      const fetched = await fetch(input.credentials.videoUrl);
      if (!fetched.ok) return missingCreds(`YouTube source video fetch failed (${fetched.status})`);
      bytes = await fetched.arrayBuffer();
      contentType = fetched.headers.get("content-type") || contentType;
    }
    if (bytes) {
      return youtubeUploadVideo(token, input, bytes, contentType);
    }
    return missingCreds("YouTube publish needs a video file — text-only posts stay queued");
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "YouTube error");
  }
}

/* ——— Reddit ——— */
async function redditPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.accessToken ?? input.token;
  const stored = (input.credentials?.subreddit || "").trim().replace(/^\/?r\//i, "");
  const fromHandle = /^u\//i.test(input.handle) ? "" : input.handle.replace(/^\/?r\//i, "");
  const subreddit = stored || fromHandle;
  if (!hasToken(token) || !subreddit) {
    return missingCreds("Reddit OAuth credentials / subreddit are not configured — stays queued");
  }
  try {
    if (publishImageUrl(input) || input.imageBytes) {
      return missingCreds("Reddit image upload is not wired — stays queued so the photo is not dropped");
    }
    const body = new URLSearchParams({
      kind: "self",
      sr: subreddit,
      title: input.body.slice(0, 100) || "Update",
      text: input.body,
      api_type: "json",
    });
    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": REDDIT_UA,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`Reddit publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { json?: { data?: { id?: string; name?: string } } };
    return {
      remoteId: data.json?.data?.name || data.json?.data?.id || crypto.randomUUID(),
      commentSkipped: input.commentBody?.trim() ? "Reddit first-comment (reply) not auto-posted" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Reddit error");
  }
}

/* ——— Hashnode ——— */
async function hashnodePublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.apiKey ?? input.token;
  const publicationId = input.credentials?.publicationId;
  if (!hasToken(token) || !publicationId) {
    return missingCreds("Hashnode token / publicationId not configured — stays queued");
  }
  if (publishImageUrl(input) || input.imageBytes) {
    return missingCreds("Hashnode image attach is not wired — stays queued so the photo is not dropped");
  }
  try {
    const res = await fetch("https://gql.hashnode.com", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token },
      body: JSON.stringify({
        query: `mutation Publish($input: PublishPostInput!) { publishPost(input: $input) { post { id } } }`,
        variables: {
          input: {
            title: input.body.slice(0, 80) || "Untitled",
            contentMarkdown: input.body,
            publicationId,
          },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`Hashnode publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { data?: { publishPost?: { post?: { id?: string } } }; errors?: unknown[] };
    if (data.errors?.length) return missingCreds("Hashnode GraphQL error — stays queued");
    return {
      remoteId: data.data?.publishPost?.post?.id ?? crypto.randomUUID(),
      commentSkipped: input.commentBody?.trim() ? "Hashnode has no first-comment API — skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Hashnode error");
  }
}

/* ——— Medium (removed) ——— */
async function mediumPublish(_input: PublishInput): Promise<PublishOk | PublishQueued> {
  return missingCreds("Medium was removed — this channel can no longer publish");
}

/* ——— dev.to ——— */
async function devtoPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const token = input.credentials?.apiKey ?? input.token;
  if (!hasToken(token)) {
    return missingCreds("dev.to API key not configured — stays queued");
  }
  if (publishImageUrl(input) || input.imageBytes) {
    return missingCreds("dev.to image attach is not wired — stays queued so the photo is not dropped");
  }
  try {
    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": token },
      body: JSON.stringify({
        article: {
          title: input.body.slice(0, 100) || "Untitled",
          body_markdown: input.body,
          published: true,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`dev.to publish failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: number };
    return {
      remoteId: String(data.id ?? crypto.randomUUID()),
      commentSkipped: input.commentBody?.trim() ? "dev.to has no first-comment API — skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "dev.to error");
  }
}

/* ——— Telegram ——— */
async function telegramPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const botToken = input.credentials?.botToken ?? input.token;
  const chatId = input.credentials?.chatId;
  if (!hasToken(botToken) || !chatId) {
    return missingCreds("Telegram bot token / chat id not configured — stays queued");
  }
  try {
    const imageUrl = publishImageUrl(input);
    if (imageUrl) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: input.body.slice(0, 1024) }),
      });
      if (!res.ok) {
        const err = await res.text();
        return missingCreds(`Telegram photo send failed (${res.status}): ${err.slice(0, 200)}`);
      }
      const data = (await res.json()) as { result?: { message_id?: number } };
      return {
        remoteId: String(data.result?.message_id ?? crypto.randomUUID()),
        commentSkipped: input.commentBody?.trim() ? "Telegram has no first-comment — skipped" : undefined,
      };
    }
    if (input.imageBytes) {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append(
        "photo",
        imageBlob(input.imageBytes, input.imageContentType || "image/jpeg"),
        imageFilename(input.imageContentType || "image/jpeg"),
      );
      form.append("caption", input.body.slice(0, 1024));
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.text();
        return missingCreds(`Telegram photo upload failed (${res.status}): ${err.slice(0, 200)}`);
      }
      const data = (await res.json()) as { result?: { message_id?: number } };
      return {
        remoteId: String(data.result?.message_id ?? crypto.randomUUID()),
        commentSkipped: input.commentBody?.trim() ? "Telegram has no first-comment — skipped" : undefined,
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: input.body }),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`Telegram send failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { result?: { message_id?: number } };
    return {
      remoteId: String(data.result?.message_id ?? crypto.randomUUID()),
      commentSkipped: input.commentBody?.trim() ? "Telegram has no first-comment — skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Telegram error");
  }
}

/* ——— Discord ——— */
async function discordPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const webhookUrl = input.credentials?.webhookUrl ?? input.token;
  if (!hasToken(webhookUrl) || !webhookUrl.startsWith("http")) {
    return missingCreds("Discord webhook URL not configured — stays queued");
  }
  try {
    const imageUrl = publishImageUrl(input);
    if (imageUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: input.body.slice(0, 2000),
          embeds: [{ image: { url: imageUrl } }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return missingCreds(`Discord webhook failed (${res.status}): ${err.slice(0, 200)}`);
      }
      return {
        remoteId: crypto.randomUUID(),
        commentSkipped: input.commentBody?.trim() ? "Discord webhook has no first-comment — skipped" : undefined,
      };
    }
    if (input.imageBytes) {
      const form = new FormData();
      form.append(
        "payload_json",
        JSON.stringify({ content: input.body.slice(0, 2000) }),
      );
      form.append(
        "files[0]",
        imageBlob(input.imageBytes, input.imageContentType || "image/jpeg"),
        imageFilename(input.imageContentType || "image/jpeg"),
      );
      const res = await fetch(webhookUrl, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.text();
        return missingCreds(`Discord webhook file failed (${res.status}): ${err.slice(0, 200)}`);
      }
      return {
        remoteId: crypto.randomUUID(),
        commentSkipped: input.commentBody?.trim() ? "Discord webhook has no first-comment — skipped" : undefined,
      };
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: input.body.slice(0, 2000) }),
    });
    if (!res.ok) {
      const err = await res.text();
      return missingCreds(`Discord webhook failed (${res.status}): ${err.slice(0, 200)}`);
    }
    return {
      remoteId: crypto.randomUUID(),
      commentSkipped: input.commentBody?.trim() ? "Discord webhook has no first-comment — skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Discord error");
  }
}

/* ——— Slack ——— */
async function slackPublish(input: PublishInput): Promise<PublishOk | PublishQueued> {
  const botToken = input.credentials?.botToken ?? input.token;
  const channelId = input.credentials?.channelId;
  if (!hasToken(botToken) || botToken.startsWith("http")) {
    return missingCreds("Slack bot token not configured — stays queued");
  }
  if (!channelId) {
    return missingCreds("Slack channel not selected — stays queued");
  }
  try {
    const imageUrl = publishImageUrl(input);
    if (input.imageBytes && !imageUrl) {
      return missingCreds("Slack image posts need a public image URL — queued so the photo is not dropped");
    }
    const slackBody: Record<string, unknown> = { channel: channelId, text: input.body.slice(0, 4000) };
    if (imageUrl) {
      slackBody.blocks = [
        { type: "section", text: { type: "mrkdwn", text: input.body.slice(0, 3000) } },
        { type: "image", image_url: imageUrl, alt_text: "Post image" },
      ];
    }
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(slackBody),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; ts?: string };
    if (!res.ok || !data.ok) {
      return missingCreds(`Slack chat.postMessage failed: ${data.error || res.status}`);
    }
    return {
      remoteId: data.ts ?? crypto.randomUUID(),
      commentSkipped: input.commentBody?.trim() ? "Slack has no first-comment API — skipped" : undefined,
    };
  } catch (e) {
    return missingCreds(e instanceof Error ? e.message : "Slack error");
  }
}

export const adapters: Record<Network, NetworkAdapter> = {
  linkedin: { network: "linkedin", publish: linkedinPublish, comment: linkedinComment },
  x: { network: "x", publish: xPublish, comment: xComment },
  instagram: {
    network: "instagram",
    publish: (i) => metaGraphPublish(i, "instagram"),
  },
  threads: {
    network: "threads",
    publish: (i) => metaGraphPublish(i, "threads"),
  },
  facebook: {
    network: "facebook",
    publish: (i) => metaGraphPublish(i, "facebook"),
  },
  youtube: { network: "youtube", publish: youtubePublish },
  reddit: { network: "reddit", publish: redditPublish },
  bluesky: { network: "bluesky", publish: blueskyPublish, comment: blueskyComment },
  mastodon: { network: "mastodon", publish: mastodonPublish, comment: mastodonComment },
  hashnode: { network: "hashnode", publish: hashnodePublish },
  medium: { network: "medium", publish: mediumPublish },
  devto: { network: "devto", publish: devtoPublish },
  telegram: { network: "telegram", publish: telegramPublish },
  discord: { network: "discord", publish: discordPublish },
  slack: { network: "slack", publish: slackPublish },
};
