import fs from "fs";
import path from "path";
import { TestRunResult } from "../types/report.js";
import { config } from "../config/index.js";

/**
 * Handles writing reports to the file system.
 */
export class ReportWriter {
  private reportDir: string;

  constructor(reportDir: string = config.reportDir) {
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
    return filePath;
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const reportWriter = new ReportWriter();
