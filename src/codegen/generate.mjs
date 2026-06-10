// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Typed hash-map code generator (phase 6b-1).
//
//   node src/codegen/generate.mjs            # write the 36 classes + 36 tests
//   node src/codegen/generate.mjs --check    # drift gate: fail if regen differs
//   node src/codegen/generate.mjs --out DIR  # write to DIR instead (reconcile)
//
// See src/codegen/README.md for the spec/template model and how to add a type.
// ---------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pairs } from "./spec.mjs";
import {
  renderSource,
  renderTest,
  sourceFileName,
  testFileName,
} from "./templates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const TARGET_DIR = join(REPO_ROOT, "src", "typed", "hashmap");

// The command embedded in every generated file's DO-NOT-EDIT banner.
export const REGEN_COMMAND = "npm run generate:typed-hashmap";

/** Produce the full {relPath -> contents} map of generated files. */
export function generateFiles() {
  const files = new Map();
  for (const pair of pairs()) {
    files.set(sourceFileName(pair.key, pair.val), renderSource(pair, REGEN_COMMAND));
    files.set(testFileName(pair.key, pair.val), renderTest(pair, REGEN_COMMAND));
  }
  return files;
}

async function writeAll(outDir) {
  await mkdir(outDir, { recursive: true });
  const files = generateFiles();
  for (const [name, contents] of files) {
    await writeFile(join(outDir, name), contents, "utf8");
  }
  return files.size;
}

async function check() {
  const files = generateFiles();
  let drift = 0;
  for (const [name, contents] of files) {
    const path = join(TARGET_DIR, name);
    if (!existsSync(path)) {
      console.error(`MISSING: ${name} (generator would create it)`);
      drift++;
      continue;
    }
    const existing = await readFile(path, "utf8");
    if (existing !== contents) {
      console.error(`DRIFT: ${name} differs from generator output`);
      drift++;
    }
  }
  if (drift > 0) {
    console.error(
      `\n${drift} file(s) drifted. Run \`${REGEN_COMMAND}\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`OK: all ${files.size} generated files match the template.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    await check();
    return;
  }
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? resolve(args[outIdx + 1]) : TARGET_DIR;
  const count = await writeAll(outDir);
  console.log(`Generated ${count} files into ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
