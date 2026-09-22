import { AngularAppEngine, createRequestHandler } from "@angular/ssr";

const angularApp = new AngularAppEngine();

export default {
  fetch: createRequestHandler(async (req) => {
    const res = await angularApp.handle(req);
    return res ?? new Response("Not Found", { status: 404 });
  }),
};
