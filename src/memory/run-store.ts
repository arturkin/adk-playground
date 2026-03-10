import fs from "fs";
import path from "path";
import { TestRunResult } from "../types/report.js";
import { config } from "../config/index.js";

/**
 * Handles persistence of test run results to the file system.
 */
export class RunStore {
  private historyDir: string;

  constructor(historyDir: string = config.runHistoryDir) {
    this.historyDir = path.resolve(process.cwd(), historyDir);
    this.ensureDir(this.historyDir);
  }

  /**
   * Saves a test run result to the history directory.
   */
  public saveRun(result: TestRunResult): string {
    const timestamp = result.timestamp.replace(/[:.]/g, "-");
    const filename = `${timestamp}_${result.runId}.json`;
    const filePath = path.join(this.historyDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

    // Maintain latest.json symlink (or just a copy)
    const latestPath = path.join(this.historyDir, "latest.json");
    fs.writeFileSync(latestPath, JSON.stringify(result, null, 2));

    return filePath;
  }

  /**
   * Saves a screenshot to the history directory.
   */
  public saveScreenshot(
    runId: string,
    filename: string,
    base64Data: string,
  ): string {
    const screenshotsDir = path.join(this.historyDir, "screenshots", runId);
    this.ensureDir(screenshotsDir);
    const filePath = path.join(screenshotsDir, filename);

    // Remove data:image/png;base64, prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * Returns the latest test run result, if available.
   */
  public getLatestRun(): TestRunResult | null {
    const latestPath = path.join(this.historyDir, "latest.json");
    if (!fs.existsSync(latestPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(latestPath, "utf-8");
      return JSON.parse(data) as TestRunResult;
    } catch (e) {
      console.error("Failed to load latest run:", e);
      return null;
    }
  }

  /**
   * Returns all stored test runs, sorted by timestamp descending.
   */
  public listRuns(): TestRunResult[] {
    if (!fs.existsSync(this.historyDir)) return [];

    const files = fs
      .readdirSync(this.historyDir)
      .filter((f) => f.endsWith(".json") && f !== "latest.json")
      .sort()
      .reverse();

    return files.map((f) => {
      const data = fs.readFileSync(path.join(this.historyDir, f), "utf-8");
      return JSON.parse(data) as TestRunResult;
    });
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const runStore = new RunStore();
