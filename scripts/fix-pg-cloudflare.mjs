import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * 1. pg-cloudflare: point every export condition at the single CJS build.
 *    - The ESM build breaks bundlers (no default export), and node-file-trace
 *      only copies files referenced by the `default` condition.
 *
 * 2. pg: force the Cloudflare socket path inside workerd. pg's own runtime
 *    detection (navigator.userAgent) is defeated by bundling in the Next
 *    server bundle, so select the socket implementation by the presence of
 *    the workerd-only `WebSocketPair` global instead. TLS uses
 *    STARTTLS, which CloudflareSocket implements over `cloudflare:sockets`.
 */
function fixPgCloudflare() {
  const pkgPath = join(process.cwd(), "node_modules", "pg-cloudflare", "package.json");
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.exports?.["."] !== "./dist/index.js") {
    pkg.exports = { ".": "./dist/index.js", "./package.json": "./package.json" };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("[fix-pg-cloudflare] exports pinned to ./dist/index.js");
  }
}

function fixPgStream() {
  const streamPath = join(process.cwd(), "node_modules", "pg", "lib", "stream.js");
  if (!existsSync(streamPath)) return;
  let src = readFileSync(streamPath, "utf8");
  const target = "function getStreamFuncs() {";
  if (!src.includes(target)) return;
  if (src.includes("typeof WebSocketPair")) return; // already patched
  src = src.replace(
    target,
    "function getStreamFuncs() {\n  if (typeof WebSocketPair !== 'undefined') {\n    return getCloudflareStreamFuncs();\n  }",
  );
  writeFileSync(streamPath, src);
  console.log("[fix-pg-stream] WebSocketPair guard added to getStreamFuncs()");
}

fixPgCloudflare();
fixPgStream();
