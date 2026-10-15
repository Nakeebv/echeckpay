import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * pg-cloudflare's `exports` map points the `default` condition at a stub
 * (empty.js), so node-file-trace copies only that stub into the OpenNext
 * server bundle — while the workerd esbuild pass needs the real
 * `dist/index.js` (CloudflareSocket over `cloudflare:sockets`). Point the
 * default condition at the real implementation so both stages resolve it.
 */
const pkgPath = join(process.cwd(), "node_modules", "pg-cloudflare", "package.json");
if (!existsSync(pkgPath)) {
  process.exit(0);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const dot = pkg.exports?.["."];
if (dot && typeof dot === "object" && dot.default !== "./dist/index.js") {
  dot.default = "./dist/index.js";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("[fix-pg-cloudflare] exports['.'].default -> ./dist/index.js");
}
