import { defineConfig } from "vitest/config";

// Component tests opt into jsdom with a `// @vitest-environment jsdom` comment; the rest run in node.
export default defineConfig({ test: { include: ["test/**/*.test.{ts,tsx}"] }, esbuild: { jsx: "automatic" } });
