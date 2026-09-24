import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { SessionService } from "../lib/session";

export const CF_DEPLOY =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/sarmaasis/duskly";

@Component({
  standalone: true,
  selector: "dk-marketing-footer",
  imports: [RouterLink],
  template: `
    <footer class="border-t border-[#e4e4e7] bg-white">
      <div class="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6">
        <div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
          <div class="col-span-2 space-y-3">
            <a routerLink="/" class="font-display text-[15px] font-extrabold tracking-tight text-[#09090b]">
              Dus<span class="text-cta">kly</span>
            </a>
            <p class="max-w-xs text-[13px] leading-5 text-[#52525b]">Open-source scheduler. Self-host free, or use Duskly Cloud.</p>
            <a [href]="cfDeploy" class="inline-block font-mono text-[12px] text-[#09090b] underline decoration-cta decoration-2 underline-offset-4">Deploy to Cloudflare</a>
          </div>
          <div class="space-y-2.5 font-mono text-[12px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#09090b]">Product</p>
            <a routerLink="/" class="block text-[#52525b] hover:text-[#09090b]">Home</a>
            <a routerLink="/pricing" class="block text-[#52525b] hover:text-[#09090b]">Pricing</a>
            <a routerLink="/docs" class="block text-[#52525b] hover:text-[#09090b]">Docs</a>
            <a routerLink="/signin" class="block text-[#52525b] hover:text-[#09090b]">Sign in</a>
          </div>
          <div class="space-y-2.5 font-mono text-[12px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#09090b]">Resources</p>
            <a routerLink="/blog" class="block text-[#52525b] hover:text-[#09090b]">Blog</a>
            <a routerLink="/tools" class="block text-[#52525b] hover:text-[#09090b]">Free tools</a>
          </div>
          <div class="space-y-2.5 font-mono text-[12px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#09090b]">Account</p>
            @if (session.loggedIn()) {
              <a routerLink="/app" class="block text-[#52525b] hover:text-[#09090b]">Open dashboard</a>
            } @else {
              <a routerLink="/signup" class="block text-[#52525b] hover:text-[#09090b]">Start scheduling</a>
            }
          </div>
          <div class="space-y-2.5 font-mono text-[12px]">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#09090b]">Legal</p>
            <a routerLink="/privacy" class="block text-[#52525b] hover:text-[#09090b]">Privacy</a>
            <a routerLink="/terms" class="block text-[#52525b] hover:text-[#09090b]">Terms</a>
            <a routerLink="/data-deletion" class="block text-[#52525b] hover:text-[#09090b]">Data deletion</a>
          </div>
        </div>
        <div class="flex flex-col gap-2 border-t border-[#e4e4e7] pt-6 font-mono text-[12px] text-[#71717a] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Duskly.</p>
          <p>Cloud billing by Dodo Payments.</p>
        </div>
      </div>
    </footer>
  `,
})
export class MarketingFooter {
  readonly session = inject(SessionService);
  readonly cfDeploy = CF_DEPLOY;
}
