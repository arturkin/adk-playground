import fs from "fs";
import path from "path";

interface MemoryEntry {
  role: "user" | "model" | "tool";
  content: any;
  timestamp: number;
}

const DEFAULT_MEMORY_FILE = "memory.json";
const DEFAULT_MAX_MEMORY_SIZE = 100;

export class Memory {
  private memory: MemoryEntry[] = [];
  private filePath: string;
  private maxMemorySize: number;

  constructor(
    filePath: string = process.env.MEMORY_FILE || DEFAULT_MEMORY_FILE,
    maxMemorySize: number = process.env.MAX_MEMORY_SIZE
      ? parseInt(process.env.MAX_MEMORY_SIZE)
      : DEFAULT_MAX_MEMORY_SIZE,
  ) {
    this.filePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    this.maxMemorySize = maxMemorySize;
    this.load();
  }

  private load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, "utf-8");
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
      if (this.memory.length > this.maxMemorySize) {
        this.memory = this.memory.slice(-this.maxMemorySize);
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2));
    } catch (e) {
      console.error("Failed to save memory", e);
    }
  }

  public add(role: "user" | "model" | "tool", content: any) {
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

  public setFile(filePath: string) {
    this.filePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    this.load(); // Reload from new file
  }
}

export const memory = new Memory();
