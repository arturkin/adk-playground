import type { LogEntry, LogTransport } from "../types.js";
import type { LogLevel } from "../types.js";

// GCP severity mapping
const SEVERITY_MAP: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
};

interface GcpLogEntry {
  severity: string;
  jsonPayload: Record<string, unknown>;
  labels: Record<string, string>;
  timestamp: string;
}

interface GcpCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export class GcpTransport implements LogTransport {
  private projectId: string;
  private credentials: GcpCredentials;
  private logName: string;
  private buffer: GcpLogEntry[] = [];
  private labels: Record<string, string>;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(projectId: string, saKeyBase64: string) {
    this.projectId = projectId;
    this.logName = `projects/${projectId}/logs/adk-qa`;

    const decoded = atob(saKeyBase64);
    const parsed = JSON.parse(decoded);
    this.credentials = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri ?? "https://oauth2.googleapis.com/token",
    };

    this.labels = {
      env: process.env["CI"] === "true" ? "ci" : "local",
      branch: process.env["GITHUB_REF_NAME"] ?? "unknown",
      commit: process.env["GITHUB_SHA"]?.substring(0, 7) ?? "unknown",
      runId: process.env["GITHUB_RUN_ID"] ?? "local",
    };
  }

  write(entry: LogEntry): void {
    this.buffer.push({
      severity: SEVERITY_MAP[entry.level],
      jsonPayload: {
        message: entry.message,
        ...entry.context,
      },
      labels: this.labels,
      timestamp: entry.timestamp,
    });

    // Auto-flush every 50 entries
    if (this.buffer.length >= 50) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const token = await this.getAccessToken();
      const url = `https://logging.googleapis.com/v2/entries:write`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logName: this.logName,
          resource: {
            type: "global",
            labels: { project_id: this.projectId },
          },
          entries: entries.map((e) => ({
            severity: e.severity,
            jsonPayload: e.jsonPayload,
            labels: e.labels,
            timestamp: e.timestamp,
          })),
        }),
      });

      if (!response.ok) {
        // Log to stderr but don't throw — logging should never break the app
        console.error(
          `[GCP Logger] Failed to write logs: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      console.error(
        `[GCP Logger] Failed to flush: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        iss: this.credentials.client_email,
        scope: "https://www.googleapis.com/auth/logging.write",
        aud: this.credentials.token_uri,
        iat: now,
        exp: now + 3600,
      }),
    );

    const signInput = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(this.credentials.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signInput),
    );
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = `${signInput}.${sig}`;

    const response = await fetch(this.credentials.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
