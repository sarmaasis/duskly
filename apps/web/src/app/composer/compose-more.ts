import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DkSelect } from "../ui/forms";
import { COMPOSE } from "./compose-context";

@Component({
  selector: "dk-compose-more",
  standalone: true,
  imports: [FormsModule, DkSelect],
  template: `
    <div class="space-y-4">
      <section class="space-y-3 rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Signature and sets</h2>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Signature
          <div class="mt-1.5">
            <dk-select [(ngModel)]="c.signatureId">
              <option value="">Account default</option>
              @for (s of c.signatures(); track s.id) {
                <option [value]="s.id">{{ s.name }}{{ s.isDefault ? ' (default)' : '' }}</option>
              }
            </dk-select>
          </div>
        </label>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Posting set
          <div class="mt-1.5">
            <dk-select [(ngModel)]="c.postingSetId" (ngModelChange)="c.applySet($event)">
              <option value="">Manual channels</option>
              @for (s of c.sets(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </dk-select>
          </div>
        </label>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Target group
          <div class="mt-1.5">
            <dk-select [(ngModel)]="c.groupId" (ngModelChange)="c.applyGroup($event)">
              <option value="">Manual channels</option>
              @for (g of c.groups(); track g.id) {
                <option [value]="g.id">{{ g.name }} ({{ g.accountIds.length }})</option>
              }
            </dk-select>
          </div>
        </label>
      </section>

      <section class="space-y-3 rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Feeds and plugs</h2>
        <form class="flex gap-2" (ngSubmit)="c.addFeed()">
          <input [(ngModel)]="c.feedUrl" name="feedUrl" placeholder="RSS feed URL" class="h-9 min-w-0 flex-1 rounded-lg border border-[#e8e8e3] bg-[#fcfcf9] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
          <button type="submit" class="h-9 shrink-0 rounded-full border border-[#e8e8e3] px-3 text-[11px] font-semibold dark:border-zinc-600">Add feed</button>
        </form>
        @for (feed of c.feeds(); track feed.id) {
          <p class="truncate text-[11px] text-[#63676c] dark:text-zinc-400">{{ feed.url }}</p>
        }
        @for (plug of c.plugs(); track plug.id) {
          <div class="flex items-center justify-between gap-2 text-[12px]">
            <span class="truncate dark:text-zinc-100">{{ plug.name }}</span>
            <button type="button" (click)="c.runPlug(plug.id)" class="shrink-0 font-semibold text-cta">Run</button>
          </div>
        }
      </section>

      <section class="space-y-3 rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Channel options</h2>
        @if (c.needsPoll()) {
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Poll question
            <input [(ngModel)]="c.pollQuestion" name="pollQuestion" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
          </label>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Options, one per line
            <textarea [(ngModel)]="c.pollOptionsText" name="pollOptions" rows="3" class="mt-1 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800"></textarea>
          </label>
        }
        @if (c.needsThread()) {
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Thread, one post per line
            <textarea [(ngModel)]="c.threadText" name="threadText" rows="3" class="mt-1 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800"></textarea>
          </label>
        }
        @if (c.needsType()) {
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Post type
            <select [(ngModel)]="c.postType" name="postType" class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2 text-sm normal-case text-[#121417] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]">
              <option value="post">Feed post</option>
              @if (c.hasNetwork('instagram')) {
                <option value="story">Instagram story</option>
                <option value="reel">Instagram reel</option>
              }
              @if (c.hasNetwork('facebook')) {
                <option value="story">Facebook story</option>
              }
              @if (c.hasNetwork('youtube')) {
                <option value="short">YouTube short</option>
                <option value="video">YouTube video</option>
              }
            </select>
          </label>
          @if (c.hasNetwork('instagram')) {
            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Collaborators
              <input [(ngModel)]="c.collaborators" name="collaborators" placeholder="studio, partner" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
            </label>
          }
          @if (c.hasNetwork('instagram') && c.postType === 'reel') {
            <label class="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" [(ngModel)]="c.trialReel" name="trialReel" /> Trial reel
            </label>
            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Reel audio id
              <input [(ngModel)]="c.reelAudio" name="reelAudio" placeholder="Instagram audio id" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
            </label>
          }
          @if (c.hasNetwork('x')) {
            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Who can reply
              <select [(ngModel)]="c.replySettings" name="replySettings" class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2 text-sm normal-case dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="everyone">Everyone</option>
                <option value="following">People you follow</option>
                <option value="mentionedUsers">People you mention</option>
              </select>
            </label>
            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">X community id
              <input [(ngModel)]="c.communityId" name="communityId" placeholder="Optional" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
            </label>
          }
          @if (c.hasNetwork('linkedin') || c.hasNetwork('linkedin-page')) {
            <label class="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" [(ngModel)]="c.linkedinCarousel" name="linkedinCarousel" /> Image carousel
            </label>
          }
          @if (c.hasNetwork('youtube')) {
            <label class="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" [(ngModel)]="c.madeForKids" name="madeForKids" /> Made for kids
            </label>
          }
          @if (c.postKind() !== 'video') {
            <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{{ c.hasNetwork('youtube') ? 'Custom thumbnail' : 'Cover frame' }}
              <select [(ngModel)]="c.coverId" name="coverId" class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2 text-sm normal-case text-[#121417] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]">
                <option value="">First image</option>
                @for (m of c.imageAttachments(); track m.id) { <option [value]="m.id">Image {{ m.id.slice(0, 6) }}</option> }
              </select>
            </label>
          }
        }
        @if (!c.needsType() && !c.needsPoll() && !c.needsThread()) {
          <p class="text-xs text-zinc-500">Pick a channel first. Polls, threads, and post types show up for the networks that use them.</p>
        }
      </section>

      <section class="space-y-3 rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Tags and import</h2>
        <label class="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" [(ngModel)]="c.shortLink" name="shortLink" /> Shorten links in the caption
        </label>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tags
          <input [(ngModel)]="c.tagsText" name="tagsText" placeholder="launch, client" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
        </label>
        @if (c.hashtags().length) {
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Hashtag group
            <select class="mt-1 h-10 w-full rounded-lg border border-[#e8e8e3] bg-[#f7f7f4] px-2 text-sm normal-case text-[#121417] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]" (change)="c.applyHashtags($any($event.target).value)">
              <option value="">Add a group</option>
              @for (group of c.hashtags(); track group.id) { <option [value]="group.tags">{{ group.name }}</option> }
            </select>
          </label>
        }
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Mention
          <input [(ngModel)]="c.mentionQ" name="mentionQ" placeholder="@handle" (ngModelChange)="c.findMentions()" class="mt-1 h-9 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800" />
        </label>
        @for (hit of c.mentions(); track hit.network + hit.handle) {
          <button type="button" (click)="c.insertMention(hit.handle)" class="text-xs font-semibold text-cta">@{{ hit.handle }}</button>
        }
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">CSV import, caption | time
          <textarea [(ngModel)]="c.csvText" name="csvText" rows="3" placeholder="Hello | 2026-09-25T09:00" class="mt-1 w-full rounded-lg border border-[#e8e8e3] px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800"></textarea>
        </label>
        <button type="button" (click)="c.importCsv()" class="text-xs font-semibold text-[#121417] dark:text-zinc-100">Import rows</button>
      </section>
    </div>
  `,
})
export class ComposeMore {
  readonly c = inject(COMPOSE);
}
