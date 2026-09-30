// Angular platform-server lazily imports xhr2 when XMLHttpRequest is missing.
// That Node http polyfill cannot run on Workers. HttpClient already uses fetch.
export default {
  XMLHttpRequest: class {
    constructor() {
      throw new Error(
        "xhr2 is not available on Cloudflare Workers. Use the HttpClient fetch backend.",
      );
    }
  },
};
