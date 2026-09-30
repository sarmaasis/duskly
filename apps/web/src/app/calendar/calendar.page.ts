import { Component, effect, inject, signal, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { api } from "../lib/api";
import { ScrollMore } from "../ui/scroll-more";
import { CompanyDesk } from "../lib/company-desk";
import { lsSet } from "../lib/browser";
import { labelNetwork, labelStatus } from "../lib/labels";
import { PostsWelcome } from "./posts-welcome";
import { Notices } from "../lib/notices";

type Channel = { accountId?: string; network: string; handle: string; status: string; avatarUrl?: string | null };
type Preview = { url: string; kind: string };
type Post = {
  id: string;
  body: string;
  status: string;
  scheduledAt: string | Date | null;
  extrasJson?: string | null;
  repeatRule?: string | null;
  parentPostId?: string | null;
  preview?: Preview | null;
  channels?: Channel[];
  issues?: { network: string; handle: string; status: string; error: string | null }[];
};

type Cell = { key: string; day: number; inMonth: boolean; today: boolean; posts: Post[] };

@Component({
  standalone: true,
  imports: [PostsWelcome, ScrollMore],
  template: `
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Publishing</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Posts</h1>
        <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">Your drafts, your schedule, and everything you’ve shared.</p>
      </header>
      @if (error()) {
        <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="alert">
          <p>{{ error() }}</p><button type="button" (click)="ngOnInit()" class="mt-2 min-h-10 font-semibold underline">Try again</button>
        </div>
      } @else if (!loading() && !posts().length && accountCount() !== null) {
        <dk-posts-welcome [connected]="accountCount()! > 0" />
      }
      @if (posts().length && !error()) {
        <div class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3 dark:border-zinc-800">
          <div class="hidden flex-wrap gap-1 sm:flex" role="group" aria-label="Post status">
            @for (tab of statusTabs; track tab.id) {
              <button type="button" (click)="filterStatus.set(tab.id); rebuild()" [attr.aria-pressed]="filterStatus()===tab.id" class="min-h-10 rounded-lg px-3 text-[13px] font-medium" [class.bg-cta]="filterStatus()===tab.id" [class.text-white]="filterStatus()===tab.id" [class.text-muted]="filterStatus()!==tab.id" [class.dark:text-zinc-400]="filterStatus()!==tab.id">{{ tab.label }}</button>
            }
          </div>
          <label class="sm:hidden"><span class="sr-only">Post status</span><select class="min-h-11 rounded-lg border border-line bg-transparent px-2 text-xs dark:border-zinc-700" [value]="filterStatus()" (change)="filterStatus.set($any($event.target).value); rebuild()">@for (tab of statusTabs; track tab.id) { <option [value]="tab.id">{{ tab.label }}</option> }</select></label>
          <div class="flex items-center gap-3">
            <label class="sm:hidden"><span class="sr-only">Post view</span><select class="min-h-11 rounded-lg border border-line bg-transparent px-2 text-xs dark:border-zinc-700" [value]="view()" (change)="setView($any($event.target).value)">@for (tab of tabs; track tab.id) { <option [value]="tab.id">{{ tab.label }}</option> }</select></label>
            <div class="hidden sm:inline-flex rounded-lg border border-line p-1 dark:border-zinc-700" role="group" aria-label="Post view">
              @for (tab of tabs; track tab.id) {
                <button type="button" (click)="setView(tab.id)" [attr.aria-pressed]="view()===tab.id" class="min-h-9 rounded-md px-3 text-xs font-semibold" [class.bg-white]="view()===tab.id" [class.shadow-sm]="view()===tab.id" [class.dark:bg-zinc-800]="view()===tab.id">{{ tab.label }}</button>
              }
            </div>
            <button type="button" (click)="filtersOpen.update(toggle)" [attr.aria-expanded]="filtersOpen()" class="min-h-11 text-xs font-medium underline underline-offset-4">Filters{{ hasFilters() ? ' · active' : '' }}</button>
          </div>
        </div>
        @if (filtersOpen()) {
          <div class="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <label class="text-xs text-muted dark:text-zinc-400">Network<select aria-label="Filter by network" class="mt-2 block min-h-10 rounded-lg border border-line bg-transparent px-3 text-sm dark:border-zinc-700" [value]="filterNetwork()" (change)="filterNetwork.set($any($event.target).value); rebuild()"><option value="">All networks</option>@for (n of networks(); track n) { <option [value]="n">{{ labelNetwork(n) }}</option> }</select></label>
            <label class="text-xs text-muted dark:text-zinc-400">Status<select aria-label="Filter by status" class="mt-2 block min-h-10 rounded-lg border border-line bg-transparent px-3 text-sm dark:border-zinc-700" [value]="filterStatus()" (change)="filterStatus.set($any($event.target).value); rebuild()"><option value="">All statuses</option>@for (status of statuses; track status) { <option [value]="status">{{ labelStatus(status) }}</option> }</select></label>
            <label class="text-xs text-muted dark:text-zinc-400">Account<select aria-label="Filter by account" class="mt-2 block min-h-10 rounded-lg border border-line bg-transparent px-3 text-sm dark:border-zinc-700" [value]="filterAccount()" (change)="filterAccount.set($any($event.target).value); rebuild()"><option value="">All accounts</option>@for (account of accountFilters(); track account) { <option [value]="account">{{ account }}</option> }</select></label>
            <label class="text-xs text-muted dark:text-zinc-400">Tag<input aria-label="Filter by tag" class="mt-2 block min-h-10 rounded-lg border border-line bg-transparent px-3 text-sm dark:border-zinc-700" placeholder="e.g. launch" [value]="filterTag()" (input)="filterTag.set($any($event.target).value); rebuild()" /></label>
            <button type="button" (click)="clearFilters()" class="min-h-10 px-2 text-xs font-semibold underline">Clear filters</button>
          </div>
        }
        @if (view() !== 'agenda') {
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <button type="button" (click)="shiftMonth(-1)" class="size-10 rounded-lg border border-line dark:border-zinc-700" [attr.aria-label]="view()==='week' ? 'Previous week' : 'Previous month'">‹</button>
              <h2 class="font-display text-lg font-semibold">{{ monthLabel() }}</h2>
              <button type="button" (click)="shiftMonth(1)" class="size-10 rounded-lg border border-line dark:border-zinc-700" [attr.aria-label]="view()==='week' ? 'Next week' : 'Next month'">›</button>
              <button type="button" (click)="goToday()" class="min-h-10 px-2 text-xs font-medium">Today</button>
            </div>
            <p class="text-xs text-muted dark:text-zinc-400">Open a post to edit its time, or drag it to another day.</p>
          </div>
        }
      }

      @if (view() !== 'agenda' && unscheduled().length && !error()) {
        <div class="mb-4 rounded-xl border border-dashed border-[#e8e8e3] bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <p class="mb-2 text-[12px] font-semibold text-[#52525b] dark:text-zinc-400">Drafts without a date. Open one to schedule it, or drag it onto a day.</p>
          <div class="flex flex-wrap gap-2">
            @for (p of unscheduled(); track p.id) {
              <span class="inline-flex max-w-xs items-center gap-1.5 rounded-lg bg-[#f6f6f3] py-1 pl-1 pr-2 dark:bg-zinc-800">
                @for (ch of (p.channels || []).slice(0, 2); track ch.network + ch.handle) {
                  <span class="inline-flex min-w-0 items-center gap-1 rounded-full bg-white py-0.5 pl-0.5 pr-1.5 dark:bg-zinc-950">
                    <span class="relative size-4 shrink-0">
                      <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
                        @if (ch.avatarUrl) { <img [src]="ch.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="dk-net-badge size-3 object-contain" /> }
                      </span>
                      @if (ch.avatarUrl) {
                        <span class="absolute -right-1 -top-1 flex size-2.5 items-center justify-center rounded-full bg-white ring-1 ring-white dark:ring-zinc-950">
                          <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="8" height="8" class="dk-net-badge size-2 object-contain" />
                        </span>
                      }
                    </span>
                    <span class="max-w-16 truncate text-[10px] font-semibold text-[#121417] dark:text-zinc-100">{{ ch.handle }}</span>
                  </span>
                }
                <button type="button" [attr.draggable]="canQueue(p)" (dragstart)="dragPost($event, p)" (dragend)="endDrag()" (click)="edit(p)" class="min-w-0 cursor-grab truncate text-left text-[12px] font-semibold active:cursor-grabbing">{{ p.body || 'Untitled' }}</button>
              </span>
            }
          </div>
        </div>
      }

      @if (loading()) {
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#e8e8e3] bg-[#e8e8e3] dark:border-zinc-700 dark:bg-zinc-800">
          @for (n of skeleton; track n) {
            <div class="h-28 animate-pulse bg-[#f7f7f4] dark:bg-zinc-900"></div>
          }
        </div>
      } @else if (posts().length && !error() && (view() === 'month' || view() === 'week')) {
        <div class="overflow-hidden rounded-xl border border-[#e8e8e3] bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div class="grid grid-cols-7 border-b border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800">
            @for (d of dow; track d) {
              <div class="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (cell of monthCells(); track cell.key) {
              <div (click)="openDay(cell)" (dragover)="allowDrop($event, cell)" (dragleave)="leaveDrop($event, cell)" (drop)="dropOn($event, cell)" class="flex flex-col overflow-hidden border-b border-r border-[#e8e8e3] p-1.5 text-left dark:border-zinc-800" [class.h-36]="view()!=='week'" [class.min-h-52]="view()==='week'" [class.bg-[#f7f7f4]/70]="!cell.inMonth && dropKey()!==cell.key" [class.dark:bg-zinc-950]="!cell.inMonth && dropKey()!==cell.key" [class.bg-cta-soft]="dropKey()===cell.key" [class.cursor-pointer]="cell.posts.length">
                <button type="button" (click)="$event.stopPropagation(); openDay(cell)" class="mb-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" [class.bg-cta]="cell.today" [class.text-white]="cell.today" [class.text-[#a1a1aa]]="!cell.inMonth && !cell.today" [class.dark:text-zinc-200]="cell.inMonth && !cell.today">{{ cell.day }}</button>
                <span class="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                  @for (p of cell.posts.slice(0, view() === 'week' ? 4 : 2); track p.id) {
                    <span [attr.draggable]="canQueue(p)" (dragstart)="dragPost($event, p)" (dragend)="endDrag()" (click)="$event.stopPropagation(); edit(p)" class="flex min-h-0 items-center gap-1 overflow-hidden rounded-md px-0.5 active:cursor-grabbing" [class.cursor-grab]="canQueue(p)" [class.bg-amber-50]="p.status==='failed'" [class.dark:bg-amber-950]="p.status==='failed'" [class.bg-[#f7f7f4]]="p.status!=='failed'" [class.dark:bg-zinc-800]="p.status!=='failed'">
                      <span class="w-0.5 self-stretch rounded-full" [class.bg-cta]="p.status==='scheduled'" [class.bg-amber-500]="p.status==='failed'" [class.bg-emerald-500]="p.status==='published'" [class.bg-zinc-300]="p.status!=='scheduled' && p.status!=='failed' && p.status!=='published'"></span>
                      @if (p.preview && p.preview.url && p.preview.kind !== 'video') {
                        <img [src]="p.preview.url" alt="" class="size-8 shrink-0 object-cover" />
                      }
                      <span class="flex min-w-0 flex-1 flex-col py-0.5 pr-1">
                        <span class="truncate text-[10px] font-semibold text-[#121417] dark:text-zinc-100">{{ formatTime(p.scheduledAt) }}</span>
                        <span class="truncate text-[10px] text-[#52525b] dark:text-zinc-400">{{ p.body }}</span>
                        <span class="flex min-w-0 flex-wrap gap-1">
                          @for (ch of (p.channels || []).slice(0, view() === 'week' ? 3 : 1); track ch.network + ch.handle) {
                            <span class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-white py-0.5 pl-0.5 pr-1.5 dark:bg-zinc-950" [title]="labelNetwork(ch.network) + ' · ' + ch.handle">
                              <span class="relative size-4 shrink-0">
                                <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
                                  @if (ch.avatarUrl) { <img [src]="ch.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="dk-net-badge size-3 object-contain" /> }
                                </span>
                                @if (ch.avatarUrl) {
                                  <span class="absolute -right-1 -top-1 flex size-2.5 items-center justify-center rounded-full bg-white ring-1 ring-white dark:ring-zinc-950">
                                    <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="8" height="8" class="dk-net-badge size-2 object-contain" />
                                  </span>
                                }
                              </span>
                              <span class="truncate text-[10px] font-semibold text-[#121417] dark:text-zinc-100">{{ ch.handle }}</span>
                            </span>
                          }
                        </span>
                      </span>
                    </span>
                  }
                  @if (cell.posts.length > (view() === 'week' ? 4 : 2)) {
                    <span class="px-1 text-[10px] font-semibold text-cta">+{{ cell.posts.length - (view() === 'week' ? 4 : 2) }} more</span>
                  }
                  @if (dropKey() === cell.key && !cell.posts.length) {
                    <span class="px-1 text-[10px] font-semibold text-cta">Drop to schedule</span>
                  }
                </span>
              </div>
            }
          </div>
        </div>
      } @else if (posts().length && !error()) {
        <div class="space-y-6">
          @for (group of agenda(); track group.key) {
            <section (dragover)="allowDropKey($event, group.key)" (dragleave)="leaveDropKey($event, group.key)" (drop)="dropOnKey($event, group.key)" [class.rounded-xl]="dropKey()===group.key" [class.bg-cta-soft]="dropKey()===group.key">
              <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{{ group.label }}</h2>
              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                @for (p of group.posts; track p.id) {
                  <article [attr.draggable]="canQueue(p)" (dragstart)="dragPost($event, p)" (dragend)="endDrag()" class="flex flex-col gap-3 rounded-xl border border-[#e8e8e3] bg-white p-3 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900" [class.cursor-grab]="canQueue(p)">
                    <div class="flex items-center justify-between gap-2 text-[11px] text-[#a1a1aa]">
                      <span>{{ formatTime(p.scheduledAt) }}</span>
                      <span class="rounded-full bg-[#f7f7f4] px-2 py-0.5 text-[10px] font-semibold text-[#63676c] dark:bg-zinc-800 dark:text-zinc-300">{{ labelStatus(p.status) }}</span>
                    </div>
                    @if (p.preview && p.preview.url && p.preview.kind !== 'video') {
                      <img [src]="p.preview!.url" alt="" class="h-28 w-full rounded-lg object-cover" />
                    } @else if (p.preview) {
                      <span class="flex h-28 items-center justify-center rounded-lg bg-[#f7f7f4] text-[10px] font-semibold text-[#a1a1aa] dark:bg-zinc-800">Video</span>
                    }
                    <button type="button" (click)="edit(p)" class="line-clamp-3 text-left text-sm font-semibold leading-relaxed hover:underline dark:text-zinc-100">{{ p.body || 'Untitled post' }}</button>
                    <div class="flex flex-wrap items-center gap-1.5">
                      @for (ch of p.channels || []; track ch.network + ch.handle) {
                        <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#e8e8e3] bg-[#fcfcf9] py-0.5 pl-0.5 pr-2 dark:border-zinc-700 dark:bg-zinc-950" [title]="labelNetwork(ch.network) + ' · ' + ch.handle">
                          <span class="relative size-6 shrink-0">
                            <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
                              @if (ch.avatarUrl) { <img [src]="ch.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="16" height="16" class="dk-net-badge size-4 object-contain" /> }
                            </span>
                            @if (ch.avatarUrl) {
                              <span class="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white dark:ring-zinc-950">
                                <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="10" height="10" class="dk-net-badge size-2.5 object-contain" />
                              </span>
                            }
                          </span>
                          <span class="truncate text-[11px] font-semibold text-[#121417] dark:text-zinc-100">{{ ch.handle }}</span>
                        </span>
                      }
                    </div>
                      <details class="mt-2 text-xs">
                        <summary class="inline-flex min-h-9 cursor-pointer items-center font-medium text-muted dark:text-zinc-400">Post actions</summary>
                        <div class="flex flex-wrap items-center gap-4 py-2">
                        @if (inSeries(p)) {
                          <span class="text-[10px] font-semibold text-[#a1a1aa]">Series</span>
                        }
                        @if (canPause(p)) {
                          <button type="button" (click)="pauseSeries(p.id)" class="text-[11px] font-semibold text-cta">Pause series</button>
                        }
                        @if (canQueue(p)) {
                          <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta hover:underline">Send now</button>
                        }
                        @if (p.status === 'failed') {
                          <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta">Retry</button>
                        }
                        <button type="button" (click)="edit(p)" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Edit</button>
                        </div>
                      </details>
                  </article>
                }
              </div>
            </section>
          } @empty {
            <div class="rounded-xl border border-[#e8e8e3] bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 class="font-display text-lg font-semibold dark:text-zinc-100">No posts match this view</h2>
              <p class="mt-2 text-sm text-[#63676c] dark:text-zinc-400">Try another status or clear your filters to see your posts.</p>
              <button type="button" (click)="clearFilters(); clearCompany()" class="mt-4 min-h-11 text-sm font-semibold underline">Show all posts</button>
            </div>
          }
        </div>
        <div class="h-8" dkScrollMore [dkScrollEnabled]="postsNext() != null" [dkScrollBusy]="paging()" (dkScrollMoreFire)="morePosts()"></div>
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
            <article [attr.draggable]="canQueue(p)" (dragstart)="dragPost($event, p)" (dragend)="endDrag()" class="rounded-lg border border-[#e8e8e3] p-2 active:cursor-grabbing dark:border-zinc-800" [class.cursor-grab]="canQueue(p)">
              @if (p.preview && p.preview.url && p.preview.kind !== 'video') {
                <img [src]="p.preview!.url" alt="" class="mb-2 h-36 w-full rounded-md object-cover" />
              } @else if (p.preview) {
                <p class="mb-2 rounded-md bg-[#f7f7f4] px-2 py-6 text-center text-[11px] font-semibold text-[#63676c] dark:bg-zinc-800">Video attached</p>
              }
              <p class="text-[13px] leading-snug dark:text-zinc-100">{{ p.body }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="text-[10px] font-semibold text-[#a1a1aa]">{{ labelStatus(p.status) }} · {{ formatTime(p.scheduledAt) }}</span>
                @if (inSeries(p)) {
                  <span class="text-[10px] font-semibold text-[#a1a1aa]">Series</span>
                }
                @if (canPause(p)) {
                  <button type="button" (click)="pauseSeries(p.id)" class="text-[11px] font-semibold text-cta">Pause series</button>
                }
                @for (ch of p.channels || []; track ch.network + ch.handle) {
                  <span class="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e8e8e3] bg-white py-0.5 pl-0.5 pr-1.5 dark:border-zinc-700 dark:bg-zinc-950">
                    <span class="relative size-4 shrink-0">
                      <span class="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
                        @if (ch.avatarUrl) { <img [src]="ch.avatarUrl" alt="" class="size-full object-cover" /> } @else { <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="12" height="12" class="dk-net-badge size-3 object-contain" /> }
                      </span>
                      @if (ch.avatarUrl) {
                        <span class="absolute -right-1 -top-1 flex size-2.5 items-center justify-center rounded-full bg-white ring-1 ring-white dark:ring-zinc-950">
                          <img [src]="'/assets/logos/' + ch.network + '.svg'" alt="" width="8" height="8" class="dk-net-badge size-2 object-contain" />
                        </span>
                      }
                    </span>
                    <span class="max-w-28 truncate text-[10px] font-semibold text-[#121417] dark:text-zinc-100">{{ ch.handle }}</span>
                  </span>
                }
                @if (canQueue(p)) {
                  <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta">Send now</button>
                }
                @if (p.status === 'failed') {
                  <button type="button" (click)="queueNow(p.id)" class="text-[11px] font-semibold text-cta">Retry</button>
                }
                @if (canReview() && p.status === 'pending_approval') {
                  <button type="button" (click)="decide(p.id, 'approve')" class="text-[11px] font-semibold text-cta">Approve</button>
                  <button type="button" (click)="decide(p.id, 'return')" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Send back</button>
                }
                <button type="button" (click)="edit(p)" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Edit</button>
                @if (previewHref(p); as href) {
                  <a [href]="href" target="_blank" class="text-[11px] font-semibold text-[#121417] dark:text-zinc-100">Preview</a>
                }
                <input type="date" class="h-7 rounded-md border border-[#e8e8e3] bg-white px-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900" (click)="$event.stopPropagation()" (change)="dupOn(p, $any($event.target).value)" />
              </div>
              @for (issue of p.issues || []; track issue.network + issue.handle) {
                <p class="mt-1 text-[12px] text-amber-800 dark:text-amber-200">{{ labelNetwork(issue.network) }}: {{ issue.error || labelStatus(issue.status) }}</p>
              }
            </article>
          }
        </div>
      </aside>
    }
  `,
})
export class CalendarPage implements OnInit {
  readonly labelStatus = labelStatus;
  readonly labelNetwork = labelNetwork;
  private readonly router = inject(Router);
  private readonly notices = inject(Notices);
  private readonly desk = inject(CompanyDesk);
  view = signal<"month" | "week" | "agenda">("agenda");
  postsNext = signal<number | null>(null);
  paging = signal(false);
  accountCount = signal<number | null>(null);
  filtersOpen = signal(false);
  readonly toggle = (value: boolean) => !value;
  readonly statusTabs = [{ id: "", label: "All posts" }, { id: "draft", label: "Drafts" }, { id: "scheduled", label: "Scheduled" }, { id: "published", label: "Published" }, { id: "failed", label: "Needs attention" }];
  tabs = [
    { id: "agenda" as const, label: "List" },
    { id: "month" as const, label: "Calendar" },
    { id: "week" as const, label: "Week" },
  ];
  hasFilters() { return !!(this.filterNetwork() || this.filterStatus() || this.filterTag() || this.filterAccount()); }
  clearCompany() { this.desk.select(''); }
  clearFilters() { this.filterNetwork.set(''); this.filterStatus.set(''); this.filterTag.set(''); this.filterAccount.set(''); this.rebuild(); }
  filterNetwork = signal("");
  filterAccount = signal("");
  filterStatus = signal("");
  statuses = ["draft", "pending_approval", "scheduled", "queued", "published", "failed"];
  role = signal("");
  filterTag = signal("");
  private dragId = "";
  dropKey = signal("");
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
  private loadedCompany: string | null = null;

  constructor() {
    effect(() => {
      const company = this.desk.selectedId();
      this.desk.companies();
      if (!this.workspaceId || this.loadedCompany === company) {
        this.rebuild();
        return;
      }
      this.loadedCompany = company;
      void this.load(this.workspaceId);
    });
  }

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string; role?: string } }>("/v1/workspaces/me");
      this.role.set(me.workspace.role || "");
      lsSet("dk-ws", me.workspace.id);
      await Promise.all([
        this.load(me.workspace.id),
        api<{ accounts: unknown[] }>(`/v1/accounts?workspaceId=${me.workspace.id}`).then((data) => this.accountCount.set(data.accounts.length)).catch(() => {
          if (!this.posts().length) this.error.set("Could not check your connected accounts. Please try again.");
        }),
      ]);
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
    void this.fillVisibleRange();
    this.rebuild();
    this.dayOpen.set(null);
  }

  setView(next: "month" | "week" | "agenda") {
    this.view.set(next);
    if (next === "week") this.cursor.set(startOfWeek(new Date()));
    if (next === "month") this.cursor.set(startOfMonth(new Date()));
    void this.fillVisibleRange();
    this.rebuild();
  }

  networks() {
    return [...new Set(this.posts().flatMap((p) => (p.channels || []).map((c) => c.network)))];
  }

  accountFilters() {
    return [...new Set(this.posts().flatMap((p) => (p.channels || []).map((c) => c.handle)))];
  }

  shown() {
    return this.posts().filter((post) => {
      if (!this.desk.allowsPost((post.channels || []).map((channel) => channel.accountId))) return false;
      if (this.filterStatus() && post.status !== this.filterStatus()) return false;
      if (this.filterNetwork() && !(post.channels || []).some((c) => c.network === this.filterNetwork())) return false;
      if (this.filterAccount() && !(post.channels || []).some((c) => c.handle === this.filterAccount())) return false;
      const tag = this.filterTag().trim().toLowerCase();
      if (tag) {
        try {
          const tags = (JSON.parse(post.extrasJson || "{}").tags || []) as string[];
          if (!tags.some((item) => item.toLowerCase().includes(tag))) return false;
        } catch {
          return false;
        }
      }
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
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", post.id);
    }
  }

  endDrag() {
    this.dropKey.set("");
    this.dragId = "";
  }

  allowDrop(event: DragEvent, cell: Cell) {
    if (!this.dragId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    this.dropKey.set(cell.key);
  }

  leaveDrop(event: DragEvent, cell: Cell) {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as Node).contains(next)) return;
    if (this.dropKey() === cell.key) this.dropKey.set("");
  }

  allowDropKey(event: DragEvent, key: string) {
    if (!this.dragId || key === "unscheduled") return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    this.dropKey.set(key);
  }

  leaveDropKey(event: DragEvent, key: string) {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as Node).contains(next)) return;
    if (this.dropKey() === key) this.dropKey.set("");
  }

  dropOnKey(event: DragEvent, key: string) {
    if (key === "unscheduled") return;
    void this.dropOn(event, { key, day: 0, inMonth: true, today: false, posts: [] });
  }

  async dropOn(event: DragEvent, cell: Cell) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer?.getData("text/plain") || this.dragId;
    this.dropKey.set("");
    this.dragId = "";
    const post = this.posts().find((p) => p.id === id);
    if (!post || !this.canQueue(post)) return;
    const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const day = new Date(cell.key);
    if (Number.isNaN(day.getTime())) return;
    day.setHours(when ? when.getHours() : 9, when ? when.getMinutes() : 0, 0, 0);
    if (when && when.toDateString() === day.toDateString()) return;
    try {
      await api(`/v1/posts/${post.id}`, { method: "PATCH", json: { scheduledAt: day.getTime(), status: "scheduled" } });
      this.notices.push("ok", `Moved to ${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${this.formatTime(day)}.`);
      if (this.workspaceId) await this.load(this.workspaceId);
    } catch {
      this.notices.push("error", "Could not move that post.");
    }
  }

  unscheduled() {
    return this.shown().filter((post) => !post.scheduledAt && this.canQueue(post));
  }

  goToday() {
    const now = new Date();
    this.cursor.set(this.view() === "week" ? startOfWeek(now) : startOfMonth(now));
    this.rebuild();
    this.dayOpen.set(null);
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
    const groups = new Map<string, { key: string; label: string; posts: Post[] }>();
    for (const post of [...this.shown()].sort((a, b) => new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime())) {
      const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
      const key = when ? new Date(when.getFullYear(), when.getMonth(), when.getDate()).toISOString() : "unscheduled";
      const label = when
        ? when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : "Drafts without a date";
      const group = groups.get(key) ?? { key, label, posts: [] };
      group.posts.push(post);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  canQueue(post: Post) {
    return post.status === "draft" || post.status === "scheduled";
  }

  canReview() {
    return this.role() === "owner" || this.role() === "admin";
  }

  previewHref(post: Post) {
    try {
      const token = (JSON.parse(post.extrasJson || "{}") as { previewToken?: string }).previewToken;
      return token ? `/p/${token}` : "";
    } catch {
      return "";
    }
  }

  async decide(id: string, action: "approve" | "return") {
    await api(`/v1/posts/${id}/decide`, { method: "POST", json: { action } });
    if (this.workspaceId) await this.load(this.workspaceId);
    this.dayOpen.set(null);
  }

  async dupOn(post: Post, day: string) {
    if (!day) return;
    const when = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const next = new Date(`${day}T00:00:00`);
    next.setHours(when.getHours(), when.getMinutes(), 0, 0);
    await api(`/v1/posts/${post.id}/duplicate`, { method: "POST", json: { scheduledAt: next.getTime() } });
    if (this.workspaceId) await this.load(this.workspaceId);
  }

  async load(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.loading.set(true);
    this.error.set("");
    this.posts.set([]);
    this.postsNext.set(null);
    try {
      await this.morePosts(true);
      await this.fillVisibleRange();
    } catch (err) {
      const status = (err as { status?: number }).status;
      this.error.set(status === 401 ? "Sign in to load your calendar." : "Could not load posts. Is the API running?");
      this.buildMonth([]);
    } finally {
      this.loading.set(false);
    }
  }

  async morePosts(reset = false) {
    if (!this.workspaceId || this.paging()) return;
    const offset = reset ? 0 : this.postsNext();
    if (!reset && offset == null) return;
    this.paging.set(true);
    try {
      const data = await api<{ posts: Post[]; next: number | null }>(
        `/v1/posts?${this.desk.scopeQuery(this.workspaceId)}&limit=30&offset=${offset ?? 0}`,
      );
      const page = data.posts || [];
      this.posts.update((rows) => (reset ? page : rows.concat(page)));
      this.postsNext.set(typeof data.next === "number" ? data.next : null);
      this.rebuild();
    } finally {
      this.paging.set(false);
    }
  }

  private oldestScheduled() {
    let oldest = Infinity;
    for (const post of this.posts()) {
      if (!post.scheduledAt) continue;
      oldest = Math.min(oldest, new Date(post.scheduledAt).getTime());
    }
    return oldest === Infinity ? null : oldest;
  }

  private async fillVisibleRange() {
    if (this.view() === "agenda") return;
    const start = (this.view() === "week" ? startOfWeek(this.cursor()) : startOfMonth(this.cursor())).getTime();
    for (let i = 0; i < 20 && this.postsNext() != null; i++) {
      const oldest = this.oldestScheduled();
      if (oldest != null && oldest <= start) return;
      await this.morePosts();
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

  inSeries(post: Post) {
    return (!!post.repeatRule && post.repeatRule !== "none") || !!post.parentPostId;
  }

  canPause(post: Post) {
    return this.inSeries(post) && (post.status === "scheduled" || post.status === "pending_approval");
  }

  async pauseSeries(id: string) {
    await api(`/v1/posts/${id}/pause`, { method: "POST" });
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
