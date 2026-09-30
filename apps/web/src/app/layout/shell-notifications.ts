import { Component, ElementRef, input, output, viewChild } from "@angular/core";
import { RouterLink } from "@angular/router";
import { labelNetwork, labelStatus } from "../lib/labels";

export type AlertPost = { id: string; body: string; status: string; issues?: { network: string; handle: string; status: string; error: string | null }[]; channels?: { accountId?: string }[] };

@Component({
  selector: "dk-shell-notifications",
  standalone: true,
  imports: [RouterLink],
  template: `
    <dialog #panel aria-label="Delivery updates" class="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[80dvh] overflow-y-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          <header class="flex items-start justify-between gap-3 border-b border-[#e8e8e3] px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 class="font-display text-base font-bold text-[#09090b] dark:text-zinc-50">Delivery updates</h2>
              <p class="mt-0.5 text-[12px] text-[#63676c] dark:text-zinc-400">{{ posts().length ? posts().length + ' post' + (posts().length === 1 ? '' : 's') + ' to check' : (company() || 'Failed posts and posts still waiting to publish') }}</p>
            </div>
            <button type="button" (click)="panel.close()" class="min-h-11 px-2 text-[12px] font-semibold text-[#52525b] hover:text-[#09090b] dark:text-zinc-400">Close</button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto">
            @if (error()) {
              <div class="px-4 py-6" role="alert">
                <p class="text-sm">{{ error() }}</p>
                <button type="button" (click)="retry.emit()" class="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-semibold">Retry notifications</button>
              </div>
            } @else {
            @for (post of posts(); track post.id) {
              <a [routerLink]="'/app/compose'" [queryParams]="{ post: post.id }" (click)="panel.close()" class="block border-b border-[#e8e8e3] px-4 py-3 hover:bg-[#f7f7f4] dark:border-zinc-800 dark:hover:bg-zinc-800">
                <p class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" [class.bg-amber-100]="post.status==='failed'" [class.text-amber-950]="post.status==='failed'" [class.bg-[#f3f3f0]]="post.status!=='failed'" [class.text-[#3f3f46]]="post.status!=='failed'">{{ labelStatus(post.status) }}</p>
                <p class="mt-2 line-clamp-2 text-[14px] font-medium leading-snug text-[#121417] dark:text-zinc-100">{{ post.body || 'Untitled post' }}</p>
                @for (issue of post.issues || []; track issue.network + issue.handle) {
                  <p class="mt-1 text-[13px] leading-snug text-[#3f3f46] dark:text-zinc-300">{{ labelNetwork(issue.network) }} · {{ issue.handle }}</p>
                  <p class="text-[13px] leading-snug text-amber-800 dark:text-amber-200">{{ issue.error || labelStatus(issue.status) }}</p>
                } @empty {
                  <p class="mt-1 text-[13px] text-[#63676c] dark:text-zinc-400">Open the post to see what is holding it.</p>
                }
              </a>
            } @empty {
              <div class="px-4 py-8">
                <p class="font-display text-base font-bold text-[#09090b] dark:text-zinc-50">Nothing waiting</p>
                <p class="mt-1 text-[13px] leading-relaxed text-[#63676c] dark:text-zinc-400">When a post fails or stays in the queue{{ company() ? ' for ' + company() : '' }}, it shows up here with the channel and the reason.</p>
              </div>
            }
            }
          </div>
          <a routerLink="/app" (click)="panel.close()" class="block border-t border-[#e8e8e3] px-4 py-3 text-[13px] font-semibold text-[#09090b] hover:bg-[#f7f7f4] dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800">View posts</a>

    </dialog>
  `,
})
export class ShellNotifications {
  readonly posts = input<AlertPost[]>([]);
  readonly company = input("");
  readonly error = input("");
  readonly retry = output<void>();
  readonly labelStatus = labelStatus;
  readonly labelNetwork = labelNetwork;
  private readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>("panel");
  open() { this.panel().nativeElement.showModal(); }
  close() { if (this.panel().nativeElement.open) this.panel().nativeElement.close(); }
}
