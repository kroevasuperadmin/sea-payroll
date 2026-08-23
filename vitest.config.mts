import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The CJS builds of the Solana packages require() ESM-only dependencies
      // (@noble/curves, uuid), which Node refuses to load. Point at their ESM
      // builds instead.
      "@solana/spl-token": path.resolve(
        __dirname,
        "node_modules/@solana/spl-token/lib/esm/index.js"
      ),
      "@solana/web3.js": path.resolve(
        __dirname,
        "node_modules/@solana/web3.js/lib/index.esm.js"
      ),
      "rpc-websockets": path.resolve(
        __dirname,
        "node_modules/rpc-websockets/dist/index.mjs"
      ),
    },
  },
  test: {
    environment: "node",
    // Inlining makes Vite (not Node) resolve these packages, so the ESM
    // aliases above apply to their internal imports too.
    server: { deps: { inline: [/@solana\//, "rpc-websockets"] } },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
    },
  },
});
