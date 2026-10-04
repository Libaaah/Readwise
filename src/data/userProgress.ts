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

export type UserAssessmentAttempt = {
  id: string;
  lessonId: string;
  assessment: Assessment;
  attemptedAt: string;
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

export function useUserAssessmentAttempts(userId?: string | null) {
  const [state, setState] = useState<{ attempts: UserAssessmentAttempt[]; available: boolean; loading: boolean }>({
    attempts: [],
    available: true,
    loading: Boolean(userId),
  });
  useEffect(() => {
    if (!userId) {
      setState({ attempts: [], available: true, loading: false });
      return;
    }
    setState((currentState) => ({ ...currentState, loading: true }));
    return onSnapshot(collection(db, "users", userId, "assessmentAttempts"), (snapshot) => {
      const attempts = snapshot.docs.map((entry) => {
        const data = entry.data() as Omit<UserAssessmentAttempt, "id">;
        return { ...data, id: entry.id, assessment: normalize({ lessonId: data.lessonId, assessment: data.assessment } as UserLessonProgress).assessment! };
      }).sort((left, right) => left.attemptedAt.localeCompare(right.attemptedAt));
      setState({ attempts, available: true, loading: false });
    }, (error) => {
      console.error("Could not load reading assessment attempts.", error);
      setState((currentState) => ({ ...currentState, available: false, loading: false }));
    });
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

export async function completeUserLesson(userId: string | null | undefined, lesson: Lesson, secondsRead: number, metrics?: ReadingMetrics, kind: Assessment["kind"] = "lesson") {
  if (!userId) return null;
  const measured = metrics ?? analyzeLesson(lesson, "", secondsRead, "manual");
  const skippedWords = measured.errors.filter((error) => error.type === "skipped").length;
  const progressPercent = measured.expectedWords ? Math.round(((measured.expectedWords - skippedWords) / measured.expectedWords) * 100) : 0;
  const completed = progressPercent === 100;
  const attemptedAt = new Date().toISOString();
  const existing = loadUserLessonProgress(userId).items.find((item) => item.lessonId === lesson.id);
  const attemptCollection = collection(db, "users", userId, "assessmentAttempts");
  const attemptRef = doc(attemptCollection);
  const assessment: Assessment = { id: `a-${attemptRef.id}`, lessonId: lesson.id, lesson: lesson.title, date: new Date(attemptedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), duration: `${Math.floor(secondsRead / 60)}m ${secondsRead % 60}s`, wordsRead: measured.spokenWords, overall: measured.accuracy, accuracy: measured.accuracy, wcpm: measured.wcpm, pronunciation: measured.pronunciation, fluency: measured.fluency, readingLevel: measured.readingLevel, transcript: measured.transcript, errors: measured.errors, recommendations: measured.recommendations, source: measured.source, kind };
  const startedAt = existing?.startedAt ?? attemptedAt;
  const progress: UserLessonProgress = { lessonId: lesson.id, progress: progressPercent, status: completed ? "Completed" : "In Progress", startedAt, ...(completed ? { completedAt: attemptedAt } : {}), secondsRead, assessment, audioStored: false };
  replaceCachedProgress(userId, progress);
  updateCache(userId, { ...current(userId), syncing: true });
  const writes = [
    setDoc(attemptRef, { lessonId: lesson.id, assessment, attemptedAt } satisfies Omit<UserAssessmentAttempt, "id">),
    setDoc(doc(db, "users", userId, "lessonProgress", lesson.id), progress),
  ];
  if (existing?.assessment?.id === `a-${lesson.id}`) {
    const legacyAttempt: UserAssessmentAttempt = {
      id: `legacy-${lesson.id}`,
      lessonId: lesson.id,
      assessment: existing.assessment,
      attemptedAt: existing.completedAt ?? existing.startedAt ?? attemptedAt,
    };
    writes.push(setDoc(doc(db, "users", userId, "assessmentAttempts", legacyAttempt.id), {
      lessonId: legacyAttempt.lessonId,
      assessment: legacyAttempt.assessment,
      attemptedAt: legacyAttempt.attemptedAt,
    }));
  }
  try {
    await Promise.all(writes);
    updateCache(userId, { ...current(userId), syncing: false });
    return progress;
  } catch (error) {
    console.error("Could not save the student's lesson assessment and attempt history.", error);
    updateCache(userId, { ...current(userId), available: false, syncing: false });
    return null;
  }
}

export function lessonsForUser(userId?: string | null) {
  const progress = loadUserLessonProgress(userId).items;
  return lessons.map((lesson) => { const userProgress = progress.find((item) => item.lessonId === lesson.id); return { ...lesson, progress: userProgress?.progress ?? 0, status: userProgress?.status ?? "Not Started" }; });
}

export function userProgressStats(userId?: string | null) {
  const progress = loadUserLessonProgress(userId).items;
  const completed = progress.filter((item) => item.status === "Completed");
  const inProgress = progress.filter((item) => item.status === "In Progress");
  const assessed = progress.filter((item) => item.assessment);
  const latest = [...assessed].sort((a, b) => (b.completedAt ?? b.startedAt ?? "").localeCompare(a.completedAt ?? a.startedAt ?? ""))[0];
  const averageAccuracy = assessed.length ? Math.round(assessed.reduce((total, item) => total + item.assessment!.accuracy, 0) / assessed.length) : 0;
  const averageWcpm = assessed.length ? Math.round(assessed.reduce((total, item) => total + item.assessment!.wcpm, 0) / assessed.length) : 0;
  const overallProgress = lessons.length ? Math.round(progress.reduce((total, item) => total + item.progress, 0) / lessons.length) : 0;
  return { completedCount: completed.length, inProgressCount: inProgress.length, totalLessons: lessons.length, latest, averageAccuracy, averageWcpm, overallProgress };
}

export function userAssessmentHistory(userId?: string | null) {
  return loadUserLessonProgress(userId).items.filter((item) => item.status === "Completed" && item.assessment).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).map((item) => item.assessment!);
}
