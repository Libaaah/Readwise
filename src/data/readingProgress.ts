import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export type ReadingActivity = { id: string; title: string; passage: string };
export type WordDifference = { expected: string; heard?: string };
export type ReadingProgress = { activityId: string; activityTitle: string; student: string; completed: boolean; accuracy: number | null; expectedWords: number; matchedWords: number; date: string; transcript: string; differences: WordDifference[] };

export const readingActivities: ReadingActivity[] = [
  { id: "little-bird", title: "The Little Bird", passage: "The little bird woke up early in the morning. It flew from its nest and searched for food." },
  { id: "day-at-school", title: "A Day at School", passage: "Maya packed her books and walked to school. She read a story with her friends and learned something new." },
];

type ProgressState = { items: ReadingProgress[]; available: boolean; loading: boolean };
const emptyState: ProgressState = { items: [], available: true, loading: false };
const cache = new Map<string, ProgressState>();
const keyFor = (userId?: string | null) => userId ?? "";
const current = (userId?: string | null) => cache.get(keyFor(userId)) ?? emptyState;

export function useReadingProgress(userId?: string | null) {
  const [state, setState] = useState<ProgressState>(() => current(userId));
  useEffect(() => {
    if (!userId) { setState(emptyState); return; }
    setState({ ...current(userId), loading: true });
    return onSnapshot(collection(db, "users", userId, "readingActivities"), (snapshot) => {
      const next = { items: snapshot.docs.map((entry) => ({ activityId: entry.id, ...(entry.data() as Omit<ReadingProgress, "activityId">) })), available: true, loading: false };
      cache.set(userId, next);
      setState(next);
    }, () => {
      const next = { ...current(userId), available: false, loading: false };
      cache.set(userId, next);
      setState(next);
    });
  }, [userId]);
  return state;
}

export async function saveReadingProgress(progress: ReadingProgress, userId?: string | null) {
  if (!userId) return false;
  const state = current(userId);
  cache.set(userId, { ...state, items: [progress, ...state.items.filter((item) => item.activityId !== progress.activityId)] });
  try { await setDoc(doc(db, "users", userId, "readingActivities", progress.activityId), progress); return true; } catch { return false; }
}

export function compareReading(expectedText: string, transcript: string): { expectedWords: number; matchedWords: number; differences: WordDifference[]; accuracy: number } {
  const expected = expectedText.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const heard = transcript.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const costs = Array.from({ length: expected.length + 1 }, () => Array<number>(heard.length + 1).fill(0));
  for (let i = 1; i <= expected.length; i += 1) costs[i][0] = i;
  for (let j = 1; j <= heard.length; j += 1) costs[0][j] = j;
  for (let i = 1; i <= expected.length; i += 1) for (let j = 1; j <= heard.length; j += 1) costs[i][j] = Math.min(costs[i - 1][j] + 1, costs[i][j - 1] + 1, costs[i - 1][j - 1] + (normalizeWord(expected[i - 1]) === normalizeWord(heard[j - 1]) ? 0 : 1));
  let i = expected.length;
  let j = heard.length;
  let matchedWords = 0;
  const differences: WordDifference[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalizeWord(expected[i - 1]) === normalizeWord(heard[j - 1]) && costs[i][j] === costs[i - 1][j - 1]) { matchedWords += 1; i -= 1; j -= 1; }
    else if (i > 0 && j > 0 && costs[i][j] === costs[i - 1][j - 1] + 1) { differences.unshift({ expected: expected[i - 1], heard: heard[j - 1] }); i -= 1; j -= 1; }
    else if (i > 0 && costs[i][j] === costs[i - 1][j] + 1) { differences.unshift({ expected: expected[i - 1] }); i -= 1; }
    else j -= 1;
  }
  return { expectedWords: expected.length, matchedWords, differences, accuracy: expected.length ? Math.round((matchedWords / expected.length) * 100) : 0 };
}

function normalizeWord(word: string) { return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, ""); }
