import fs from "fs";
import path from "path";
import { TestRunResult } from "../types/report.js";
import { REPORT_DIR, MAX_RUNS_TO_KEEP } from "../constants.js";

/**
 * Handles writing reports to the file system.
 */
export class ReportWriter {
  private reportDir: string;

  constructor(reportDir: string = REPORT_DIR) {
    this.reportDir = path.resolve(process.cwd(), reportDir);
    this.ensureDir(this.reportDir);
  }

  /**
   * Writes a Markdown report to the reports directory.
   */
  public writeMarkdownReport(content: string, runId: string): string {
    const filename = `report_${runId}.md`;
    const filePath = path.join(this.reportDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Writes a JSON report to the reports directory.
   */
  public writeJsonReport(result: TestRunResult): string {
    const filename = `report_${result.runId}.json`;
    const filePath = path.join(this.reportDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    this.pruneOldReports(MAX_RUNS_TO_KEEP);
    return filePath;
  }

  /**
   * Removes old report pairs (json + md), keeping only the most recent N.
   */
  private pruneOldReports(keepCount: number): void {
    const jsonFiles = fs
      .readdirSync(this.reportDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    if (jsonFiles.length <= keepCount) return;

    const toRemove = jsonFiles.slice(0, jsonFiles.length - keepCount);
    for (const jsonFile of toRemove) {
      const mdFile = jsonFile.replace(/\.json$/, ".md");
      fs.unlinkSync(path.join(this.reportDir, jsonFile));
      const mdPath = path.join(this.reportDir, mdFile);
      if (fs.existsSync(mdPath)) {
        fs.unlinkSync(mdPath);
      }
    }
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const reportWriter = new ReportWriter();
