// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Collection code generator (phases 6b-1 + 6b-2 + 6b-3).
//
//   node src/codegen/generate.mjs                 # write ALL generated families
//   node src/codegen/generate.mjs --check         # drift gate (ALL families)
//   node src/codegen/generate.mjs --family hashmap        # one family only
//   node src/codegen/generate.mjs --family stack --check  # drift gate, one family
//   node src/codegen/generate.mjs --out DIR       # emit to DIR (reconciliation)
//
// Seven families are generated from the spec + templates:
//   hashmap            src/typed/hashmap/   (36 K×V classes, mutable + immutable — 6b-1)
//   arraylist          src/typed/arraylist/ (mutable + immutable, 6 prims — 6b-2)
//   hashset            src/typed/hashset/   (mutable + immutable, 6 prims — 6b-2)
//   stack              src/typed/stack/     (mutable + immutable, 6 prims — 6b-2)
//   bag                src/typed/bag/       (mutable + immutable, 6 prims — 6b-2)
//   hashmap-nontyped   src/hashmap/   (number/bigint map+bimap+immutable — 6b-3)
//   multimap-nontyped  src/multimap/  (number/bigint list+set multimap — 6b-3)
//
// The 6b-3 families emit into MIXED directories (src/hashmap, src/multimap) that
// also hold hand-written object-keyed maps + the multimap aggregator; those hand
// files carry no generated banner, so the STALE scan ignores them and the
// builders never emit object-keyed names.
//
// See src/codegen/README.md for the spec/template model and how to add a type.
// ---------------------------------------------------------------------------

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PRIMS, pairs } from "./spec.mjs";
import {
  renderSource,
  renderTest,
  sourceFileName,
  testFileName,
  renderImmutableSource,
  renderImmutableTest,
  immSourceFileName,
  immTestFileName,
} from "./templates.mjs";
import * as F from "./families.mjs";
import * as NT from "./nontyped.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");
const TYPED_DIR = join(SRC_DIR, "typed");

// Each family declares its target directory (`dir`, resolved under `base`, which
// defaults to src/typed/), its regenerate command (which is embedded in every
// generated file's DO-NOT-EDIT banner), and a builder that returns the family's
// {fileName -> contents} map. The builder is the single place that knows whether
// a family has a K×V cross-product (hashmap), a single element axis (the 6b-2
// families), or an immutable companion.
//
// The phase-6b-3 NON-TYPED number/bigint map families set `base: SRC_DIR` so
// they emit directly into src/hashmap/ and src/multimap/, alongside the
// HAND-WRITTEN object-keyed maps and aggregators. Those hand files carry NO
// generated banner, so the STALE scan in checkFamily ignores them; the builders
// here emit ONLY the number/bigint file names, never the object-keyed ones.
const FAMILIES = [
  {
    name: "hashmap",
    dir: "hashmap",
    command: "npm run generate:typed-hashmap",
    build(command) {
      const files = new Map();
      for (const pair of pairs()) {
        files.set(sourceFileName(pair.key, pair.val), renderSource(pair, command));
        files.set(testFileName(pair.key, pair.val), renderTest(pair, command));
        files.set(immSourceFileName(pair.key, pair.val), renderImmutableSource(pair, command));
        files.set(immTestFileName(pair.key, pair.val), renderImmutableTest(pair, command));
      }
      return files;
    },
  },
  {
    name: "arraylist",
    dir: "arraylist",
    command: "npm run generate:typed-arraylist",
    build(command) {
      const files = new Map();
      for (const p of PRIMS) {
        files.set(F.arrayListSourceFileName(p), F.renderArrayList(p, command));
        files.set(F.arrayListTestFileName(p), F.renderArrayListTest(p, command));
        files.set(F.immArrayListSourceFileName(p), F.renderImmutableArrayList(p, command));
        files.set(F.immArrayListTestFileName(p), F.renderImmutableArrayListTest(p, command));
      }
      return files;
    },
  },
  {
    name: "hashset",
    dir: "hashset",
    command: "npm run generate:typed-hashset",
    build(command) {
      const files = new Map();
      for (const p of PRIMS) {
        files.set(F.hashSetSourceFileName(p), F.renderHashSet(p, command));
        files.set(F.hashSetTestFileName(p), F.renderHashSetTest(p, command));
        files.set(F.immHashSetSourceFileName(p), F.renderImmutableHashSet(p, command));
        files.set(F.immHashSetTestFileName(p), F.renderImmutableHashSetTest(p, command));
      }
      return files;
    },
  },
  {
    name: "stack",
    dir: "stack",
    command: "npm run generate:typed-stack",
    build(command) {
      const files = new Map();
      for (const p of PRIMS) {
        files.set(F.stackSourceFileName(p), F.renderStack(p, command));
        files.set(F.stackTestFileName(p), F.renderStackTest(p, command));
        files.set(F.immStackSourceFileName(p), F.renderImmutableStack(p, command));
        files.set(F.immStackTestFileName(p), F.renderImmutableStackTest(p, command));
      }
      return files;
    },
  },
  {
    name: "bag",
    dir: "bag",
    command: "npm run generate:typed-bag",
    build(command) {
      const files = new Map();
      for (const p of PRIMS) {
        files.set(F.bagSourceFileName(p), F.renderBag(p, command));
        files.set(F.bagTestFileName(p), F.renderBagTest(p, command));
        files.set(F.immBagSourceFileName(p), F.renderImmutableBag(p, command));
        files.set(F.immBagTestFileName(p), F.renderImmutableBagTest(p, command));
      }
      return files;
    },
  },
  // ---- phase 6b-3: NON-TYPED number/bigint K×V maps (plain Array / Map) ----
  {
    name: "hashmap-nontyped",
    base: SRC_DIR,
    dir: "hashmap",
    command: "npm run generate:hashmap-nontyped",
    build(command) {
      const files = new Map();
      for (const pair of NT.nonTypedPairs()) {
        // mutable hash map + its generated test
        files.set(NT.hashMapSourceFileName(pair), NT.renderHashMap(pair, command));
        files.set(NT.hashMapTestFileName(pair), NT.renderHashMapTest(pair, command));
        // hash bi-map (no generated test)
        files.set(NT.biMapSourceFileName(pair), NT.renderBiMap(pair, command));
        // immutable hash map + its generated test
        files.set(NT.immMapSourceFileName(pair), NT.renderImmutableMap(pair, command));
        files.set(NT.immMapTestFileName(pair), NT.renderImmutableMapTest(pair, command));
      }
      return files;
    },
  },
  {
    name: "multimap-nontyped",
    base: SRC_DIR,
    dir: "multimap",
    command: "npm run generate:multimap-nontyped",
    build(command) {
      const files = new Map();
      for (const pair of NT.nonTypedPairs()) {
        for (const variant of ["list", "set"]) {
          files.set(
            NT.multimapSourceFileName(pair, variant),
            NT.renderMultimap(pair, variant, command),
          );
        }
      }
      return files;
    },
  },
];

/** Absolute target dir for a family (`base` defaults to src/typed/). */
function familyDir(fam) {
  return join(fam.base ?? TYPED_DIR, fam.dir);
}

/** Resolve which families to act on from a --family filter (default: all). */
function selectFamilies(name) {
  if (!name) return FAMILIES;
  const fam = FAMILIES.find((f) => f.name === name);
  if (!fam) {
    console.error(
      `Unknown family "${name}". Known: ${FAMILIES.map((f) => f.name).join(", ")}.`,
    );
    process.exit(1);
  }
  return [fam];
}

/** Write a family's generated files into `targetDir`. */
async function writeFamily(fam, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const files = fam.build(fam.command);
  for (const [name, contents] of files) {
    await writeFile(join(targetDir, name), contents, "utf8");
  }
  return files.size;
}

// Banner stamped into every generated file. A committed file in a target dir
// that carries this marker but is NOT in the generator's expected set is STALE
// (the generator stopped emitting it) — the gate must flag it, otherwise a
// dropped file would silently survive with no comparison.
const GENERATED_MARKER = "CODE GENERATED";

/** Drift-check a family against its committed files. Returns the drift count. */
async function checkFamily(fam) {
  const targetDir = familyDir(fam);
  const files = fam.build(fam.command);
  let drift = 0;
  for (const [name, contents] of files) {
    const path = join(targetDir, name);
    if (!existsSync(path)) {
      console.error(`MISSING: ${fam.name}/${name} (generator would create it)`);
      drift++;
      continue;
    }
    const existing = await readFile(path, "utf8");
    if (existing !== contents) {
      console.error(`DRIFT: ${fam.name}/${name} differs from generator output`);
      drift++;
    }
  }
  // Catch STALE/EXTRA generated files: any banner-carrying file on disk that the
  // generator no longer emits. (Hand-written files lack the banner and are
  // correctly ignored.) Without this, dropping a file from the generator would
  // leave its stale committed copy unchecked and the gate would still pass.
  for (const entry of await readdir(targetDir)) {
    if (files.has(entry)) continue;
    const path = join(targetDir, entry);
    let head;
    try {
      head = await readFile(path, "utf8");
    } catch {
      continue; // not a readable file (e.g. a subdirectory)
    }
    if (head.includes(GENERATED_MARKER)) {
      console.error(
        `STALE: ${fam.name}/${entry} is generator-stamped but no longer emitted (delete it or restore the generator)`,
      );
      drift++;
    }
  }
  return { drift, count: files.size };
}

async function main() {
  const args = process.argv.slice(2);

  const famIdx = args.indexOf("--family");
  const familyName = famIdx >= 0 ? args[famIdx + 1] : undefined;
  const families = selectFamilies(familyName);

  if (args.includes("--check")) {
    let totalDrift = 0;
    let totalCount = 0;
    for (const fam of families) {
      const { drift, count } = await checkFamily(fam);
      totalDrift += drift;
      totalCount += count;
    }
    if (totalDrift > 0) {
      console.error(
        `\n${totalDrift} file(s) drifted. Run \`npm run generate\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log(
      `OK: all ${totalCount} generated files match the templates (${families.length} ${families.length === 1 ? "family" : "families"}).`,
    );
    return;
  }

  const outIdx = args.indexOf("--out");
  if (outIdx >= 0) {
    // Scratch/reconciliation mode: every selected family lands flat in DIR.
    const outDir = resolve(args[outIdx + 1]);
    let total = 0;
    for (const fam of families) total += await writeFamily(fam, outDir);
    console.log(`Generated ${total} files into ${outDir}`);
    return;
  }

  let total = 0;
  for (const fam of families) {
    total += await writeFamily(fam, familyDir(fam));
  }
  console.log(
    `Generated ${total} files across ${families.length} ${families.length === 1 ? "family" : "families"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
