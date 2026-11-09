import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const forbidden = [
  "XAI_API_KEY",
  "api.x.ai",
  "GEMINI_API_KEY",
  "generativelanguage.googleapis.com",
  "@google/genai",
  "process.env.API_KEY",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css|html)$/.test(name) ? [full] : [];
  });
}

describe("client boundary", () => {
  it("keeps the model key and the model endpoint off the client", () => {
    const files = [
      ...sourceFiles(path.join(root, "components")),
      ...sourceFiles(path.join(root, "services")),
      path.join(root, "App.tsx"),
      path.join(root, "index.tsx"),
      path.join(root, "index.html"),
      path.join(root, "vite.config.ts"),
    ];
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden.filter((needle) => text.includes(needle)).map((needle) => `${path.relative(root, file)} contains ${needle}`);
    });
    expect(hits).toEqual([]);
  });
});
