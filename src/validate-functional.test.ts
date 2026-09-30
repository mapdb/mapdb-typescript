import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const scenarios = [
  {
    "name": "arraylist_signed_thresholds",
    "collection": "ArrayList<i32>",
    "required_keys": [
      "size",
      "to_sorted_array"
    ],
    "operations": [
      {
        "op": "add",
        "value": -3
      },
      {
        "op": "add",
        "value": -1
      },
      {
        "op": "add",
        "value": 0
      },
      {
        "op": "add",
        "value": 2
      }
    ],
    "assertions": {
      "size": 4,
      "to_sorted_array": [
        -3,
        -1,
        0,
        2
      ],
      "select_gt_-2": [
        -1,
        0,
        2
      ],
      "reject_gt_-2": [
        -3
      ],
      "detect_gt_-2": -1,
      "count_gt_-2": 3,
      "count_lt_-2": 1,
      "any_satisfy_gt_-2": true,
      "all_satisfy_gt_-2": false,
      "none_satisfy_gt_-2": false,
      "none_satisfy_lt_-2": false,
      "all_satisfy_gt_-4": true,
      "none_satisfy_lt_-4": true,
      "count_gt_0": 1,
      "select_gt_0": [
        2
      ]
    }
  },
  {
    "name": "arraylist_empty_signed_thresholds",
    "collection": "ArrayList<i32>",
    "required_keys": [
      "size",
      "to_sorted_array"
    ],
    "operations": [],
    "assertions": {
      "size": 0,
      "to_sorted_array": [],
      "select_gt_-2": [],
      "reject_gt_-2": [],
      "detect_gt_-2": null,
      "count_gt_-2": 0,
      "count_lt_-2": 0,
      "any_satisfy_gt_-2": false,
      "all_satisfy_gt_-2": true,
      "none_satisfy_gt_-2": true,
      "none_satisfy_lt_-2": true
    }
  }
];

it.each(scenarios)("emits signed functional thresholds for $name", (scenario) => {
  const scratch = mkdtempSync(join(tmpdir(), "mapdb-signed-threshold-"));
  try {
    const path = join(scratch, "scenario.json");
    writeFileSync(path, JSON.stringify(scenario));
    const result = spawnSync(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("./validate.ts", import.meta.url)), path,
    ], { encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const emitted = new Map(result.stdout.split(/\r?\n/).filter((line) => line.includes(": "))
      .map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)]));
    for (const [key, value] of Object.entries(scenario.assertions)) {
      expect(emitted.has(key), `${key} must be emitted`).toBe(true);
      expect(JSON.parse(emitted.get(key)!)).toEqual(value);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
