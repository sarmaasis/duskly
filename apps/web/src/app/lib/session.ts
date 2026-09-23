import { Injectable, computed, signal } from "@angular/core";
import { apiBase } from "./api";
import { isBrowser } from "./browser";

export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type SessionPayload = {
  user?: AuthUser | null;
  session?: { id?: string; userId?: string } | null;
};

export const AUTH_SIGN_OUT_PATH = "/api/auth/sign-out";
export const AUTH_GET_SESSION_PATH = "/api/auth/get-session";

@Injectable({ providedIn: "root" })
export class SessionService {
  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);
  readonly loggedIn = computed(() => !!this.user());

  private inflight: Promise<void> | null = null;
  private loaded = false;

  constructor() {
    void this.ensure();
  }

  ensure(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    return this.load();
  }

  refresh(): Promise<void> {
    this.loaded = false;
    return this.load();
  }

  async signOut(): Promise<void> {
    if (isBrowser()) {
      try {
        await fetch(`${apiBase()}${AUTH_SIGN_OUT_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
      } catch {
        /* cookie may already be gone */
      }
    }
    this.user.set(null);
    this.loaded = true;
    this.ready.set(true);
  }

  private load(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (!isBrowser()) {
      this.ready.set(true);
      return Promise.resolve();
    }
    this.inflight = this.fetchSession().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchSession(): Promise<void> {
    try {
      const res = await fetch(`${apiBase()}${AUTH_GET_SESSION_PATH}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        this.user.set(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as SessionPayload | null;
      const user = data?.user;
      this.user.set(user?.id ? user : null);
    } catch {
      this.user.set(null);
    } finally {
      this.loaded = true;
      this.ready.set(true);
    }
  }
}
