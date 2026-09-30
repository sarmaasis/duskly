import { Component, ElementRef, Input, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { COMPOSE } from "./compose-context";

@Component({
  selector: "dk-compose-pictures",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
      <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <label
          class="relative flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center"
          [class.border-cta]="dragging()"
          [class.bg-cta-soft]="dragging()"
          [class.border-[#e8e8e3]]="!dragging()"
          [class.bg-[#fcfcf9]]="!dragging()"
          [class.dark:border-zinc-600]="!dragging()"
          [class.dark:bg-zinc-800]="!dragging()"
          (dragover)="over($event)"
          (dragleave)="dragging.set(false)"
          (drop)="drop($event)"
          (paste)="paste($event)"
          tabindex="0"
        >
          <span class="text-sm font-semibold text-[#121417] dark:text-zinc-100">{{ kind === 'video' ? 'Click to upload a video' : 'Click to upload pictures' }}</span>
          <span class="mt-1 text-xs text-zinc-500">or drag and drop, or paste from the clipboard</span>
          <input type="file" [accept]="kind === 'video' ? 'video/*' : 'image/*'" multiple (change)="c.onAttachFiles($event)" class="sr-only" />
        </label>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          @if (kind === 'image') {
            <button type="button" (click)="c.askImage()" [disabled]="!!c.aiBusy() || (c.usage()?.limits.aiImages||0)===0" class="rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">Generate image</button>
            <a routerLink="/app/design" class="text-xs font-semibold text-cta">Design a picture</a>
          }
          @if (kind === 'video') {
            <button type="button" (click)="c.askVideo()" [disabled]="!!c.aiBusy()" class="rounded-full border border-[#e8e8e3] bg-[#f7f7f4] px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">Generate AI video</button>
          }
        </div>
        @if (c.askKind(); as kind) {
          <form class="mt-3 space-y-3 rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-3 dark:border-zinc-700 dark:bg-zinc-800" (ngSubmit)="c.runAsk()">
            <label class="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">{{ kind === 'image' ? 'Describe the image' : 'Describe the video' }}
              <textarea [(ngModel)]="c.askText" name="aiPrompt" rows="3" [placeholder]="kind === 'image' ? 'A paper desk at dusk, one orange lamp' : 'A slow pan across a quiet street at dusk'" class="mt-1.5 w-full resize-y rounded-xl border border-[#e8e8e3] bg-white px-3 py-2 text-sm text-[#121417] outline-none focus:border-cta dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"></textarea>
            </label>
            <div class="flex items-center gap-2">
              <button type="submit" [disabled]="!c.askText.trim() || !!c.aiBusy()" class="inline-flex h-9 items-center rounded-full bg-cta px-3.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{{ c.aiBusy() ? 'Generating…' : 'Generate' }}</button>
              <button type="button" (click)="c.askKind.set(null)" [disabled]="!!c.aiBusy()" class="text-xs font-semibold text-[#52525b] disabled:opacity-40">Cancel</button>
            </div>
          </form>
        }
        @if (c.aiBusy() === 'video') {
          <div class="mt-3 flex aspect-video min-h-[240px] w-full items-center justify-center rounded-xl border border-dashed border-[#e8e8e3] bg-[#f7f7f4] dark:border-zinc-700 dark:bg-zinc-800">
            <p class="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Generating AI video…</p>
          </div>
        }
        @for (m of c.attachments(); track m.id) {
          @if (m.kind === 'video') {
            <div class="relative mt-3">
              <video [src]="m.url" [attr.data-id]="m.id" controls playsinline class="aspect-video min-h-[240px] w-full rounded-xl border border-[#e8e8e3] bg-black object-contain dark:border-zinc-700"></video>
              <button type="button" (click)="c.removeAttachment(m.id)" class="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">Remove</button>
            </div>
          }
        }
        @if (c.attachments().some((item) => item.kind === 'video')) {
          <div class="mt-3 rounded-xl border border-[#e8e8e3] bg-[#fcfcf9] p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <p class="text-xs font-semibold text-[#121417] dark:text-zinc-100">Thumbnail</p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              @if (c.coverPreview()) {
                <img [src]="c.coverPreview()" alt="Video thumbnail" class="h-16 w-28 rounded-lg object-cover" />
              } @else {
                <div class="flex h-16 w-28 items-center justify-center rounded-lg bg-[#f3f3f0] text-[11px] text-zinc-500 dark:bg-zinc-900">No thumbnail</div>
              }
              <div class="flex flex-wrap gap-2">
                <label class="inline-flex h-9 cursor-pointer items-center rounded-full border border-[#e8e8e3] bg-white px-3 text-xs font-semibold text-[#121417] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
                  Upload thumbnail
                  <input type="file" accept="image/jpeg,image/png,image/webp" (change)="c.onCoverFile($event)" class="sr-only" />
                </label>
                <button type="button" (click)="useFrame()" [disabled]="c.coverBusy()" class="inline-flex h-9 items-center rounded-full border border-[#e8e8e3] bg-white px-3 text-xs font-semibold text-[#121417] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">Use this frame</button>
                @if (c.coverPreview()) {
                  <button type="button" (click)="c.clearCover()" class="inline-flex h-9 items-center px-2 text-xs font-semibold text-[#52525b]">Remove thumbnail</button>
                }
              </div>
            </div>
          </div>
        }
        @if (c.imageAttachments().length) {
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            @for (m of c.imageAttachments(); track m.id) {
              <div class="relative overflow-hidden rounded-xl border border-[#e8e8e3] dark:border-zinc-700">
                <img [src]="m.url" [alt]="c.alts[m.id] || 'Attached image'" class="h-28 w-full object-cover" />
                <button type="button" (click)="c.removeAttachment(m.id)" class="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">Remove</button>
                <input [ngModel]="c.alts[m.id] || ''" (ngModelChange)="c.setAlt(m.id, $event)" [name]="'alt-' + m.id" placeholder="Alt text" class="w-full border-t border-[#e8e8e3] bg-white px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
            }
          </div>
        }
      </section>
  `,
})
export class ComposePictures {
  /** Drop zone for the current post type. */
  @Input() kind: "text" | "image" | "video" = "image";
  readonly c = inject(COMPOSE);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly dragging = signal(false);

  useFrame() {
    const video = this.host.nativeElement.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) return;
    void this.c.useVideoFrame(video);
  }

  over(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  drop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    void this.c.attachFiles([...(event.dataTransfer?.files || [])]);
  }

  paste(event: ClipboardEvent) {
    const files = [...(event.clipboardData?.files || [])];
    if (!files.length) return;
    event.preventDefault();
    void this.c.attachFiles(files);
  }
}
