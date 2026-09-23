import { AngularAppEngine, createRequestHandler } from "@angular/ssr";

type Env = {
  API_ORIGIN?: string;
};

const angularApp = new AngularAppEngine();
const handleAngular = createRequestHandler((req: Request) => angularApp.handle(req));

function withSecurityHeaders(res: Response) {
  const next = new Response(res.body, res);
  next.headers.set("X-Content-Type-Options", "nosniff");
  next.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return next;
}

export default {
  async fetch(req: Request, env: Env) {
    const res = await handleAngular(req);
    if (!res) return withSecurityHeaders(new Response("Not Found", { status: 404 }));
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") || !env.API_ORIGIN) return withSecurityHeaders(res);
    const html = await res.text();
    const api = JSON.stringify(env.API_ORIGIN.replace(/\/$/, ""));
    return withSecurityHeaders(
      new Response(html.replace("</head>", `<script>window.__API__=${api}</script></head>`), res),
    );
  },
};
