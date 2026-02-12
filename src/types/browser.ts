export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface ElementMetadata {
  id: number;
  tagName: string;
  text: string;
  role?: string;
}

export interface BrowserConfig {
  headless: boolean;
  viewport: ViewportConfig;
  screenshotQuality?: number;
  actionDelay?: number;
}
