import { type FlashcardLevel } from "./flashcard";

export const PASSING_RATIO = 0.8;
const QUIZ_LEVEL_PROGRESS_KEY = "quiz-level-progress-v1";

export type LevelProgressEntry = {
  attempts: number;
  lastScore: number;
  lastTotal: number;
  bestScore: number;
  bestTotal: number;
  passed: boolean;
  passedAt: number | null;
  updatedAt: number;
};

export type LevelProgressMap = Record<FlashcardLevel, LevelProgressEntry>;

const LEVELS: FlashcardLevel[] = ["easy", "medium", "hard"];

function createDefaultLevelProgressEntry(): LevelProgressEntry {
  return {
    attempts: 0,
    lastScore: 0,
    lastTotal: 0,
    bestScore: 0,
    bestTotal: 0,
    passed: false,
    passedAt: null,
    updatedAt: 0,
  };
}

export function createDefaultLevelProgress(): LevelProgressMap {
  return {
    easy: createDefaultLevelProgressEntry(),
    medium: createDefaultLevelProgressEntry(),
    hard: createDefaultLevelProgressEntry(),
  };
}

export function getRequiredScore(total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.ceil(total * PASSING_RATIO);
}

function sanitizeEntry(input: unknown): LevelProgressEntry {
  const fallback = createDefaultLevelProgressEntry();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const entry = input as Partial<LevelProgressEntry>;

  const attempts =
    typeof entry.attempts === "number" && Number.isFinite(entry.attempts)
      ? Math.max(0, Math.floor(entry.attempts))
      : 0;
  const lastScore =
    typeof entry.lastScore === "number" && Number.isFinite(entry.lastScore)
      ? Math.max(0, Math.floor(entry.lastScore))
      : 0;
  const lastTotal =
    typeof entry.lastTotal === "number" && Number.isFinite(entry.lastTotal)
      ? Math.max(0, Math.floor(entry.lastTotal))
      : 0;
  const bestScore =
    typeof entry.bestScore === "number" && Number.isFinite(entry.bestScore)
      ? Math.max(0, Math.floor(entry.bestScore))
      : 0;
  const bestTotal =
    typeof entry.bestTotal === "number" && Number.isFinite(entry.bestTotal)
      ? Math.max(0, Math.floor(entry.bestTotal))
      : 0;
  const passed = Boolean(entry.passed);
  const passedAt =
    typeof entry.passedAt === "number" && Number.isFinite(entry.passedAt)
      ? entry.passedAt
      : null;
  const updatedAt =
    typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
      ? entry.updatedAt
      : 0;

  return {
    attempts,
    lastScore,
    lastTotal,
    bestScore,
    bestTotal,
    passed,
    passedAt,
    updatedAt,
  };
}

export function readLevelProgress(): LevelProgressMap {
  const fallback = createDefaultLevelProgress();

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(QUIZ_LEVEL_PROGRESS_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<Record<FlashcardLevel, unknown>>;

    return {
      easy: sanitizeEntry(parsed.easy),
      medium: sanitizeEntry(parsed.medium),
      hard: sanitizeEntry(parsed.hard),
    };
  } catch {
    return fallback;
  }
}

export function writeLevelProgress(progress: LevelProgressMap): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    QUIZ_LEVEL_PROGRESS_KEY,
    JSON.stringify(progress),
  );
}

export function isPassed(score: number, total: number): boolean {
  if (total <= 0) {
    return false;
  }

  return score >= getRequiredScore(total);
}

export function isLevelUnlocked(
  progress: LevelProgressMap,
  level: FlashcardLevel,
): boolean {
  if (level === "easy") {
    return true;
  }

  if (level === "medium") {
    return progress.easy.passed;
  }

  return progress.medium.passed;
}

export function getUnlockRequirement(
  level: FlashcardLevel,
): FlashcardLevel | null {
  if (level === "medium") {
    return "easy";
  }

  if (level === "hard") {
    return "medium";
  }

  return null;
}

export function recordLevelAttempt(
  progress: LevelProgressMap,
  level: FlashcardLevel,
  score: number,
  total: number,
): LevelProgressMap {
  const now = Date.now();
  const safeScore = Math.max(0, Math.floor(score));
  const safeTotal = Math.max(0, Math.floor(total));
  const current = progress[level] ?? createDefaultLevelProgressEntry();

  const currentBestRatio =
    current.bestTotal > 0 ? current.bestScore / current.bestTotal : 0;
  const incomingRatio = safeTotal > 0 ? safeScore / safeTotal : 0;
  const shouldUpdateBest =
    safeTotal > 0 &&
    (incomingRatio > currentBestRatio ||
      (incomingRatio === currentBestRatio && safeScore > current.bestScore));

  const passedNow = isPassed(safeScore, safeTotal);

  const nextEntry: LevelProgressEntry = {
    attempts: current.attempts + 1,
    lastScore: safeScore,
    lastTotal: safeTotal,
    bestScore: shouldUpdateBest ? safeScore : current.bestScore,
    bestTotal: shouldUpdateBest ? safeTotal : current.bestTotal,
    passed: current.passed || passedNow,
    passedAt: current.passedAt ?? (passedNow ? now : null),
    updatedAt: now,
  };

  const updated = {
    ...progress,
    [level]: nextEntry,
  };

  for (const item of LEVELS) {
    if (!updated[item]) {
      updated[item] = createDefaultLevelProgressEntry();
    }
  }

  writeLevelProgress(updated);
  return updated;
}
