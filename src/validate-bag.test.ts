import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("emits production occurrence counts for signed bag values", () => {
  const scratch = mkdtempSync(join(tmpdir(), "mapdb-signed-bag-"));
  try {
    const scenario = join(scratch, "signed-bag.json");
    writeFileSync(scenario, JSON.stringify({
      name: "signed_bag_counts", collection: "HashBag<i32>",
      operations: [
        { op: "add_occurrences", value: -2147483648, count: 3 },
        { op: "add_occurrences", value: -1, count: 2 },
        { op: "add", value: 0 },
        { op: "add_occurrences", value: 7, count: 2 },
      ],
      assertions: {
        size: 8, occurrences_0: 1, occurrences_7: 2,
        "occurrences_-2147483648": 3, "occurrences_-1": 2,
        "occurrences_-2": 0,
      },
    }));
    const result = spawnSync(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("./validate.ts", import.meta.url)), scenario,
    ], { encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const lines = result.stdout.split(/\r?\n/);
    for (const line of ["size: 8", "occurrences_0: 1", "occurrences_7: 2",
      "occurrences_-2147483648: 3", "occurrences_-1: 2", "occurrences_-2: 0"]) {
      expect(lines).toContain(line);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
