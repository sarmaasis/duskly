import type { Env } from "../env";
import { apiPublicOrigin, PUBLIC_MEDIA_TTL_SEC, signPublicMediaSig, verifyPublicMediaSig } from "./media-signed-url";

/** Best-effort profile image. A failure must not block connecting the account. */
export async function remoteProfilePicture(network: string, token: string, credentials: Record<string, string>): Promise<string | null> {
  try {
    if (!token && network !== "bluesky") return null;
    if (network === "x") {
      const res = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { data?: { profile_image_url?: string } };
      return data.data?.profile_image_url?.replace("_normal", "_400x400") || null;
    }
    if (network === "linkedin") {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${token}` } });
      const data = (await res.json()) as { picture?: string };
      return data.picture || null;
    }
    if (network === "mastodon" && credentials.instance) {
      const res = await fetch(`${credentials.instance.replace(/\/$/, "")}/api/v1/accounts/verify_credentials`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { avatar?: string };
      return data.avatar || null;
    }
    if (network === "youtube") {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { items?: { snippet?: { thumbnails?: { medium?: { url?: string } } } }[] };
      return data.items?.[0]?.snippet?.thumbnails?.medium?.url || null;
    }
    if (network === "reddit") {
      const res = await fetch("https://oauth.reddit.com/api/v1/me", {
        headers: { authorization: `Bearer ${token}`, "user-agent": "duskly" },
      });
      const data = (await res.json()) as { icon_img?: string };
      return data.icon_img?.split("?")[0] || null;
    }
    if (network === "bluesky") {
      const actor = (credentials.identifier || credentials.handle || "").replace(/^@/, "");
      if (!actor) return null;
      const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`);
      const data = (await res.json()) as { avatar?: string };
      return data.avatar || null;
    }
    if (network === "instagram") {
      for (const id of [...new Set([credentials.igUserId, "me"].filter(Boolean))]) {
        try {
          const res = await fetch(
            `https://graph.instagram.com/v21.0/${id}?fields=profile_picture_url&access_token=${encodeURIComponent(token)}`,
            { signal: AbortSignal.timeout(4000) },
          );
          const data = (await res.json()) as { profile_picture_url?: string };
          if (data.profile_picture_url) return data.profile_picture_url;
        } catch {
          /* try the next profile endpoint */
        }
      }
      return null;
    }
    if (network === "threads") {
      const id = credentials.threadsUserId || "me";
      const res = await fetch(
        `https://graph.threads.net/v1.0/${id}?${new URLSearchParams({
          fields: "threads_profile_picture_url",
          access_token: token,
        })}`,
        { signal: AbortSignal.timeout(4000) },
      );
      const data = (await res.json()) as { threads_profile_picture_url?: string };
      return data.threads_profile_picture_url || null;
    }
    if (network === "facebook" && credentials.pageId) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${credentials.pageId}/picture?type=large&redirect=false&access_token=${encodeURIComponent(token)}`);
      const data = (await res.json()) as { data?: { url?: string } };
      return data.data?.url || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Browser-ready picture: a stored https URL, or a signed URL for an R2 avatar. */
export async function displayAvatarUrl(env: Env, accountId: string, stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("https://")) return stored;
  if (!stored.startsWith("avatars/")) return null;
  return signAvatarUrl(env, accountId);
}

export async function signAvatarUrl(env: Env, accountId: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + PUBLIC_MEDIA_TTL_SEC;
  const sig = await signPublicMediaSig(env, `avatar.${accountId}`, exp);
  return `${apiPublicOrigin(env)}/v1/accounts/${accountId}/avatar/public?exp=${exp}&sig=${sig}`;
}

export function verifyAvatarSig(env: Env, accountId: string, exp: string | undefined, sig: string | undefined, nowMs = Date.now()) {
  return verifyPublicMediaSig(env, `avatar.${accountId}`, exp, sig, nowMs);
}

/** Fetch and store a profile picture. Returns the value to save on the account. */
export async function captureProfilePicture(
  env: Env,
  account: { id: string; workspaceId: string; network: string; handle?: string | null },
  credentials: Record<string, string>,
): Promise<string | null> {
  const token = credentials.accessToken || credentials.botToken || "";
  const remote = await remoteProfilePicture(account.network, token, {
    ...credentials,
    handle: credentials.handle || account.handle || "",
  });
  if (!remote) return null;
  return storeProfilePicture(env, account.workspaceId, account.id, remote);
}

/** Copy the picture into R2. Falls back to the remote URL when the copy fails. */
export async function storeProfilePicture(env: Env, workspaceId: string, accountId: string, remote: string): Promise<string | null> {
  if (!remote.startsWith("https://")) return null;
  try {
    const res = await fetch(remote);
    if (!res.ok) return remote;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!type.startsWith("image/")) return remote;
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 1_500_000) return remote;
    const key = `avatars/${workspaceId}/${accountId}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    return key;
  } catch {
    return remote;
  }
}
