import { Component, inject } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <h1 class="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-6xl">
        Free tools for captions and images
      </h1>
      <p class="mt-6 max-w-xl text-lg leading-8 text-[#52525b]">
        Check length, crop, and a simple post card in the browser. No account.
      </p>

      <div class="mt-14 grid gap-4 lg:grid-cols-12">
        <a routerLink="/tools/caption-counter" class="rounded-xl border border-[#e4e4e7] bg-white p-7 transition hover:border-zinc-300 hover:shadow-sm lg:col-span-7">
          <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-cta">Limits</p>
          <h2 class="mt-3 font-display text-3xl font-bold tracking-normal">Caption counter</h2>
          <p class="mt-3 max-w-md text-sm leading-6 text-[#52525b]">
            Paste a caption. Live counts for X, Threads, Instagram, Facebook, and LinkedIn, plus hashtags.
          </p>
        </a>
        <a routerLink="/tools/image-size" class="rounded-xl border border-[#e4e4e7] bg-[#f7f7f4] p-7 transition hover:border-zinc-300 hover:shadow-sm lg:col-span-5">
          <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-cta">Frames</p>
          <h2 class="mt-3 font-display text-2xl font-bold tracking-normal">Image size check</h2>
          <p class="mt-3 text-sm leading-6 text-[#52525b]">
            Drop a photo locally. See pixels and whether 1:1, 4:5, or 16:9 needs a heavy crop.
          </p>
        </a>
        <a routerLink="/tools/post-preview" class="rounded-xl border border-[#e4e4e7] bg-white p-7 transition hover:border-zinc-300 hover:shadow-sm lg:col-span-12">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-cta">Read it</p>
              <h2 class="mt-3 font-display text-2xl font-bold tracking-normal">Post preview</h2>
              <p class="mt-3 max-w-lg text-sm leading-6 text-[#52525b]">
                One caption and an optional local image on a plain card. Enough to read before you schedule.
              </p>
            </div>
            <span class="font-mono text-[12px] font-semibold text-[#09090b]">Open →</span>
          </div>
        </a>
      </div>
    </main>
  `,
})
export class ToolsIndexPage {
  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle("Free tools | Duskly");
    meta.updateTag({
      name: "description",
      content: "Free browser tools for social captions, image crop checks, and a simple post preview. No account required.",
    });
  }
}
