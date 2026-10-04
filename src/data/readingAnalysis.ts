import type { Lesson, ReadingError, ReadingMetrics } from "../types";

function normalizeWord(word: string) {
  return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

function wordsFrom(text: string) {
  return text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recommendationsFor(metrics: Pick<ReadingMetrics, "accuracy" | "wcpm" | "errors">) {
  const recommendations: string[] = [];
  const errorTypes = new Set(metrics.errors.map((error) => error.type));
  if (metrics.accuracy < 80 || errorTypes.has("mispronounced") || errorTypes.has("substituted")) recommendations.push("Practice the highlighted words slowly, then read the passage again.");
  if (errorTypes.has("skipped")) recommendations.push("Use your finger or the word highlight to keep your place and avoid skipped words.");
  if (errorTypes.has("inserted") || errorTypes.has("repeated")) recommendations.push("Pause briefly at punctuation and keep a steady pace between words.");
  if (metrics.wcpm < 70) recommendations.push("Read for a few minutes each day to build smoother reading speed.");
  if (!recommendations.length) recommendations.push("Keep reading aloud every day and try a slightly longer passage next.");
  return recommendations.slice(0, 3);
}

export function analyzeReading(referenceText: string, transcript: string, secondsRead: number, source: ReadingMetrics["source"] = "manual"): ReadingMetrics {
  const expected = wordsFrom(referenceText);
  const heard = wordsFrom(transcript);
  const rows = expected.length + 1;
  const columns = heard.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) costs[row][0] = row;
  for (let column = 0; column < columns; column += 1) costs[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const same = normalizeWord(expected[row - 1]) === normalizeWord(heard[column - 1]);
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + (same ? 0 : 1),
      );
    }
  }

  let row = expected.length;
  let column = heard.length;
  let matchedWords = 0;
  const errors: ReadingError[] = [];
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && normalizeWord(expected[row - 1]) === normalizeWord(heard[column - 1]) && costs[row][column] === costs[row - 1][column - 1]) {
      matchedWords += 1;
      row -= 1;
      column -= 1;
    } else if (row > 0 && column > 0 && costs[row][column] === costs[row - 1][column - 1] + 1) {
      errors.unshift({ type: "substituted", expected: expected[row - 1], heard: heard[column - 1] });
      row -= 1;
      column -= 1;
    } else if (row > 0 && costs[row][column] === costs[row - 1][column] + 1) {
      errors.unshift({ type: "skipped", expected: expected[row - 1] });
      row -= 1;
    } else {
      const repeated = column > 1 && normalizeWord(heard[column - 1]) === normalizeWord(heard[column - 2]);
      errors.unshift({ type: repeated ? "repeated" : "inserted", heard: heard[column - 1] });
      column -= 1;
    }
  }

  const accuracy = expected.length ? clamp((1 - costs[expected.length][heard.length] / expected.length) * 100) : 0;
  const minutes = Math.max(secondsRead / 60, 1 / 60);
  const wcpm = Math.round(matchedWords / minutes);
  const targetWcpm = 120;
  const paceScore = clamp((wcpm / targetWcpm) * 100);
  const pronunciation = accuracy;
  const fluency = clamp(accuracy * 0.7 + paceScore * 0.3);
  const readingLevel = accuracy >= 90 && wcpm >= 110 ? "Level 4" : accuracy >= 80 && wcpm >= 80 ? "Level 3" : accuracy >= 65 ? "Level 2" : "Foundation";
  const metrics: ReadingMetrics = {
    expectedWords: expected.length,
    spokenWords: heard.length,
    matchedWords,
    accuracy,
    wcpm,
    pronunciation,
    fluency,
    readingLevel,
    errors,
    recommendations: [],
    transcript: transcript.trim(),
    source,
  };
  metrics.recommendations = recommendationsFor(metrics);
  return metrics;
}

export function analyzeLesson(lesson: Lesson, transcript: string, secondsRead: number, source: ReadingMetrics["source"] = "manual") {
  return analyzeReading(lesson.passage.join(" "), transcript, secondsRead, source);
}
