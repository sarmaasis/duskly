import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Meta, Title } from "@angular/platform-browser";
import { RouterLink } from "@angular/router";
import { CAPTION_LIMITS, countCaptionChars, countHashtags } from "../../lib/caption-limits";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <a routerLink="/tools" class="font-mono text-xs font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4">All tools</a>
      <h1 class="mt-8 font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-5xl">Caption counter</h1>
      <p class="mt-4 text-lg leading-8 text-[#52525b]">Paste a caption. Counts update as you type. Nothing leaves this page.</p>

      <label class="mt-10 block text-xs font-semibold text-[#52525b]" for="caption">Caption</label>
      <textarea
        id="caption"
        [(ngModel)]="caption"
        rows="8"
        class="mt-2 w-full resize-y rounded-xl border border-[#d4d4d8] bg-white px-4 py-3 text-sm leading-6 text-[#09090b] outline-none focus:border-cta focus:ring-1 focus:ring-cta"
        placeholder="Write or paste the post here"
      ></textarea>

      <div class="mt-4 flex flex-wrap gap-6 text-sm">
        <p><span class="font-display text-2xl font-bold">{{ chars }}</span> <span class="text-[#52525b]">characters</span></p>
        <p><span class="font-display text-2xl font-bold">{{ tags }}</span> <span class="text-[#52525b]">hashtags</span></p>
      </div>

      <ul class="mt-10 divide-y divide-[#e4e4e7] border-y border-[#e4e4e7]">
        @for (row of rows; track row.id) {
          <li class="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p class="text-sm font-semibold">{{ row.label }}</p>
              @if (row.hardLimit) {
                <p class="mt-1 text-[12px] text-[#71717a]">Practical preview at {{ row.limit }}. Hard cap is {{ row.hardLimit }}.</p>
              }
            </div>
            <p class="text-sm" [class.text-cta]="row.over" [class.font-semibold]="row.over" [class.text-[#52525b]]="!row.over">
              @if (row.over) {
                Over by {{ row.overBy }} ({{ row.limit }} max)
              } @else {
                {{ row.left }} left of {{ row.limit }}
              }
            </p>
          </li>
        }
      </ul>
    </main>
  `,
})
export class CaptionCounterPage {
  caption = "";

  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle("Caption counter | Duskly");
    meta.updateTag({
      name: "description",
      content: "Live caption length checker for X, Threads, Instagram, Facebook, and LinkedIn. Counts characters and hashtags in the browser.",
    });
  }

  get chars() {
    return countCaptionChars(this.caption);
  }

  get tags() {
    return countHashtags(this.caption);
  }

  get rows() {
    const n = this.chars;
    return CAPTION_LIMITS.map((net) => {
      const overBy = Math.max(0, n - net.limit);
      return {
        ...net,
        over: overBy > 0,
        overBy,
        left: Math.max(0, net.limit - n),
      };
    });
  }
}
