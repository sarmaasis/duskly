import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AspImageEditor, aspectOption } from "@ascentsparksoftware/angular-image-editor";
import { api, apiBase } from "../lib/api";
import { CompanyDesk } from "../lib/company-desk";
import { Spinner } from "../ui/spinner";

@Component({
  standalone: true,
  imports: [RouterLink, AspImageEditor, Spinner],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-cta">Publishing</p>
        <h1 class="mt-1 font-display text-3xl font-bold tracking-tight text-ink dark:text-zinc-50">Design</h1>
        <p class="mt-1 max-w-xl text-sm text-muted dark:text-zinc-400">Crop, add text, and layer a picture. Saving puts it in the media library so you can attach it to a post.</p>
      </div>

      @if (msg()) {
        <p class="mb-4 rounded-xl border border-[#e8e8e3] bg-white px-4 py-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-900" [class.text-red-600]="err()" [class.text-[#365314]]="!err()" [class.dark:text-lime-200]="!err()">
          {{ msg() }}
          @if (savedId()) {
            <a [routerLink]="['/app/compose']" [queryParams]="{ media: savedId() }" class="ml-2 font-semibold text-cta underline">Use in a post</a>
            <a routerLink="/app/library" class="ml-2 font-semibold underline">Open library</a>
          }
        </p>
      }

      <section class="rounded-2xl border border-[#e8e8e3] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <label class="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e8e8e3] bg-[#fcfcf9] p-10 text-center hover:bg-[#f7f7f4] dark:border-zinc-600 dark:bg-zinc-800">
          <span class="text-sm font-semibold text-[#121417] dark:text-zinc-100">Choose an image</span>
          <span class="mt-1 text-xs text-zinc-500">PNG or JPEG. The editor opens on this page.</span>
          <input type="file" accept="image/*" (change)="onFile($event)" class="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        @if (saving()) {
          <div class="mt-4 flex justify-center text-cta"><dk-spinner [size]="20" label="Saving" /></div>
        }
        @if (editorSrc(); as src) {
          <div class="mt-4">
            <asp-image-editor
              [src]="src"
              mode="full"
              height="36rem"
              accentColor="#ff5c33"
              [baseColor]="editorTheme() === 'dark' ? '#18181b' : '#fcfcf9'"
              [themeMode]="editorTheme()"
              [aspectPresets]="['free', 'original', '1:1', '4:3', '16:9']"
              [aspectRatios]="portraitRatio"
              (saved)="saveEdited($event)"
              (errorOccurred)="onEditorError($event)"
            />
          </div>
        }
      </section>
    </div>
  `,
})
export class DesignPage implements OnInit {
  private readonly desk = inject(CompanyDesk);
  editorSrc = signal<Blob | null>(null);
  readonly portraitRatio = [aspectOption(1080, 1350, "4:5")];
  msg = signal("");
  err = signal(false);
  saving = signal(false);
  savedId = signal("");
  private workspaceId = "";

  async ngOnInit() {
    try {
      const me = await api<{ workspace: { id: string } }>("/v1/workspaces/me");
      this.workspaceId = me.workspace.id;
    } catch {
      this.err.set(true);
      this.msg.set("Sign in to design a picture.");
    }
  }

  editorTheme(): "light" | "dark" {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      this.err.set(true);
      this.msg.set("Choose a PNG or JPEG image.");
      return;
    }
    this.savedId.set("");
    this.err.set(false);
    this.msg.set("");
    this.editorSrc.set(file);
  }

  onEditorError(err: { message?: string }) {
    this.err.set(true);
    this.msg.set(err.message || "The picture editor could not load that image.");
  }

  async saveEdited(blob: Blob) {
    if (!this.workspaceId || this.saving()) return;
    this.saving.set(true);
    this.err.set(false);
    const file = new File([blob], "duskly-edit.png", { type: blob.type || "image/png" });
    try {
      const fd = new FormData();
      fd.set("workspaceId", this.workspaceId);
      fd.set("file", file);
      const groupId = this.desk.current()?.id;
      if (groupId) fd.set("groupId", groupId);
      const res = await fetch(`${apiBase()}/v1/media/upload`, { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
      if (!res.ok || !data.id) {
        this.err.set(true);
        this.msg.set(data.message || data.error || "Could not save the picture.");
        return;
      }
      this.savedId.set(data.id);
      this.err.set(false);
      this.msg.set("Saved to the media library.");
    } catch {
      this.err.set(true);
      this.msg.set("Could not save the picture.");
    } finally {
      this.saving.set(false);
    }
  }
}
