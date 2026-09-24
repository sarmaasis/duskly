import { Component, inject, signal, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { api } from "../lib/api";
import { lsSet } from "../lib/browser";

type Channel = { accountId?: string; network: string; handle: string; status: string };
type Preview = { url: string; kind: string };
type Post = {
  id: string;
  body: string;
  status: string;
  scheduledAt: string | Date | null;
  preview?: Preview | null;
  channels?: Channel[];
  issues?: { network: string; handle: string; status: string; error: string | null }[];
};

type Cell = { key: string; day: number; inMonth: boolean; today: boolean; posts: Post[] };

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <button type="button" (click)="shiftMonth(-1)" class="inline-flex size-9 items-center justify-center rounded-full border border-[#e8e8e3] bg-white text-[#121417] hover:bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" aria-label="Previous month">‹</button>
          <h1 class="min-w-[10rem] text-center font-display text-xl font-bold tracking-tight dark:text-zinc-50">{{ monthLabel() }}</h1>
          <button type="button" (click)="shiftMonth(1)" class="inline-flex size-9 items-center justify-center rounded-full border border-[#e8e8e3] bg-white text-[#121417] hover:bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" aria-label="Next month">›</button>
          <button type="button" (click)="goToday()" class="ml-1 h-9 rounded-full border border-[#e8e8e3] bg-white px-3 text-xs font-semibold text-[#52525b] hover:text-[#09090b] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Today</button>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-full border border-[#e8e8e3] bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900" role="tablist" aria-label="Calendar view">
            @for (tab of tabs; track tab.id) {
              <button type="button" role="tab" (click)="setView(tab.id)" [attr.aria-selected]="view()===tab.id" class="h-8 rounded-full px-3 text-xs font-semibold" [class.bg-[#09090b]]="view()===tab.id" [class.text-white]="view()===tab.id" [class.text-[#71717a]]="view()!==tab.id">{{ tab.label }}</button>
            }
          </div>
          <a routerLink="/app/compose" class="inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">New post</a>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <select class="h-9 rounded-full border border-[#e8e8e3] bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" [value]="filterNetwork()" (change)="filterNetwork.set($any($event.target).value); rebuild()">
          <option value="">All channels</option>
          @for (n of networks(); track n) { <option [value]="n">{{ n }}</option> }
        </select>
        <select class="h-9 rounded-full border border-[#e8e8e3] bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900" [value]="filterStatus()" (change)="filterStatus.set($any($event.target).value); rebuild()">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </div>

      @if (error()) {
        <p class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#e8e8e3] bg-[#e8e8e3] dark:border-zinc-700 dark:bg-zinc-800">
          @for (n of skeleton; track n) {
            <div class="h-28 animate-pulse bg-[#f7f7f4] dark:bg-zinc-900"></div>
          }
        </div>
      } @else if (view() === 'month' || view() === 'week') {
        <div class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div class="grid grid-cols-7 border-b border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800">
            @for (d of dow; track d) {
              <div class="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (cell of monthCells(); track cell.key) {
              <button type="button" (click)="openDay(cell)" (dragover)="$event.preventDefault()" (drop)="dropOn($event, cell)" class="flex min-h-32 flex-col border-b border-r border-[#e8e8e3] p-1.5 text-left hover:bg-[#fcfcf9] dark:border-zinc-800 dark:hover:bg-zinc-800/40" [class.bg-[#f7f7f4]/70]="!cell.inMonth" [class.dark:bg-zinc-950]="!cell.inMonth" [class.cursor-pointer]="cell.posts.length">
                <span class="mb-1 inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold" [class.bg-cta]="cell.today" [class.text-white]="cell.today" [class.text-[#a1a1aa]]="!cell.inMonth && !cell.today" [class.dark:text-zinc-200]="cell.inMonth && !cell.today">{{ cell.day }}</span>
                @for (p of cell.posts; track p.id) {
                  <span draggable="true" (dragstart)="dragPost($event, p)" (click)="$event.stopPropagation(); edit(p)" class="flex min-h-0 cursor-grab flex-col overflow-hidden rounded-md bg-[#f7f7f4] active:cursor-grabbing dark:bg-zinc-800">
                    @if ($first && p.preview && p.preview.url && p.preview.kind !== 'video') {
                      <img [src]="p.preview.url" alt="" class="h-14 w-full object-cover" />
                    }
                    <span class="flex items-center gap-1 px-1 py-1">
                      @for (ch of (p.channels || []).slice(0, 2); track ch.network + ch.handle) {
                        <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="size-3 shrink-0 object-contain" />
                      }
                      <span class="min-w-0 truncate text-[10px] font-medium text-[#121417] dark:text-zinc-100">{{ p.body }}</span>
                    </span>
                  </span>
                }
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="space-y-6">
          @for (group of agenda(); track group.key) {
            <section (dragover)="$event.preventDefault()" (drop)="dropOnKey($event, group.key)">
              <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{{ group.label }}</h2>
              <div class="space-y-2">
                @for (p of group.posts; track p.id) {
                  <article draggable="true" (dragstart)="dragPost($event, p)" class="flex cursor-grab gap-3 rounded-xl border border-[#e8e8e3] bg-white p-3 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900">
                    @if (p.preview && p.preview.url && p.preview.kind !== 'video') {
                      <img [src]="p.preview!.url" alt="" class="size-16 shrink-0 rounded-lg object-cover" />
                    } @else {
                      <span class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#f7f7f4] text-[10px] font-semibold text-[#a1a1aa] dark:bg-zinc-800">{{ p.preview ? 'VID' : 'TXT' }}</span>
                    }
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-3">
                        <p class="line-clamp-2 text-[13px] leading-snug dark:text-zinc-100">{{ p.body }}</p>
                        <span class="shrink-0 rounded-full bg-[#f7f7f4] px-2 py-0.5 font-mono text-[10px] uppercase text-[#63676c] dark:bg-zinc-800 dark:text-zinc-300">{{ p.status }}</span>
                      </div>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        @for (ch of p.channels || []; track ch.network + ch.handle) {
                          <span class="inline-flex items-center gap-1 text-[11px] text-[#63676c] dark:text-zinc-400">
                            <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="size-3 object-contain" />
                            {{ ch.handle }}
                          </span>
                        }
                        <span class="text-[11px] text-[#a1a1aa]">{{ formatTime(p.scheduledAt) }}</span>
                        @if (canQueue(p)) {
                          <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta hover:underline">Send now</button>
                          <button type="button" (click)="edit(p)" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Edit</button>
                        }
                      </div>
                    </div>
                  </article>
                }
              </div>
            </section>
          } @empty {
            <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 class="font-display text-lg font-semibold dark:text-zinc-100">Nothing scheduled</h2>
              <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">Compose a post and it will land on its day with the picture attached.</p>
              <a routerLink="/app/compose" class="mt-4 inline-flex h-9 items-center rounded-full bg-cta px-4 text-xs font-semibold text-white hover:bg-cta-hover">Compose a post</a>
            </div>
          }
        </div>
      }
    </div>

    @if (dayOpen()) {
      <button type="button" class="fixed inset-0 z-30 bg-[#09090b]/20" aria-label="Close day" (click)="dayOpen.set(null)"></button>
      <aside
        class="fixed z-40 flex max-h-[min(32rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[#e8e8e3] bg-white shadow-[0_16px_48px_rgba(15,18,24,0.18)] dark:border-zinc-700 dark:bg-zinc-900"
        [style.left.px]="panelX()"
        [style.top.px]="panelY()"
        role="dialog"
        aria-label="Posts on this day"
      >
        <header class="flex cursor-grab items-center justify-between border-b border-[#e8e8e3] px-3 py-2.5 active:cursor-grabbing dark:border-zinc-800" (pointerdown)="startDrag($event)">
          <p class="font-display text-sm font-bold dark:text-zinc-50">{{ dayOpen()!.label }}</p>
          <button type="button" (click)="dayOpen.set(null)" class="text-[12px] font-semibold text-[#63676c]">Close</button>
        </header>
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          @for (p of dayOpen()!.posts; track p.id) {
            <article draggable="true" (dragstart)="dragPost($event, p)" class="cursor-grab rounded-lg border border-[#e8e8e3] p-2 active:cursor-grabbing dark:border-zinc-800">
              @if (p.preview && p.preview.url && p.preview.kind !== 'video') {
                <img [src]="p.preview!.url" alt="" class="mb-2 h-36 w-full rounded-md object-cover" />
              } @else if (p.preview) {
                <p class="mb-2 rounded-md bg-[#f7f7f4] px-2 py-6 text-center text-[11px] font-semibold text-[#63676c] dark:bg-zinc-800">Video attached</p>
              }
              <p class="text-[13px] leading-snug dark:text-zinc-100">{{ p.body }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="font-mono text-[10px] uppercase text-[#a1a1aa]">{{ p.status }} · {{ formatTime(p.scheduledAt) }}</span>
                @for (ch of p.channels || []; track ch.network + ch.handle) {
                  <img [src]="'/assets/logos/' + ch.network + '.svg'" [alt]="ch.network" width="14" height="14" class="size-3.5 object-contain" />
                }
                @if (canQueue(p)) {
                  <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta">Send now</button>
                  <button type="button" (click)="edit(p)" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Edit</button>
                }
              </div>
              @for (issue of p.issues || []; track issue.network + issue.handle) {
                <p class="mt-1 text-[12px] text-amber-800 dark:text-amber-200">{{ issue.network }}: {{ issue.error || issue.status }}</p>
              }
            </article>
          }
        </div>
      </aside>
    }
  `,
})
export class CalendarPage implements OnInit {
  private readonly router = inject(Router);
  view = signal<"month" | "week" | "agenda">("month");
  tabs = [
    { id: "month" as const, label: "Month" },
    { id: "week" as const, label: "Week" },
    { id: "agenda" as const, label: "Agenda" },
  ];
  filterNetwork = signal("");
  filterStatus = signal("");
  statuses = ["draft", "scheduled", "queued", "published", "failed"];
  private dragId = "";
  posts = signal<Post[]>([]);
  error = signal("");
  loading = signal(true);
  cursor = signal(startOfMonth(new Date()));
  dayOpen = signal<{ label: string; posts: Post[] } | null>(null);
  panelX = signal(24);
  panelY = signal(88);
  dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  skeleton = Array.from({ length: 35 }, (_, i) => i);
  monthCells = signal<Cell[]>([]);
  private workspaceId = "";

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      lsSet("dk-ws", me.workspace.id);
      await this.load(me.workspace.id);
    } catch {
      this.error.set("Sign in to load your calendar.");
      this.loading.set(false);
      this.buildMonth([]);
    }
  }

  monthLabel() {
    if (this.view() !== "week") return this.cursor().toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const start = startOfWeek(this.cursor());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  shiftMonth(delta: number) {
    const c = this.cursor();
    this.cursor.set(this.view() === "week" ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + delta * 7) : new Date(c.getFullYear(), c.getMonth() + delta, 1));
    this.rebuild();
    this.dayOpen.set(null);
  }

  setView(next: "month" | "week" | "agenda") {
    this.view.set(next);
    if (next === "week") this.cursor.set(startOfWeek(new Date()));
    if (next === "month") this.cursor.set(startOfMonth(new Date()));
    this.rebuild();
  }

  networks() {
    return [...new Set(this.posts().flatMap((p) => (p.channels || []).map((c) => c.network)))];
  }

  shown() {
    return this.posts().filter((post) => {
      if (this.filterStatus() && post.status !== this.filterStatus()) return false;
      if (this.filterNetwork() && !(post.channels || []).some((c) => c.network === this.filterNetwork())) return false;
      return true;
    });
  }

  rebuild() {
    this.buildMonth(this.shown());
  }

  edit(post: Post) {
    void this.router.navigate(["/app/compose"], { queryParams: { post: post.id } });
  }

  dragPost(event: DragEvent, post: Post) {
    if (!this.canQueue(post)) {
      event.preventDefault();
      return;
    }
    this.dragId = post.id;
    event.dataTransfer?.setData("text/plain", post.id);
  }

  dropOnKey(event: DragEvent, key: string) {
    if (key === "unscheduled") return;
    void this.dropOn(event, { key, day: 0, inMonth: true, today: false, posts: [] });
  }

  async dropOn(event: DragEvent, cell: Cell) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer?.getData("text/plain") || this.dragId;
    const post = this.posts().find((p) => p.id === id);
    if (!post || !this.canQueue(post)) return;
    const when = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const day = new Date(cell.key);
    day.setHours(when.getHours(), when.getMinutes(), 0, 0);
    await api(`/v1/posts/${post.id}`, { method: "PATCH", json: { scheduledAt: day.getTime(), status: "scheduled" } });
    if (this.workspaceId) await this.load(this.workspaceId);
  }

  goToday() {
    this.cursor.set(startOfMonth(new Date()));
    this.buildMonth(this.posts());
  }

  openDay(cell: Cell) {
    if (!cell.posts.length) return;
    const label = new Date(cell.key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    this.dayOpen.set({ label, posts: cell.posts });
    if (typeof window !== "undefined") {
      this.panelX.set(Math.max(16, window.innerWidth - 420));
      this.panelY.set(96);
    }
  }

  startDrag(event: PointerEvent) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const originX = event.clientX;
    const originY = event.clientY;
    const left = this.panelX();
    const top = this.panelY();
    const move = (ev: PointerEvent) => {
      this.panelX.set(Math.max(8, left + ev.clientX - originX));
      this.panelY.set(Math.max(8, top + ev.clientY - originY));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  agenda() {
    const cursor = this.cursor();
    const groups = new Map<string, { key: string; label: string; posts: Post[] }>();
    for (const post of this.shown()) {
      const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
      if (when && (when.getFullYear() !== cursor.getFullYear() || when.getMonth() !== cursor.getMonth())) continue;
      const key = when ? new Date(when.getFullYear(), when.getMonth(), when.getDate()).toISOString() : "unscheduled";
      const label = when
        ? when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : "Unscheduled";
      const group = groups.get(key) ?? { key, label, posts: [] };
      group.posts.push(post);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  canQueue(post: Post) {
    return post.status === "draft" || post.status === "scheduled";
  }

  async load(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.loading.set(true);
    this.error.set("");
    try {
      const data = await api<{ posts: Post[] }>(`/v1/posts?workspaceId=${workspaceId}`);
      this.posts.set(data.posts || []);
      this.rebuild();
    } catch (err) {
      const status = (err as { status?: number }).status;
      this.error.set(status === 401 ? "Sign in to load your calendar." : "Could not load posts. Is the API running?");
      this.buildMonth([]);
    } finally {
      this.loading.set(false);
    }
  }

  buildMonth(list: Post[]) {
    if (this.view() === "week") {
      const start = startOfWeek(this.cursor());
      const today = new Date().toDateString();
      const cells: Cell[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({ key: d.toISOString(), day: d.getDate(), inMonth: true, today: d.toDateString() === today, posts: postsOn(list, d) });
      }
      this.monthCells.set(cells);
      return;
    }
    const cursor = this.cursor();
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const today = new Date().toDateString();
    const cells: Cell[] = [];
    const pad = start.getDay();
    for (let i = 0; i < pad; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (pad - i));
      cells.push({ key: d.toISOString(), day: d.getDate(), inMonth: false, today: d.toDateString() === today, posts: postsOn(list, d) });
    }
    for (let day = 1; day <= end.getDate(); day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      cells.push({ key: d.toISOString(), day, inMonth: true, today: d.toDateString() === today, posts: postsOn(list, d) });
    }
    while (cells.length % 7) {
      const last = new Date(cells[cells.length - 1].key);
      last.setDate(last.getDate() + 1);
      cells.push({ key: last.toISOString(), day: last.getDate(), inMonth: false, today: false, posts: postsOn(list, last) });
    }
    this.monthCells.set(cells);
  }

  formatTime(v: string | Date | null) {
    if (!v) return "No time";
    return new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  async queueNow(id: string) {
    await api(`/v1/posts/${id}/queue-now`, { method: "POST" });
    if (this.workspaceId) await this.load(this.workspaceId);
    this.dayOpen.set(null);
  }
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function postsOn(list: Post[], day: Date) {
  const key = day.toDateString();
  return list.filter((post) => post.scheduledAt && new Date(post.scheduledAt).toDateString() === key);
}
