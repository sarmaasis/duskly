#!/usr/bin/env node
const base = (process.env.DUSKLY_API || "https://api.duskly.site").replace(/\/$/, "");
const token = process.env.DUSKLY_TOKEN || "";

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || "" : "";
}

function usage() {
  console.log(`Duskly CLI

  DUSKLY_TOKEN=dk_… DUSKLY_WORKSPACE=… pnpm duskly channels
  DUSKLY_TOKEN=dk_… DUSKLY_WORKSPACE=… pnpm duskly posts
  DUSKLY_TOKEN=dk_… DUSKLY_WORKSPACE=… pnpm duskly schedule --body "Hello" --at 1735689600000 --channels acct_id
  DUSKLY_TOKEN=dk_… pnpm duskly pause --id post_id

  DUSKLY_API overrides the API origin (default https://api.duskly.site).`);
}

async function main() {
  const cmd = process.argv.slice(2).find((part) => !part.startsWith("--"));
  if (!cmd || cmd === "help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }
  if (!token.startsWith("dk_")) {
    console.error("Set DUSKLY_TOKEN to a dk_ API token from Settings.");
    process.exit(1);
  }
  const workspace = flag("--workspace") || process.env.DUSKLY_WORKSPACE || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (cmd === "channels" || cmd === "posts") {
    if (!workspace) {
      console.error("Set DUSKLY_WORKSPACE or pass --workspace.");
      process.exit(1);
    }
    const path = cmd === "channels" ? "accounts" : "posts";
    const res = await fetch(`${base}/v1/${path}?workspaceId=${encodeURIComponent(workspace)}`, { headers });
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    console.log(text);
    return;
  }

  if (cmd === "schedule") {
    if (!workspace) {
      console.error("Set DUSKLY_WORKSPACE or pass --workspace.");
      process.exit(1);
    }
    const body = flag("--body");
    const at = Number(flag("--at"));
    const destinations = flag("--channels").split(",").map((id) => id.trim()).filter(Boolean);
    if (!body || !Number.isFinite(at) || !destinations.length) {
      console.error("schedule needs --body, --at (unix ms), and --channels (comma-separated ids).");
      process.exit(1);
    }
    const res = await fetch(`${base}/v1/posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workspaceId: workspace, body, status: "scheduled", scheduledAt: at, destinations }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    console.log(text);
    return;
  }

  if (cmd === "pause") {
    const id = flag("--id");
    if (!id) {
      console.error("pause needs --id.");
      process.exit(1);
    }
    const res = await fetch(`${base}/v1/posts/${encodeURIComponent(id)}/pause`, { method: "POST", headers });
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    console.log(text);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
