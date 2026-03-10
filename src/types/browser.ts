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

export interface TextNodeMetadata {
  id: string;       // "T1", "T2", etc. — distinct namespace from interactive IDs
  tagName: string;  // "h1", "label", "p", "span", etc.
  text: string;     // Truncated to 120 chars
  role?: string;    // aria role if present
  forElement?: string; // For label[for], the "for" attribute value
}

export interface BrowserConfig {
  headless: boolean;
  viewport: ViewportConfig;
  screenshotQuality?: number;
  actionDelay?: number;
}
