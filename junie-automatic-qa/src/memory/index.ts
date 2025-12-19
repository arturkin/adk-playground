import fs from "fs";
import path from "path";

interface MemoryEntry {
  role: "user" | "model" | "tool";
  content: string;
  timestamp: number;
}

const MEMORY_FILE = path.join(
  process.cwd(),
  "memory.json",
);
const MAX_MEMORY_SIZE = 20; // Keep last 20 messages

export class Memory {
  private memory: MemoryEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(MEMORY_FILE)) {
      try {
        const data = fs.readFileSync(MEMORY_FILE, "utf-8");
        this.memory = JSON.parse(data);
      } catch (e) {
        console.error("Failed to load memory", e);
        this.memory = [];
      }
    }
  }

  private save() {
    try {
      // Clean up old memory
      if (this.memory.length > MAX_MEMORY_SIZE) {
        this.memory = this.memory.slice(-MAX_MEMORY_SIZE);
      }
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2));
    } catch (e) {
      console.error("Failed to save memory", e);
    }
  }

  public add(role: "user" | "model" | "tool", content: string) {
    this.memory.push({ role, content, timestamp: Date.now() });
    this.save();
  }

  public getHistory(): MemoryEntry[] {
    return this.memory;
  }

  public clear() {
    this.memory = [];
    this.save();
  }
}

export const memory = new Memory();
