export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface AccessibilityElement {
  ref: string;          // e.g. "e6" from _snapshotForAI
  role: string;         // "button", "link", "textbox", etc.
  name: string;         // Accessible name
  value?: string;       // Current value (for inputs)
  description?: string;
  level?: number;       // Heading level
  checked?: boolean | "mixed";
  disabled?: boolean;
  url?: string;         // For links
}

export interface BrowserConfig {
  headless: boolean;
  viewport: ViewportConfig;
  screenshotQuality?: number;
  actionDelay?: number;
}
