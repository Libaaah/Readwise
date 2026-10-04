import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { lessons } from "./mockData";
import { analyzeLesson } from "./readingAnalysis";
import type { Assessment, Lesson, ReadingMetrics } from "../types";

export type UserLessonProgress = {
  lessonId: string;
  progress: number;
  status: Lesson["status"];
  startedAt?: string;
  completedAt?: string;
  secondsRead?: number;
  assessment?: Assessment;
  audioStored?: boolean;
};

type ProgressState = { items: UserLessonProgress[]; available: boolean; loading: boolean; syncing: boolean };
const emptyState: ProgressState = { items: [], available: true, loading: false, syncing: false };
const cache = new Map<string, ProgressState>();
const subscribers = new Map<string, Set<(state: ProgressState) => void>>();

function keyFor(userId?: string | null) { return userId ?? ""; }
function current(userId?: string | null) { return cache.get(keyFor(userId)) ?? emptyState; }
function updateCache(userId: string, next: ProgressState) {
  cache.set(userId, next);
  subscribers.get(userId)?.forEach((subscriber) => subscriber(next));
}

function normalize(item: UserLessonProgress): UserLessonProgress {
  if (!item.assessment) return item;
  const assessment = item.assessment;
  return { ...item, assessment: { ...assessment, fluency: assessment.fluency ?? assessment.accuracy, readingLevel: assessment.readingLevel ?? "Level 3", transcript: assessment.transcript ?? "", errors: assessment.errors ?? [], recommendations: assessment.recommendations ?? ["Keep reading aloud every day and try a slightly longer passage next."], source: assessment.source ?? "manual" } };
}

export function useUserLessonProgress(userId?: string | null) {
  const [state, setState] = useState<ProgressState>(() => current(userId));
  useEffect(() => {
    if (!userId) { setState(emptyState); return; }
    setState({ ...current(userId), loading: true });
    const userSubscribers = subscribers.get(userId) ?? new Set<(next: ProgressState) => void>();
    userSubscribers.add(setState);
    subscribers.set(userId, userSubscribers);
    const unsubscribe = onSnapshot(collection(db, "users", userId, "lessonProgress"), { includeMetadataChanges: true }, (snapshot) => {
      const next = { items: snapshot.docs.map((entry) => normalize({ lessonId: entry.id, ...(entry.data() as Omit<UserLessonProgress, "lessonId">) })), available: true, loading: false, syncing: snapshot.metadata.hasPendingWrites };
      updateCache(userId, next);
    }, () => {
      const next = { ...current(userId), available: false, loading: false, syncing: false };
      updateCache(userId, next);
    });
    return () => {
      unsubscribe();
      userSubscribers.delete(setState);
      if (!userSubscribers.size) subscribers.delete(userId);
    };
  }, [userId]);
  return state;
}

export function useUserProgressStatsForUsers(userIds: string[]) {
  const userIdsKey = [...new Set(userIds)].sort().join("\u001f");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ids = userIdsKey ? userIdsKey.split("\u001f") : [];
    const unsubscribes = ids.map((userId) => onSnapshot(collection(db, "users", userId, "lessonProgress"), (snapshot) => {
      const next = {
        items: snapshot.docs.map((entry) => normalize({ lessonId: entry.id, ...(entry.data() as Omit<UserLessonProgress, "lessonId">) })),
        available: true,
        loading: false,
        syncing: snapshot.metadata.hasPendingWrites,
      };
      updateCache(userId, next);
      setRevision((currentRevision) => currentRevision + 1);
    }, () => {
      updateCache(userId, { ...current(userId), available: false, loading: false, syncing: false });
      setRevision((currentRevision) => currentRevision + 1);
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [userIdsKey]);
  return {
    stats: userIds.map((userId) => userProgressStats(userId)),
    available: userIds.every((userId) => current(userId).available),
    revision,
  };
}

export function loadUserLessonProgress(userId?: string | null) { return current(userId); }

function replaceCachedProgress(userId: string, progress: UserLessonProgress) {
  const state = current(userId);
  updateCache(userId, { ...state, items: [progress, ...state.items.filter((item) => item.lessonId !== progress.lessonId)] });
}

export async function saveUserLessonProgress(userId: string | null | undefined, progress: UserLessonProgress) {
  if (!userId) return false;
  replaceCachedProgress(userId, progress);
  updateCache(userId, { ...current(userId), syncing: true });
  try { await setDoc(doc(db, "users", userId, "lessonProgress", progress.lessonId), progress); return true; } catch {
    const state = current(userId);
    updateCache(userId, { ...state, available: false, syncing: false });
    return false;
  }
}

export async function startUserLesson(userId: string | null | undefined, lessonId: string) {
  const existing = loadUserLessonProgress(userId).items.find((item) => item.lessonId === lessonId);
  if (existing?.status === "Completed") return existing;
  const progress: UserLessonProgress = { lessonId, progress: existing?.progress ?? 0, status: "In Progress", startedAt: existing?.startedAt ?? new Date().toISOString() };
  const saved = await saveUserLessonProgress(userId, progress);
  return saved ? progress : null;
}

export function completeUserLesson(userId: string | null | undefined, lesson: Lesson, secondsRead: number, metrics?: ReadingMetrics, kind: Assessment["kind"] = "lesson") {
  if (!userId) return null;
  const measured = metrics ?? analyzeLesson(lesson, "", secondsRead, "manual");
  const skippedWords = measured.errors.filter((error) => error.type === "skipped").length;
  const progressPercent = measured.expectedWords ? Math.round(((measured.expectedWords - skippedWords) / measured.expectedWords) * 100) : 0;
  const completed = progressPercent === 100;
  const assessment: Assessment = { id: `a-${lesson.id}`, lessonId: lesson.id, lesson: lesson.title, date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), duration: `${Math.floor(secondsRead / 60)}m ${secondsRead % 60}s`, wordsRead: measured.spokenWords, overall: measured.accuracy, accuracy: measured.accuracy, wcpm: measured.wcpm, pronunciation: measured.pronunciation, fluency: measured.fluency, readingLevel: measured.readingLevel, transcript: measured.transcript, errors: measured.errors, recommendations: measured.recommendations, source: measured.source, kind };
  const startedAt = loadUserLessonProgress(userId).items.find((item) => item.lessonId === lesson.id)?.startedAt ?? new Date().toISOString();
  const progress: UserLessonProgress = { lessonId: lesson.id, progress: progressPercent, status: completed ? "Completed" : "In Progress", startedAt, ...(completed ? { completedAt: new Date().toISOString() } : {}), secondsRead, assessment, audioStored: false };
  replaceCachedProgress(userId, progress);
  void saveUserLessonProgress(userId, progress);
  return progress;
}

export function lessonsForUser(userId?: string | null) {
  const progress = loadUserLessonProgress(userId).items;
  return lessons.map((lesson) => { const userProgress = progress.find((item) => item.lessonId === lesson.id); return { ...lesson, progress: userProgress?.progress ?? 0, status: userProgress?.status ?? "Not Started" }; });
}

export function userProgressStats(userId?: string | null) {
  const progress = loadUserLessonProgress(userId).items;
  const completed = progress.filter((item) => item.status === "Completed");
  const inProgress = progress.filter((item) => item.status === "In Progress");
  const latest = [...completed].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  const averageAccuracy = completed.length ? Math.round(completed.reduce((total, item) => total + (item.assessment?.accuracy ?? 0), 0) / completed.length) : 0;
  const averageWcpm = completed.length ? Math.round(completed.reduce((total, item) => total + (item.assessment?.wcpm ?? 0), 0) / completed.length) : 0;
  return { completedCount: completed.length, inProgressCount: inProgress.length, totalLessons: lessons.length, latest, averageAccuracy, averageWcpm, overallProgress: lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0 };
}

export function userAssessmentHistory(userId?: string | null) {
  return loadUserLessonProgress(userId).items.filter((item) => item.status === "Completed" && item.assessment).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).map((item) => item.assessment!);
}
