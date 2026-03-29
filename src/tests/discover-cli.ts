/**
 * CLI script for test discovery — used by CI to build a matrix of test files.
 *
 * Usage: bun src/tests/discover-cli.ts [--test-dir <dir>] [--shards <n>]
 *
 * Output (stdout):
 *   Without --shards: JSON array of file paths
 *   With --shards N:  JSON array of N shard specs (e.g. ["1/3","2/3","3/3"])
 */

import { discoverTests } from "./discovery.js";
import { TEST_DIR } from "../constants.js";

function parseArgs(): { testDir: string; shards?: number } {
  const args = process.argv.slice(2);
  let testDir = TEST_DIR;
  let shards: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--test-dir" && args[i + 1]) {
      testDir = args[i + 1];
      i++;
    } else if (args[i] === "--shards" && args[i + 1]) {
      shards = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { testDir, shards };
}

async function main(): Promise<void> {
  const { testDir, shards } = parseArgs();

  const suite = await discoverTests(testDir);
  const filePaths = suite.testCases.map((tc) => tc.filePath);

  if (!shards || shards <= 1) {
    process.stdout.write(JSON.stringify(filePaths) + "\n");
    return;
  }

  // Produce shard specs for a CI matrix: ["1/3","2/3","3/3"]
  const totalShards = Math.min(shards, filePaths.length);
  const shardSpecs: string[] = [];
  for (let i = 1; i <= totalShards; i++) {
    shardSpecs.push(`${i}/${totalShards}`);
  }
  process.stdout.write(JSON.stringify(shardSpecs) + "\n");
}

main();
