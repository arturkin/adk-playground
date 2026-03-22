import fs from "fs";
import path from "path";
import { TestCase } from "../types/test.js";
import { FailureLesson, TestCorrection } from "../types/lessons.js";
import { LESSONS_DIR, CORRECTION_THRESHOLD } from "../constants.js";
import { log } from "../logger/index.js";

/**
 * Manages test definition corrections based on repeated failures.
 */
export class TestCorrectionManager {
  private correctionsFile: string;

  constructor(lessonsDir: string = LESSONS_DIR) {
    const dir = path.resolve(process.cwd(), lessonsDir);
    this.correctionsFile = path.join(dir, "corrections.json");
    this.ensureDir(dir);
  }

  /**
   * Analyzes failure lessons and generates correction suggestions.
   */
  public analyzeForCorrections(
    testCase: TestCase,
    lessons: FailureLesson[],
  ): TestCorrection[] {
    if (lessons.length === 0) return [];

    const consecutiveFailures = lessons[0].consecutiveFailures;
    if (consecutiveFailures < CORRECTION_THRESHOLD) return [];

    const corrections: TestCorrection[] = [];

    // Check for repeated assertion failures
    const assertionFailures = lessons.filter(
      (l) => l.failureCategory === "assertion_mismatch",
    );
    if (assertionFailures.length >= CORRECTION_THRESHOLD) {
      corrections.push({
        testId: testCase.id,
        filePath: testCase.id, // testId is the file path
        timestamp: new Date().toISOString(),
        correctionType: "update_assertion",
        description: `Assertion(s) have failed ${assertionFailures.length} consecutive times. Review and update assertion expectations to match actual page behavior.`,
        section: "assertions",
        originalContent: testCase.assertions
          .map((a) => a.description)
          .join(", "),
        suggestedContent:
          "(Manual review required - check validation evidence)",
        applied: false,
      });
    }

    // Check for test definition issues
    const definitionIssues = lessons.filter(
      (l) => l.failureCategory === "test_definition_issue",
    );
    if (definitionIssues.length >= CORRECTION_THRESHOLD) {
      corrections.push({
        testId: testCase.id,
        filePath: testCase.id,
        timestamp: new Date().toISOString(),
        correctionType: "update_step",
        description: `Test definition issues detected ${definitionIssues.length} consecutive times. Steps may be incomplete or unclear.`,
        section: "steps",
        originalContent: testCase.steps.map((s) => s.instruction).join(" | "),
        suggestedContent:
          "(Manual review required - check test steps for clarity)",
        applied: false,
      });
    }

    // Check for repeated navigation errors
    const navErrors = lessons.filter(
      (l) => l.failureCategory === "navigation_error",
    );
    if (navErrors.length >= CORRECTION_THRESHOLD) {
      corrections.push({
        testId: testCase.id,
        filePath: testCase.id,
        timestamp: new Date().toISOString(),
        correctionType: "update_url",
        description: `Navigation failed ${navErrors.length} consecutive times. The target URL may be incorrect or inaccessible.`,
        section: "metadata",
        originalContent: testCase.url,
        suggestedContent: "(Verify URL is correct and accessible)",
        applied: false,
      });
    }

    // Save new corrections
    if (corrections.length > 0) {
      this.saveCorrections(corrections);
    }

    return corrections;
  }

  /**
   * Applies a correction to the test file (creates .bak backup).
   */
  public applyCorrection(correction: TestCorrection): void {
    const testFilePath = path.resolve(process.cwd(), correction.filePath);

    if (!fs.existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }

    // Create backup
    const backupPath = `${testFilePath}.bak`;
    fs.copyFileSync(testFilePath, backupPath);
    log.info(`[Backup] Created ${backupPath}`);

    // Read test file (reserved for future section-specific replacement)
    fs.readFileSync(testFilePath, "utf-8");

    // Apply correction based on section
    // Note: This is a simplified implementation. Real implementation would need
    // to parse the markdown test file format and replace specific sections.
    // For now, we just log the suggestion.
    log.info(`[Correction] Would replace in ${correction.section}:`);
    log.info(`  From: ${correction.originalContent.substring(0, 100)}...`);
    log.info(`  To: ${correction.suggestedContent.substring(0, 100)}...`);

    // Mark as applied
    const allCorrections = this.getAllCorrections();
    const updated = allCorrections.find(
      (c) =>
        c.testId === correction.testId && c.timestamp === correction.timestamp,
    );
    if (updated) {
      updated.applied = true;
      this.saveAllCorrections(allCorrections);
    }
  }

  /**
   * Returns pending (unapplied) corrections for a test.
   */
  public getPendingCorrections(testId: string): TestCorrection[] {
    return this.getAllCorrections().filter(
      (c) => c.testId === testId && !c.applied,
    );
  }

  /**
   * Returns all stored corrections.
   */
  public getAllCorrections(): TestCorrection[] {
    if (!fs.existsSync(this.correctionsFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.correctionsFile, "utf-8");
      return JSON.parse(data) as TestCorrection[];
    } catch (e) {
      log.error(
        `Failed to load corrections: ${e instanceof Error ? e.message : String(e)}`,
      );
      return [];
    }
  }

  /**
   * Saves new corrections (appends to existing).
   */
  private saveCorrections(corrections: TestCorrection[]): void {
    const existing = this.getAllCorrections();
    const updated = [...existing, ...corrections];
    this.saveAllCorrections(updated);
  }

  /**
   * Saves all corrections to disk.
   */
  private saveAllCorrections(corrections: TestCorrection[]): void {
    fs.writeFileSync(
      this.correctionsFile,
      JSON.stringify(corrections, null, 2),
    );
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const testCorrectionManager = new TestCorrectionManager();
