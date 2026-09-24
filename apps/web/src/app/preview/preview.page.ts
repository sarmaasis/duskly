import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { api } from "../lib/api";

@Component({
  standalone: true,
  template: `
    <main class="mx-auto min-h-dvh max-w-lg bg-[#fcfcf9] px-5 py-10 text-[#121417]">
      @if (error()) {
        <p>{{ error() }}</p>
      } @else {
        <p class="font-mono text-[10px] uppercase tracking-wider text-[#a1a1aa]">{{ studio() }}</p>
        <h1 class="mt-2 font-display text-2xl font-bold">Scheduled post</h1>
        @for (shot of media(); track shot.url) {
          <img [src]="shot.url" alt="" class="mt-4 w-full rounded-xl object-cover" />
        }
        <p class="mt-4 whitespace-pre-wrap text-sm">{{ body() }}</p>
        <p class="mt-3 font-mono text-[11px] uppercase text-[#a1a1aa]">{{ status() }}</p>
      }
    </main>
  `,
})
export class PreviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  body = signal("");
  status = signal("");
  studio = signal("");
  media = signal<{ url: string }[]>([]);
  error = signal("");

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get("token") || "";
    try {
      const data = await api<{ body: string; status: string; studio: string; media: { url: string }[] }>(`/v1/posts/public/${token}`);
      this.body.set(data.body);
      this.status.set(data.status);
      this.studio.set(data.studio);
      this.media.set(data.media || []);
    } catch {
      this.error.set("This preview link is not available.");
    }
  }
}
