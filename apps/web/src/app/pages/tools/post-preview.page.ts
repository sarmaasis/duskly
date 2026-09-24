import { Component, inject, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Meta, Title } from "@angular/platform-browser";
import { RouterLink } from "@angular/router";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <a routerLink="/tools" class="font-mono text-xs font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4">All tools</a>
      <h1 class="mt-8 font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-5xl">Post preview</h1>
      <p class="mt-4 max-w-xl text-lg leading-8 text-[#52525b]">Caption plus an optional local image, shown as a plain card. Not a network clone.</p>

      <div class="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold text-[#52525b]" for="preview-caption">Caption</label>
          <textarea
            id="preview-caption"
            [(ngModel)]="caption"
            rows="8"
            class="mt-2 w-full resize-y rounded-xl border border-[#d4d4d8] bg-white px-4 py-3 text-sm leading-6 text-[#09090b] outline-none focus:border-cta focus:ring-1 focus:ring-cta"
            placeholder="What the post will say"
          ></textarea>

          <label
            class="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition"
            [class.border-cta]="over"
            [class.bg-orange-50]="over"
            [class.border-[#d4d4d8]]="!over"
            [class.bg-white]="!over"
            (dragover)="onDragOver($event)"
            (dragleave)="over = false"
            (drop)="onDrop($event)"
          >
            <input type="file" accept="image/*" class="sr-only" (change)="onFile($event)" />
            <p class="text-sm font-semibold">{{ preview ? "Replace image" : "Optional image" }}</p>
            <p class="mt-1 text-[13px] text-[#71717a]">Stays local. Not uploaded.</p>
          </label>
          @if (preview) {
            <button type="button" (click)="clearImage()" class="mt-3 text-[13px] font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4 hover:text-[#09090b]">
              Remove image
            </button>
          }
        </div>

        <article class="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-[0_10px_40px_-24px_rgba(9,9,11,0.35)]">
          @if (preview) {
            <div class="overflow-hidden rounded-lg bg-[#f7f7f4]">
              <img [src]="preview" alt="" class="mx-auto max-h-[360px] w-auto max-w-full object-contain" />
            </div>
          } @else {
            <div class="flex h-40 items-center justify-center rounded-lg bg-[#f7f7f4] text-[13px] text-[#71717a]">No image</div>
          }
          <p class="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-[#09090b]">{{ caption || "Your caption will show here." }}</p>
        </article>
      </div>
    </main>
  `,
})
export class PostPreviewPage implements OnDestroy {
  caption = "";
  preview = "";
  over = false;

  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle("Post preview | Duskly");
    meta.updateTag({
      name: "description",
      content: "Preview a social post as a plain card. Caption plus an optional local image. No account, no upload.",
    });
  }

  ngOnDestroy() {
    this.revoke();
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.over = true;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.over = false;
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.load(file);
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.load(file);
    input.value = "";
  }

  clearImage() {
    this.revoke();
  }

  private load(file: File) {
    if (!file.type.startsWith("image/")) return;
    this.revoke();
    this.preview = URL.createObjectURL(file);
  }

  private revoke() {
    if (this.preview) URL.revokeObjectURL(this.preview);
    this.preview = "";
  }
}
