import { FailureLesson } from '../types/lessons.js';

/**
 * Formats failure lessons for injection into the navigator agent's prompt.
 * Returns empty string if no lessons (first run = no-op).
 */
export function formatLessonsForNavigator(lessons: FailureLesson[]): string {
  if (lessons.length === 0) {
    return '';
  }

  const formatted = lessons.map((lesson, index) => {
    const parts: string[] = [];
    parts.push(`### Failure ${index + 1} (Run: ${lesson.runId})`);
    parts.push(`**Reason:** ${lesson.failureReason}`);
    parts.push(`**Category:** ${lesson.failureCategory}`);
    if (lesson.failedStep) {
      parts.push(`**Failed Step:** ${lesson.failedStep}`);
    }
    parts.push(`**What Happened:** ${lesson.analysis}`);
    parts.push(`**What to Try Differently:** ${lesson.advice}`);
    parts.push(''); // blank line between lessons
    return parts.join('\n');
  }).join('\n');

  return `
PREVIOUS FAILURE INSIGHTS:
This test has failed ${lessons[0].consecutiveFailures} consecutive time(s). Learn from these past failures:

${formatted}
IMPORTANT: Apply the advice above to avoid repeating the same mistakes. If the same approach keeps failing, try an alternative strategy.
`;
}

/**
 * Formats failure lessons for injection into the validator agent's prompt.
 * Shorter context for validator awareness.
 */
export function formatLessonsForValidator(lessons: FailureLesson[]): string {
  if (lessons.length === 0) {
    return '';
  }

  const categoryList = lessons
    .map(l => l.failureCategory)
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .join(', ');

  return `
NOTE: This test has failed ${lessons[0].consecutiveFailures} consecutive time(s) with these issue categories: ${categoryList}.
Be extra vigilant when evaluating assertions. If navigation appears incomplete or the page state looks wrong, mark assertions accordingly.
`;
}
