export type ReadingActivity = {
  id: string;
  title: string;
  passage: string;
};

export type WordDifference = {
  expected: string;
  heard?: string;
};

export type ReadingProgress = {
  activityId: string;
  activityTitle: string;
  student: string;
  completed: boolean;
  accuracy: number | null;
  expectedWords: number;
  matchedWords: number;
  date: string;
  transcript: string;
  differences: WordDifference[];
};

export const readingActivities: ReadingActivity[] = [
  {
    id: "little-bird",
    title: "The Little Bird",
    passage: "The little bird woke up early in the morning. It flew from its nest and searched for food.",
  },
  {
    id: "day-at-school",
    title: "A Day at School",
    passage: "Maya packed her books and walked to school. She read a story with her friends and learned something new.",
  },
];

const storageKey = "readwise-reading-progress-v1";

export function loadReadingProgress(): { items: ReadingProgress[]; available: boolean } {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { items: [], available: true };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { items: [], available: true };
    return { items: parsed as ReadingProgress[], available: true };
  } catch {
    return { items: [], available: false };
  }
}

export function saveReadingProgress(progress: ReadingProgress): boolean {
  try {
    const current = loadReadingProgress();
    const next = [progress, ...current.items.filter((item) => item.activityId !== progress.activityId)];
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function normalizeWord(word: string): string {
  return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

export function compareReading(expectedText: string, transcript: string): { expectedWords: number; matchedWords: number; differences: WordDifference[]; accuracy: number } {
  const expected = expectedText.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const heard = transcript.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const rows = expected.length + 1;
  const columns = heard.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let i = 0; i < rows; i += 1) costs[i][0] = i;
  for (let j = 0; j < columns; j += 1) costs[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const same = normalizeWord(expected[i - 1]) === normalizeWord(heard[j - 1]);
      costs[i][j] = Math.min(costs[i - 1][j] + 1, costs[i][j - 1] + 1, costs[i - 1][j - 1] + (same ? 0 : 1));
    }
  }

  let i = expected.length;
  let j = heard.length;
  let matchedWords = 0;
  const differences: WordDifference[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalizeWord(expected[i - 1]) === normalizeWord(heard[j - 1]) && costs[i][j] === costs[i - 1][j - 1]) {
      matchedWords += 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && costs[i][j] === costs[i - 1][j - 1] + 1) {
      differences.unshift({ expected: expected[i - 1], heard: heard[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && costs[i][j] === costs[i - 1][j] + 1) {
      differences.unshift({ expected: expected[i - 1] });
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return {
    expectedWords: expected.length,
    matchedWords,
    differences,
    accuracy: expected.length ? Math.round((matchedWords / expected.length) * 100) : 0,
  };
}
