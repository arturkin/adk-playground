import fs from "fs";
import path from "path";
import { FailureLesson } from "../types/lessons.js";
import { config } from "../config/index.js";

/**
 * Handles persistence of failure lessons to the file system.
 */
export class LessonStore {
  private lessonsDir: string;
  private lessonsFile: string;

  constructor(lessonsDir: string = config.lessonsDir) {
    this.lessonsDir = path.resolve(process.cwd(), lessonsDir);
    this.lessonsFile = path.join(this.lessonsDir, "lessons.json");
    this.ensureDir(this.lessonsDir);
  }

  /**
   * Returns active (unresolved) lessons for a specific test.
   */
  public getActiveLessons(testId: string): FailureLesson[] {
    const allLessons = this.getAllLessons();
    return allLessons
      .filter((lesson) => lesson.testId === testId && !lesson.resolved)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 3); // Return max 3 most recent
  }

  /**
   * Returns the consecutive failure count for a specific test.
   */
  public getConsecutiveFailureCount(testId: string): number {
    const lessons = this.getAllLessons()
      .filter((lesson) => lesson.testId === testId && !lesson.resolved)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

    if (lessons.length === 0) return 0;
    return lessons[0].consecutiveFailures;
  }

  /**
   * Adds a new failure lesson.
   */
  public addLesson(lesson: FailureLesson): void {
    const allLessons = this.getAllLessons();
    allLessons.push(lesson);
    this.saveLessons(allLessons);
  }

  /**
   * Marks all lessons for a test as resolved (test passed).
   */
  public markResolved(testId: string): void {
    const allLessons = this.getAllLessons();
    let updated = false;

    for (const lesson of allLessons) {
      if (lesson.testId === testId && !lesson.resolved) {
        lesson.resolved = true;
        updated = true;
      }
    }

    if (updated) {
      this.saveLessons(allLessons);
    }
  }

  /**
   * Returns all stored lessons.
   */
  public getAllLessons(): FailureLesson[] {
    if (!fs.existsSync(this.lessonsFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.lessonsFile, "utf-8");
      return JSON.parse(data) as FailureLesson[];
    } catch (e) {
      console.error("Failed to load lessons:", e);
      return [];
    }
  }

  /**
   * Saves lessons to disk.
   */
  private saveLessons(lessons: FailureLesson[]): void {
    fs.writeFileSync(this.lessonsFile, JSON.stringify(lessons, null, 2));
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const lessonStore = new LessonStore();
