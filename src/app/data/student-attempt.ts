import { normalizeLevel, type FlashcardLevel } from "./flashcard";

const STUDENT_NAME_KEY = "student-name-v1";
const DEVICE_ID_KEY = "student-device-id-v1";
const ATTEMPT_UPLOAD_QUEUE_KEY = "attempt-upload-queue-v1";

export type StudentAttempt = {
  studentName: string;
  level: FlashcardLevel;
  score: number;
  total: number;
  masteryPercent: number;
  passed: boolean;
  completedAt: number;
  deviceId: string;
};

function getSafeWindow(): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
}

function trimStudentName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : "Unknown Student";
}

function generateDeviceId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getStudentName(): string {
  const safeWindow = getSafeWindow();
  if (!safeWindow) {
    return "";
  }

  const saved = safeWindow.localStorage.getItem(STUDENT_NAME_KEY) ?? "";
  return saved;
}

export function setStudentName(value: string): string {
  const safeWindow = getSafeWindow();
  const normalized = trimStudentName(value);

  if (!safeWindow) {
    return normalized;
  }

  safeWindow.localStorage.setItem(STUDENT_NAME_KEY, normalized);
  return normalized;
}

export function getDeviceId(): string {
  const safeWindow = getSafeWindow();
  if (!safeWindow) {
    return "server-device";
  }

  const existing = safeWindow.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateDeviceId();
  safeWindow.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function readUploadQueue(): StudentAttempt[] {
  const safeWindow = getSafeWindow();
  if (!safeWindow) {
    return [];
  }

  try {
    const raw = safeWindow.localStorage.getItem(ATTEMPT_UPLOAD_QUEUE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => sanitizeAttempt(item))
      .filter((item): item is StudentAttempt => item !== null);
  } catch {
    return [];
  }
}

function writeUploadQueue(queue: StudentAttempt[]): void {
  const safeWindow = getSafeWindow();
  if (!safeWindow) {
    return;
  }

  safeWindow.localStorage.setItem(
    ATTEMPT_UPLOAD_QUEUE_KEY,
    JSON.stringify(queue),
  );
}

function sanitizeAttempt(input: unknown): StudentAttempt | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<StudentAttempt> & {
    level?: string;
  };

  if (
    candidate.level !== "easy" &&
    candidate.level !== "medium" &&
    candidate.level !== "hard"
  ) {
    return null;
  }

  const normalizedLevel = normalizeLevel(candidate.level);
  const score = Number.isFinite(candidate.score)
    ? Math.max(0, Math.floor(candidate.score ?? 0))
    : 0;
  const total = Number.isFinite(candidate.total)
    ? Math.max(0, Math.floor(candidate.total ?? 0))
    : 0;
  const masteryPercent =
    Number.isFinite(candidate.masteryPercent) &&
    typeof candidate.masteryPercent === "number"
      ? Math.max(0, Math.min(100, Math.round(candidate.masteryPercent)))
      : total > 0
        ? Math.round((score / total) * 100)
        : 0;
  const completedAt =
    typeof candidate.completedAt === "number" &&
    Number.isFinite(candidate.completedAt)
      ? candidate.completedAt
      : Date.now();
  const passed = Boolean(candidate.passed);

  return {
    studentName: trimStudentName(candidate.studentName ?? ""),
    level: normalizedLevel,
    score,
    total,
    masteryPercent,
    passed,
    completedAt,
    deviceId:
      typeof candidate.deviceId === "string" && candidate.deviceId.length > 0
        ? candidate.deviceId
        : getDeviceId(),
  };
}

export function queueStudentAttempt(
  attempt: Omit<StudentAttempt, "deviceId">,
): StudentAttempt {
  const normalized: StudentAttempt = {
    ...attempt,
    studentName: trimStudentName(attempt.studentName),
    level: normalizeLevel(attempt.level),
    score: Math.max(0, Math.floor(attempt.score)),
    total: Math.max(0, Math.floor(attempt.total)),
    masteryPercent: Math.max(
      0,
      Math.min(100, Math.round(attempt.masteryPercent)),
    ),
    passed: Boolean(attempt.passed),
    completedAt: Number.isFinite(attempt.completedAt)
      ? attempt.completedAt
      : Date.now(),
    deviceId: getDeviceId(),
  };

  const queue = readUploadQueue();
  queue.push(normalized);
  writeUploadQueue(queue);
  return normalized;
}

export function getPendingAttemptCount(): number {
  return readUploadQueue().length;
}

export async function syncPendingAttempts(): Promise<{
  uploaded: number;
  remaining: number;
}> {
  const safeWindow = getSafeWindow();
  if (!safeWindow) {
    return { uploaded: 0, remaining: 0 };
  }

  if (!safeWindow.navigator.onLine) {
    return { uploaded: 0, remaining: readUploadQueue().length };
  }

  const queue = readUploadQueue();
  if (queue.length === 0) {
    return { uploaded: 0, remaining: 0 };
  }

  const remaining: StudentAttempt[] = [];
  let uploaded = 0;

  for (const attempt of queue) {
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attempt),
      });

      if (response.ok) {
        uploaded += 1;
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        continue;
      }

      remaining.push(attempt);
    } catch {
      remaining.push(attempt);
      break;
    }
  }

  writeUploadQueue(remaining);
  return { uploaded, remaining: remaining.length };
}
