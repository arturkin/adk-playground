import fs from "fs";
import path from "path";
import { TestCase, TestStep, TestAssertion } from "../types/test.js";

/**
 * Parses a markdown test file into a TestCase object.
 */
export function parseTestCase(filePath: string): TestCase {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let title = "";
  let url = "";
  let viewport = "desktop";
  let tags: string[] = [];
  let priority: "low" | "medium" | "high" | "critical" = "medium";
  const steps: TestStep[] = [];
  let expectedOutcome = "";
  const assertions: TestAssertion[] = [];

  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("# ")) {
      title = line.replace("# ", "").trim();
      continue;
    }

    if (line.startsWith("## ")) {
      currentSection = line.replace("## ", "").trim().toLowerCase();
      continue;
    }

    if (currentSection === "metadata") {
      if (line.startsWith("- **url**:")) {
        url = line.replace("- **url**:", "").trim();
      } else if (line.startsWith("- **viewport**:")) {
        viewport = line.replace("- **viewport**:", "").trim();
      } else if (line.startsWith("- **tags**:")) {
        tags = line
          .replace("- **tags**:", "")
          .split(",")
          .map((t) => t.trim());
      } else if (line.startsWith("- **priority**:")) {
        const p = line.replace("- **priority**:", "").trim().toLowerCase();
        if (["low", "medium", "high", "critical"].includes(p)) {
          priority = p as "low" | "medium" | "high" | "critical";
        }
      }
    } else if (currentSection === "steps") {
      const stepMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (stepMatch) {
        steps.push({
          index: parseInt(stepMatch[1], 10),
          instruction: stepMatch[2].trim(),
        });
      } else if (steps.length > 0) {
        // Check for indented assertion checkboxes under the current step
        const rawLine = lines[i];
        const stepAssertionMatch = rawLine.match(
          /^\s+-\s+\[\s*([x ]?)\s*\]\s+(.*)$/,
        );
        if (stepAssertionMatch) {
          const currentStep = steps[steps.length - 1];
          if (!currentStep.assertions) {
            currentStep.assertions = [];
          }
          currentStep.assertions.push({
            description: stepAssertionMatch[2].trim(),
            passed: stepAssertionMatch[1].toLowerCase() === "x",
          });
        }
      }
    } else if (currentSection === "expected outcome") {
      if (line) {
        expectedOutcome += (expectedOutcome ? "\n" : "") + line;
      }
    } else if (currentSection === "assertions") {
      const assertionMatch = line.match(/^-\s+\[\s*([x ]?)\s*\]\s+(.*)$/);
      if (assertionMatch) {
        assertions.push({
          description: assertionMatch[2].trim(),
          passed: assertionMatch[1].toLowerCase() === "x",
        });
      }
    }
  }

  return {
    id: path.relative(process.cwd(), filePath),
    title,
    filePath,
    url,
    viewport,
    tags,
    priority,
    steps,
    expectedOutcome,
    assertions,
  };
}
