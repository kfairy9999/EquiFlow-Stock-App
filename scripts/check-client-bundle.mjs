import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "dist");
const forbidden = ["XAI_API_KEY", "api.x.ai", "GEMINI_API_KEY", "generativelanguage.googleapis.com", "@google/genai", "AIza"];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(full) : [full];
    }),
  );
  return nested.flat();
}

const files = (await filesIn(root)).filter((file) => /\.(js|css|html|svg)$/.test(file));
const hits = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) hits.push(`${path.relative(root, file)} contains ${needle}`);
  }
}

if (hits.length > 0) {
  console.error(hits.join("\n"));
  process.exit(1);
}

console.log(`Checked ${files.length} built files. No model key or model endpoint in the client bundle.`);
