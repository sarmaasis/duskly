import { Component, OnInit, computed, effect, inject, signal, untracked } from "@angular/core";
import { RouterLink } from "@angular/router";
import { api } from "../lib/api";
import { CompanyDesk } from "../lib/company-desk";
import { Spinner } from "../ui/spinner";
import { ScrollMore } from "../ui/scroll-more";

type Item = { id: string; kind: string; previewUrl: string; bytes: number; groupId?: string | null };

@Component({
  standalone: true,
  imports: [RouterLink, Spinner, ScrollMore],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 flex items-end justify-between gap-3">
        <div>
          <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Publishing</p>
          <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Media library</h1>
          <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">
            @if (desk.current(); as company) {
              Pictures and videos for {{ company.name }}.
            } @else {
              Your reusable photos and videos. Select Use to attach a file to a post.
            }
          </p>
        </div>
      </div>
      @if (error()) {
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">{{ error() }}</p>
      }
      @for (section of sections(); track section.id) {
        <section class="mb-8">
          @if (!desk.current()) {
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="font-display text-lg font-bold text-[#121417] dark:text-zinc-50">{{ section.name }}</h2>
              @if (section.id) {
                <button type="button" (click)="desk.select(section.id)" class="text-[12px] font-semibold text-cta hover:text-cta-hover">Open {{ section.name }}</button>
              }
            </div>
          }
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            @for (item of section.items; track item.id) {
              <figure class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
                @if (item.kind === 'video' || item.kind === 'clip') {
                  <div class="flex h-36 items-center justify-center bg-[#f7f7f4] text-[11px] font-semibold text-[#71717a] dark:bg-zinc-800">Video</div>
                } @else {
                  <img [src]="item.previewUrl" alt="" class="h-36 w-full object-cover" />
                }
                <figcaption class="flex items-center justify-between px-2 py-1.5">
                  <span class="font-mono text-[10px] text-[#a1a1aa]">{{ item.kind }}</span>
                  <a [routerLink]="['/app/compose']" [queryParams]="{ media: item.id }" class="text-[11px] font-semibold text-cta">Use</a>
                </figcaption>
              </figure>
            }
          </div>
        </section>
      } @empty {
        @if (loading()) {
          <div class="flex justify-center text-cta"><dk-spinner [size]="20" label="Loading" [block]="true" /></div>
        } @else {
          <p class="text-sm text-[#63676c] dark:text-zinc-400">{{ emptyCopy() }}</p>
        }
      }
      <div class="flex h-10 items-center justify-center" dkScrollMore [dkScrollEnabled]="next() != null" [dkScrollBusy]="paging()" (dkScrollMoreFire)="more()">
        @if (paging()) { <dk-spinner [size]="16" label="Loading more" /> }
      </div>
    </div>
  `,
})
export class MediaPage implements OnInit {
  readonly desk = inject(CompanyDesk);
  items = signal<Item[]>([]);
  loading = signal(true);
  sections = computed(() => {
    const items = this.items();
    const current = this.desk.current();
    if (current) return [{ id: current.id, name: current.name, items }];
    const buckets = new Map<string, Item[]>();
    for (const item of items) {
      const key = item.groupId || "";
      const list = buckets.get(key) || [];
      list.push(item);
      buckets.set(key, list);
    }
    const known = new Set(this.desk.companies().map((company) => company.id));
    const sections = this.desk.companies()
      .filter((company) => buckets.has(company.id))
      .map((company) => ({ id: company.id, name: company.name, items: buckets.get(company.id)! }));
    for (const [id, rows] of buckets) {
      if (id && !known.has(id)) sections.push({ id, name: "Company", items: rows });
    }
    const loose = buckets.get("");
    if (loose?.length) sections.push({ id: "", name: "Unassigned", items: loose });
    return sections;
  });
  next = signal<number | null>(null);
  paging = signal(false);
  error = signal("");
  private workspaceId = signal("");
  private companyId = "";

  constructor() {
    effect(() => {
      const ws = this.workspaceId();
      const companyId = this.desk.selectedId();
      if (!ws) return;
      untracked(() => void this.reload(companyId));
    });
  }

  emptyCopy() {
    const company = this.desk.current();
    return company ? `Nothing uploaded for ${company.name} yet.` : "Nothing uploaded yet.";
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId.set(me.workspace.id);
    } catch {
      this.error.set("Could not load the library.");
      this.loading.set(false);
    }
  }

  async reload(companyId: string) {
    this.companyId = companyId;
    this.loading.set(true);
    this.items.set([]);
    this.next.set(null);
    this.error.set("");
    await this.page(0, true);
  }

  async more() {
    const offset = this.next();
    if (offset == null || this.paging()) return;
    this.paging.set(true);
    try {
      await this.page(offset, false);
    } finally {
      this.paging.set(false);
    }
  }

  private async page(offset: number, replace: boolean) {
    const companyId = this.companyId;
    const q = new URLSearchParams({ workspaceId: this.workspaceId(), offset: String(offset) });
    if (companyId) q.set("groupId", companyId);
    try {
      const data = await api<{ media: Item[]; next: number | null }>(`/v1/media?${q}`);
      if (this.companyId !== companyId) return;
      this.items.update((rows) => (replace ? data.media || [] : rows.concat(data.media || [])));
      this.next.set(data.next);
    } catch {
      if (this.companyId === companyId) this.error.set("Could not load the library.");
    } finally {
      if (this.companyId === companyId) this.loading.set(false);
    }
  }
}
