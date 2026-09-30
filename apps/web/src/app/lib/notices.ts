import { Injectable, signal } from "@angular/core";

export type NoticeTone = "info" | "ok" | "error";

export type Notice = {
  id: string;
  tone: NoticeTone;
  text: string;
};

@Injectable({ providedIn: "root" })
export class Notices {
  readonly items = signal<Notice[]>([]);

  push(tone: NoticeTone, text: string) {
    const id = crypto.randomUUID();
    this.items.update((list) => [...list, { id, tone, text }].slice(-4));
    setTimeout(() => this.dismiss(id), tone === "error" ? 8000 : 4200);
  }

  dismiss(id: string) {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }
}
