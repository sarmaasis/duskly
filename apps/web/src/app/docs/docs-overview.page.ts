import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto grid max-w-5xl gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <article class="min-w-0">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-widest text-cta">Overview</p>
        <h1 class="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Duskly docs</h1>
        <p class="mt-4 text-[15px] leading-relaxed text-[#52525b]">
          Duskly is a social scheduler for U.S. creators, agencies, and brands. Write once, pick channels, and publish when the calendar says so—self-host free, or use Duskly Cloud from $29/mo.
        </p>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">What you can do</h2>
        <ul class="mt-4 space-y-3 text-[14px] leading-relaxed text-[#52525b]">
          <li><span class="font-semibold text-[#09090b]">Compose &amp; calendar</span> — draft posts, attach media, schedule LinkedIn, X, Instagram, and more.</li>
          <li><span class="font-semibold text-[#09090b]">Connect channels</span> — connect each network; posts stay queued until a channel is ready.</li>
          <li><span class="font-semibold text-[#09090b]">API &amp; agents</span> — mint <code class="rounded bg-[#f4f4f1] px-1 font-mono text-[12px]">dk_</code> tokens for scripts, or drive scheduling from Cursor/Claude via MCP.</li>
        </ul>

        <h2 class="mt-10 scroll-mt-24 font-display text-xl font-bold">Where to go next</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <a routerLink="/docs/api" class="rounded-lg border border-[#e4e4e7] bg-white p-4 hover:border-zinc-300">
            <p class="text-sm font-bold">API authentication</p>
            <p class="mt-1 text-xs text-[#52525b]">Bearer tokens and core endpoints</p>
          </a>
          <a routerLink="/docs/agents" class="rounded-lg border border-[#e4e4e7] bg-white p-4 hover:border-zinc-300">
            <p class="text-sm font-bold">Agents</p>
            <p class="mt-1 text-xs text-[#52525b]">In-app smart agent and external agents</p>
          </a>
          <a routerLink="/docs/mcp" class="rounded-lg border border-[#e4e4e7] bg-white p-4 hover:border-zinc-300">
            <p class="text-sm font-bold">MCP</p>
            <p class="mt-1 text-xs text-[#52525b]">Connect Cursor or Claude</p>
          </a>
          <a routerLink="/signin" class="rounded-lg border border-[#e4e4e7] bg-white p-4 hover:border-zinc-300">
            <p class="text-sm font-bold">Open the app</p>
            <p class="mt-1 text-xs text-[#52525b]">Sign in to schedule posts</p>
          </a>
        </div>
      </article>

      <aside class="min-w-0">
        <div class="space-y-3 xl:sticky xl:top-20">
          <p class="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">Quick start</p>
          <pre class="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-[#18181b] p-4 font-mono text-[11px] leading-relaxed text-zinc-300">{{ quickStart }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class DocsOverviewPage {
  readonly quickStart = `# Mint a token in Settings → API tokens
# Then list posts:

curl -s \\
  -H "Authorization: Bearer dk_…" \\
  "https://api.duskly.site/v1/posts?workspaceId=WS_ID"`;
}
