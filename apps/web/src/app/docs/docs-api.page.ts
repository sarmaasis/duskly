import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto grid max-w-5xl gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article class="min-w-0">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">API</p>
        <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Authentication &amp; endpoints</h1>
        <p class="mt-4 text-[15px] leading-relaxed text-[#52525b]">
          Base URL for Duskly Cloud: <code class="rounded bg-[#f4f4f1] px-1.5 py-0.5 font-mono text-[13px]">https://api.duskly.site</code>.
          Self-host uses your own API origin. All <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">/v1/*</code> routes need auth.
        </p>

        <h2 id="auth" class="mt-10 scroll-mt-24 font-display text-xl font-bold">API tokens</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          In the app, open <span class="font-semibold text-[#09090b]">Settings → API tokens</span> and create a token.
          The secret is shown once and starts with <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">dk_</code>.
        </p>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Send it as <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">Authorization: Bearer dk_…</code>
          or <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">X-Api-Token: dk_…</code>.
          Tokens are scoped to the workspace that minted them. Session cookies from Sign in also work for browser clients.
        </p>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          Routes below that show <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">workspaceId</code> still need that
          value in the query string or body — the token does not fill it in. Copy it from
          <a routerLink="/app/settings" class="font-semibold text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Settings</a>
          (the Workspace ID row). MCP tools do not take this id; they use the token’s workspace automatically.
        </p>

        <h2 id="posts" class="mt-10 scroll-mt-24 font-display text-xl font-bold">Posts</h2>
        <div class="mt-4 space-y-6 text-[14px] leading-relaxed text-[#52525b]">
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">GET /v1/posts?workspaceId=…</p>
            <p class="mt-1">List posts for an account (newest scheduled first). <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">limit</code> defaults to 50 (max 100) and <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">offset</code> skips that many. <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">next</code> is the next offset, or null. The same query works on accounts, media, and inbox.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">POST /v1/posts</p>
            <p class="mt-1">Create a draft or scheduled post. Body includes <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">workspaceId</code> (copy from Settings). <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">destinations</code> is an array of social account ids. <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">scheduledAt</code> is unix milliseconds.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">POST /v1/posts/:id/queue-now</p>
            <p class="mt-1">Push a scheduled post into the publish queue immediately.</p>
          </div>
        </div>

        <h2 id="accounts" class="mt-10 scroll-mt-24 font-display text-xl font-bold">Accounts (channels)</h2>
        <div class="mt-4 space-y-6 text-[14px] leading-relaxed text-[#52525b]">
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">GET /v1/accounts?workspaceId=…</p>
            <p class="mt-1">List connected channels.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">POST /v1/accounts</p>
            <p class="mt-1">Add a channel (network + handle / credentials as required by that network).</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">PATCH /v1/accounts/:id</p>
            <p class="mt-1">Update channel settings (e.g. Slack default channel).</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">DELETE /v1/accounts/:id?workspaceId=…</p>
            <p class="mt-1">Disconnect a channel.</p>
          </div>
        </div>

        <h2 id="media" class="mt-10 scroll-mt-24 font-display text-xl font-bold">Media</h2>
        <div class="mt-4 space-y-6 text-[14px] leading-relaxed text-[#52525b]">
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">GET /v1/media?workspaceId=…</p>
            <p class="mt-1">List media library items.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">POST /v1/media/upload</p>
            <p class="mt-1">Multipart form: <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">workspaceId</code> + <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">file</code>.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">GET /v1/media/:id/file?workspaceId=…</p>
            <p class="mt-1">Download the stored file bytes.</p>
          </div>
          <div>
            <p class="font-mono text-[12px] font-semibold text-[#09090b]">POST /v1/media/edit</p>
            <p class="mt-1">Apply a picture edit and store the result in the library.</p>
          </div>
        </div>

        <h2 id="tokens" class="mt-10 scroll-mt-24 font-display text-xl font-bold">Mint tokens via API</h2>
        <p class="mt-3 text-[14px] leading-relaxed text-[#52525b]">
          <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">POST /v1/org/tokens</code> with
          <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">workspaceId</code> (copy from Settings) and name (session auth).
          Response includes the raw token once. The minted token can only act on that workspace.
        </p>
      </article>

      <aside class="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">Examples</p>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">Create scheduled post</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ createPost }}</pre>
        </div>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">List channels</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ listAccounts }}</pre>
        </div>
        <div class="overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#18181b]">
          <div class="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] text-zinc-400">Upload media</div>
          <pre class="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ uploadMedia }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class DocsApiPage {
  readonly createPost = `# workspaceId: copy from Settings
curl -X POST https://api.duskly.site/v1/posts \\
  -H "Authorization: Bearer dk_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspaceId": "YOUR_WORKSPACE_ID",
    "body": "Launch drops Thursday.",
    "status": "scheduled",
    "scheduledAt": 1735689600000,
    "destinations": ["ACCT_ID"]
  }'`;

  readonly listAccounts = `# workspaceId: copy from Settings
curl -s \\
  -H "Authorization: Bearer dk_…" \\
  "https://api.duskly.site/v1/accounts?workspaceId=YOUR_WORKSPACE_ID"`;

  readonly uploadMedia = `# workspaceId: copy from Settings
curl -X POST https://api.duskly.site/v1/media/upload \\
  -H "Authorization: Bearer dk_…" \\
  -F "workspaceId=YOUR_WORKSPACE_ID" \\
  -F "file=@./clip.mp4"`;
}
