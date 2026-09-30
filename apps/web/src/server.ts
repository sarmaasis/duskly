import { AngularAppEngine, createRequestHandler } from "@angular/ssr";
import { allowedHostsFromWebOrigin } from "./allowed-hosts";

type Env = {
  API_ORIGIN?: string;
  WEB_ORIGIN?: string;
};

let angularApp: AngularAppEngine | undefined;
let cachedOriginKey: string | undefined;

function appEngine(origin: string | undefined): AngularAppEngine {
  const key = origin ?? "";
  if (!angularApp || cachedOriginKey !== key) {
    angularApp = new AngularAppEngine({ allowedHosts: allowedHostsFromWebOrigin(origin) });
    cachedOriginKey = key;
  }
  return angularApp;
}

function withSecurityHeaders(res: Response) {
  const next = new Response(res.body, res);
  next.headers.set("X-Content-Type-Options", "nosniff");
  next.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return next;
}

function apiOriginScript(env: Env) {
  const origin = (env.API_ORIGIN || "").replace(/\/$/, "");
  return `window.__API__=${JSON.stringify(origin)};`;
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname === "/__api-config.js") {
      return new Response(apiOriginScript(env), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    const handleAngular = createRequestHandler((r) => appEngine(env.WEB_ORIGIN).handle(r));
    const res = await handleAngular(req);
    if (!res) return withSecurityHeaders(new Response("Not Found", { status: 404 }));
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") || !env.API_ORIGIN) return withSecurityHeaders(res);
    const html = await res.text();
    return withSecurityHeaders(
      new Response(html.replace("</head>", `<script>${apiOriginScript(env)}</script></head>`), res),
    );
  },
};
