import { spawn } from "node:child_process";
import fs from "node:fs";
import { DEFAULT_VIEWPORTS } from "../constants.js";

export interface CodegenResult {
  code: string;
  exitCode: number;
}

export interface CodegenOptions {
  viewport: string;
  outputFile: string;
}

export function resolveViewportSize(preset: string): {
  width: number;
  height: number;
} {
  const found = DEFAULT_VIEWPORTS.find((v) => v.name === preset);
  if (!found) {
    throw new Error(
      `Unknown viewport preset "${preset}". Available: ${DEFAULT_VIEWPORTS.map((v) => v.name).join(", ")}`,
    );
  }
  return { width: found.width, height: found.height };
}

export function runCodegen(
  url: string,
  options: CodegenOptions,
): Promise<CodegenResult> {
  const { width, height } = resolveViewportSize(options.viewport);

  const child = spawn(
    "npx",
    [
      "playwright",
      "codegen",
      url,
      `--viewport-size=${width},${height}`,
      `--output=${options.outputFile}`,
    ],
    { stdio: ["inherit", "pipe", "inherit"] },
  );

  const stdoutChunks: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  const sigintHandler = () => {
    child.kill("SIGTERM");
  };

  process.on("SIGINT", sigintHandler);

  // When the user clicks Stop in Playwright's inspector toolbar, codegen writes
  // the output file but keeps the browser open. Watch for the file to appear and
  // kill the process so the recording ends without requiring a manual browser close.
  const fileWatcher = fs.watchFile(
    options.outputFile,
    { persistent: false, interval: 500 },
    (curr) => {
      if (curr.size > 0) {
        fs.unwatchFile(options.outputFile);
        child.kill("SIGTERM");
      }
    },
  );

  function cleanup() {
    fs.unwatchFile(options.outputFile);
    fileWatcher.unref();
    process.removeListener("SIGINT", sigintHandler);
  }

  return new Promise((resolve, reject) => {
    child.on("error", (err) => {
      cleanup();
      reject(err);
    });

    child.on("close", (code) => {
      cleanup();

      const exitCode = code ?? 0;
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");

      try {
        const fileContents = fs.readFileSync(options.outputFile, "utf-8");
        if (fileContents.trim().length > 0) {
          resolve({ code: fileContents, exitCode });
          return;
        }
      } catch {
        // File doesn't exist or can't be read — fall through to stdout
      }

      if (stdout.trim().length > 0) {
        resolve({ code: stdout.trim(), exitCode });
        return;
      }

      resolve({ code: "", exitCode });
    });
  });
}
