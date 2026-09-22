export type Network = "x" | "bluesky" | "linkedin" | "mastodon";

export type NetworkAdapter = {
  network: Network;
  publish(input: {
    body: string;
    handle: string;
    token: string;
    credentials?: Record<string, string>;
  }): Promise<{ remoteId: string } | { queued: true; reason: string }>;
};

async function blueskyPublish(input: {
  body: string;
  handle: string;
  token: string;
  credentials?: Record<string, string>;
}) {
  const service = input.credentials?.service ?? "https://bsky.social";
  const identifier = input.credentials?.identifier ?? input.handle;
  const password = input.credentials?.appPassword ?? input.token;
  if (!password || password === "pending") {
    return { queued: true as const, reason: "Bluesky credentials not configured — post stays queued until connect completes" };
  }
  try {
    const sessionRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!sessionRes.ok) {
      return { queued: true as const, reason: `Bluesky auth failed (${sessionRes.status})` };
    }
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
    if (!postRes.ok) {
      return { queued: true as const, reason: `Bluesky publish failed (${postRes.status})` };
    }
    const data = (await postRes.json()) as { uri?: string };
    return { remoteId: data.uri ?? crypto.randomUUID() };
  } catch (e) {
    return { queued: true as const, reason: e instanceof Error ? e.message : "Bluesky error" };
  }
}

function stubAdapter(network: Network): NetworkAdapter {
  return {
    network,
    async publish() {
      return {
        queued: true,
        reason: `${network} OAuth credentials are not configured in this deployment — scheduled and queued honestly, not marked published`,
      };
    },
  };
}

export const adapters: Record<Network, NetworkAdapter> = {
  bluesky: { network: "bluesky", publish: blueskyPublish },
  x: stubAdapter("x"),
  linkedin: stubAdapter("linkedin"),
  mastodon: stubAdapter("mastodon"),
};

export const NETWORKS: Network[] = ["bluesky", "x", "linkedin", "mastodon"];
