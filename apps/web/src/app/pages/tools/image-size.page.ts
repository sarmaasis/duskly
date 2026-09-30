import { Component, inject, OnDestroy, signal } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { RouterLink } from "@angular/router";
import { AspectPreset, pictureEditorFrameRects } from "../../lib/picture-editor";

const PRESETS: { id: AspectPreset; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "16:9", label: "16:9" },
];

/** Discard more than this and the cover crop is heavy. */
const HEAVY_CROP = 0.12;

type FitRow = { id: string; label: string; ok: boolean; discardPct: number };

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <a routerLink="/tools" class="font-mono text-xs font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4">All tools</a>
      <h1 class="mt-8 font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-5xl">Image size check</h1>
      <p class="mt-4 text-lg leading-8 text-[#52525b]">Drop a photo here. It stays on your machine. We only read pixels in the browser.</p>

      <label
        class="mt-10 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition"
        [class.border-cta]="over()"
        [class.bg-orange-50]="over()"
        [class.border-[#d4d4d8]]="!over()"
        [class.bg-white]="!over()"
        (dragover)="onDragOver($event)"
        (dragleave)="over.set(false)"
        (drop)="onDrop($event)"
      >
        <input type="file" accept="image/*" class="sr-only" (change)="onFile($event)" />
        <p class="text-sm font-semibold">Drop an image, or click to pick one</p>
        <p class="mt-1 text-[13px] text-[#71717a]">PNG, JPG, WebP. Not uploaded.</p>
      </label>

      @if (error()) {
        <p class="mt-4 text-sm font-medium text-cta">{{ error() }}</p>
      }

      @if (preview()) {
        <div class="mt-10">
          <div class="overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#f7f7f4]">
            <img [src]="preview()" [alt]="name()" class="mx-auto max-h-[420px] w-auto max-w-full object-contain" />
          </div>
          <div class="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <p><span class="font-semibold">{{ width() }} × {{ height() }}</span> <span class="text-[#52525b]">pixels</span></p>
            <p class="text-[#52525b]">{{ orientation() }}</p>
            <p class="truncate text-[#71717a]">{{ name() }}</p>
          </div>

          <ul class="mt-8 divide-y divide-[#e4e4e7] border-y border-[#e4e4e7]">
            @for (row of fits(); track row.id) {
              <li class="flex items-baseline justify-between gap-4 py-4">
                <p class="text-sm font-semibold">{{ row.label }}</p>
                @if (row.ok) {
                  <p class="text-sm text-[#52525b]">Fits without a heavy crop</p>
                } @else {
                  <p class="text-sm font-semibold text-cta">Needs a crop ({{ row.discardPct }}% off)</p>
                }
              </li>
            }
          </ul>
        </div>
      }
    </main>
  `,
})
export class ImageSizePage implements OnDestroy {
  readonly over = signal(false);
  readonly error = signal("");
  readonly preview = signal("");
  readonly name = signal("");
  readonly width = signal(0);
  readonly height = signal(0);
  readonly orientation = signal("");
  readonly fits = signal<FitRow[]>([]);

  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle("Image size check | Duskly");
    meta.updateTag({
      name: "description",
      content: "Check an image’s pixel size and whether it fits Original, 1:1, 4:5, or 16:9 without a heavy crop. Local files only.",
    });
  }

  ngOnDestroy() {
    this.revoke();
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(true);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.load(file);
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.load(file);
    input.value = "";
  }

  private load(file: File) {
    if (!file.type.startsWith("image/")) {
      this.error.set("Choose an image file.");
      return;
    }
    this.error.set("");
    this.revoke();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this.preview.set(url);
      this.name.set(file.name);
      this.width.set(img.naturalWidth);
      this.height.set(img.naturalHeight);
      this.orientation.set(img.naturalWidth === img.naturalHeight ? "Square" : img.naturalWidth > img.naturalHeight ? "Landscape" : "Portrait");
      this.fits.set(
        PRESETS.map((preset) => {
          const discard = discardFraction({ width: img.naturalWidth, height: img.naturalHeight }, preset.id);
          return {
            id: preset.id,
            label: preset.label,
            ok: discard <= HEAVY_CROP,
            discardPct: Math.round(discard * 100),
          };
        }),
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.error.set("Could not read that image.");
    };
    img.src = url;
  }

  private revoke() {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set("");
  }
}

function discardFraction(img: { width: number; height: number }, preset: AspectPreset): number {
  const r = pictureEditorFrameRects(img, preset, 0);
  return 1 - (r.sw * r.sh) / Math.max(1, img.width * img.height);
}
