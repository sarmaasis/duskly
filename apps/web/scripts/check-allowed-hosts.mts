import { allowedHostsFromWebOrigin } from "../src/allowed-hosts.ts";

function same(actual: string[], expected: string[]) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    throw new Error(`expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`);
  }
}

same(allowedHostsFromWebOrigin(undefined), [
  "duskly.site",
  "www.duskly.site",
  "localhost",
  "127.0.0.1",
]);
same(allowedHostsFromWebOrigin(""), [
  "duskly.site",
  "www.duskly.site",
  "localhost",
  "127.0.0.1",
]);
same(allowedHostsFromWebOrigin("https://duskly.site"), [
  "duskly.site",
  "www.duskly.site",
  "localhost",
  "127.0.0.1",
]);
same(allowedHostsFromWebOrigin("https://example.com"), [
  "example.com",
  "www.example.com",
  "localhost",
  "127.0.0.1",
]);
same(allowedHostsFromWebOrigin("https://www.example.com"), [
  "www.example.com",
  "example.com",
  "localhost",
  "127.0.0.1",
]);
same(allowedHostsFromWebOrigin("not a url"), [
  "duskly.site",
  "www.duskly.site",
  "localhost",
  "127.0.0.1",
]);

console.log("allowed-hosts ok");
