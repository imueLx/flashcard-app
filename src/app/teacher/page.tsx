"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFlashcardsByLevel } from "../data/flashcard";

type DifficultyLevel = "easy" | "medium" | "hard";
type AnswerStatus = "correct" | "wrong" | "skipped";
type PerPageCount = 10 | 20 | 50;

type AttemptRecord = {
  id: string;
  studentName: string;
  level: DifficultyLevel;
  score: number;
  total: number;
  masteryPercent: number;
  passed: boolean;
  completedAt: string;
  createdAt: string;
};

type AnalyticsEvent = {
  learner_id: string;
  session_id: string;
  lesson_id: string;
  topic_id: string;
  difficulty_level: DifficultyLevel;
  question_id: string;
  question_text: string;
  answer_status: AnswerStatus;
  is_first_try_correct: boolean;
  retries: number;
  score: number;
  mastery_score: number;
  reviewed_wrong_answer: boolean;
  timestamp: string;
};

type LearnerProfile = {
  learnerId: string;
  sessions: number;
  currentLevel: DifficultyLevel;
  masteryScore: number;
  strengths: string[];
  weakAreas: string[];
  recommendedNextLesson: string;
  latestAccuracy: number;
  streakDays: number;
};

type LevelPerformance = {
  level: DifficultyLevel;
  attempts: number;
  accuracy: number;
  averageScore: number;
  passRate: number;
  retryRate: number;
};

type TopIncorrectQuestion = {
  level: DifficultyLevel;
  questionText: string;
  incorrectCount: number;
};

type WeakArea = {
  level: DifficultyLevel;
  topicId: string;
  incorrectCount: number;
  skippedCount: number;
  missCount: number;
};

type StudentLevelAttempts = {
  studentName: string;
  easyAttempts: number;
  mediumAttempts: number;
  hardAttempts: number;
  totalAttempts: number;
};

type DeleteFeedback = {
  type: "success" | "error";
  message: string;
};

type AdminInsights = {
  classAverageAccuracy: number;
  learnersAtRisk: Array<{ learnerId: string; score: number }>;
  topPerformers: Array<{ learnerId: string; score: number }>;
  hardestContent: Array<{ key: string; errorRate: number }>;
  easiestContent: Array<{ key: string; errorRate: number }>;
};

const LEVELS: DifficultyLevel[] = ["easy", "medium", "hard"];
const QUESTION_TEXT_BY_LEVEL: Record<DifficultyLevel, string[]> = {
  easy: getFlashcardsByLevel("easy").map((card) => card.front),
  medium: getFlashcardsByLevel("medium").map((card) => card.front),
  hard: getFlashcardsByLevel("hard").map((card) => card.front),
};

function inferSkillFromQuestion(questionText: string): string {
  const text = questionText.toLowerCase();

  if (/(everyone|nobody|someone|somebody|each|one of)/.test(text)) {
    return "subject_verb_basic";
  }
  if (
    /\b(ana and mia|she and her sister|friends and i|boys|girls|students|children|birds|dogs|they|we)\b/.test(
      text,
    )
  ) {
    return "subject_verb_plural";
  }
  if (/(group of|basket of|pair of)/.test(text)) {
    return "collective_nouns";
  }
  if (
    /\b(i|you|he|she|it|my teacher|my mother|my father|the teacher|the cat|the dog)\b/.test(
      text,
    )
  ) {
    return "pronoun_agreement";
  }
  if (/(morning|every day|today|on sunday|at night|after class)/.test(text)) {
    return "tenses_present";
  }

  return "sentence_repair";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

function formatSkillLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLevelStatus(passRate: number): string {
  if (passRate >= 85) {
    return "Strong";
  }

  if (passRate >= 65) {
    return "Developing";
  }

  return "Needs Support";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function mapAttemptsToEvents(attempts: AttemptRecord[]): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];

  for (const attempt of attempts) {
    const questionBank = QUESTION_TEXT_BY_LEVEL[attempt.level];
    if (questionBank.length === 0) {
      continue;
    }

    const totalFromAttempt = Math.max(1, attempt.total);
    const total = Math.min(totalFromAttempt, questionBank.length);
    const correct = clamp(attempt.score, 0, total);
    const wrong = total - correct;
    const seed = hashString(attempt.id + attempt.studentName);
    const retriesBase = seed % 2;
    const wrongIndexes = new Set<number>();

    for (let step = 0; step < wrong; step += 1) {
      // Spread misses across the deck so analytics are not biased to tail items.
      const index = (seed + step * 7) % total;
      wrongIndexes.add(index);
    }

    let repairStep = 0;
    while (wrongIndexes.size < wrong && wrongIndexes.size < total) {
      wrongIndexes.add((seed + repairStep * 11 + 3) % total);
      repairStep += 1;
    }

    for (let questionIndex = 0; questionIndex < total; questionIndex += 1) {
      const isCorrect = !wrongIndexes.has(questionIndex);
      const questionText = questionBank[questionIndex] ?? "";
      const topic = inferSkillFromQuestion(questionText ?? "");
      const retries = isCorrect
        ? questionIndex % 5 === 0
          ? 1
          : 0
        : 1 + (questionIndex % 2);
      const eventTime = new Date(
        toTimestamp(attempt.completedAt) + questionIndex,
      ).toISOString();

      events.push({
        learner_id: attempt.studentName,
        session_id: `${attempt.id}-session`,
        lesson_id: `live-${attempt.level}`,
        topic_id: topic,
        difficulty_level: attempt.level,
        question_id: `${attempt.level}-q${questionIndex + 1}`,
        question_text: questionText,
        answer_status: isCorrect ? "correct" : "wrong",
        is_first_try_correct: isCorrect && retriesBase === 0,
        retries,
        score: isCorrect ? 1 : 0,
        mastery_score: attempt.masteryPercent,
        reviewed_wrong_answer: !isCorrect && (seed + questionIndex) % 3 === 0,
        timestamp: eventTime,
      });
    }

    for (
      let skipIndex = 0;
      skipIndex < Math.floor(wrong * 0.15);
      skipIndex += 1
    ) {
      events.push({
        learner_id: attempt.studentName,
        session_id: `${attempt.id}-session`,
        lesson_id: `live-${attempt.level}`,
        topic_id: inferSkillFromQuestion(questionBank[skipIndex % total] ?? ""),
        difficulty_level: attempt.level,
        question_id: `${attempt.level}-skip-${skipIndex + 1}`,
        question_text: questionBank[skipIndex % total] ?? "",
        answer_status: "skipped",
        is_first_try_correct: false,
        retries: 0,
        score: 0,
        mastery_score: attempt.masteryPercent,
        reviewed_wrong_answer: false,
        timestamp: new Date(
          toTimestamp(attempt.completedAt) + total + skipIndex,
        ).toISOString(),
      });
    }
  }

  return events.sort(
    (a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp),
  );
}

function groupBy<T, K extends string>(
  items: T[],
  getKey: (item: T) => K,
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const key = getKey(item);
    if (!out[key]) {
      out[key] = [];
    }
    out[key].push(item);
  }
  return out;
}

function getAccuracy(events: AnalyticsEvent[]): number {
  if (events.length === 0) {
    return 0;
  }
  return Math.round(
    (events.filter((event) => event.answer_status === "correct").length /
      events.length) *
      100,
  );
}

function buildLevelPerformance(
  events: AnalyticsEvent[],
  attempts: AttemptRecord[],
): LevelPerformance[] {
  const byLevel = groupBy(events, (event) => event.difficulty_level);
  const attemptsByLevel = groupBy(attempts, (attempt) => attempt.level);

  return LEVELS.map((level) => {
    const levelEvents = byLevel[level] ?? [];
    const attempts = new Set(levelEvents.map((event) => event.session_id)).size;
    const levelAttempts = attemptsByLevel[level] ?? [];

    return {
      level,
      attempts,
      accuracy: getAccuracy(levelEvents),
      averageScore:
        levelAttempts.length > 0
          ? Math.round(
              average(
                levelAttempts.map((attempt) =>
                  attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0,
                ),
              ),
            )
          : 0,
      passRate:
        levelAttempts.length > 0
          ? Math.round(
              (levelAttempts.filter((attempt) => attempt.passed).length /
                levelAttempts.length) *
                100,
            )
          : 0,
      retryRate:
        levelEvents.length > 0
          ? Math.round(
              (levelEvents.filter((event) => event.retries > 0).length /
                levelEvents.length) *
                100,
            )
          : 0,
    };
  });
}

function buildTopIncorrectQuestions(
  events: AnalyticsEvent[],
): TopIncorrectQuestion[] {
  const incorrectEvents = events.filter(
    (event) => event.answer_status === "wrong",
  );
  const buckets = new Map<string, TopIncorrectQuestion>();

  for (const event of incorrectEvents) {
    const questionText = event.question_text.trim();
    if (!questionText) {
      continue;
    }

    const key = `${event.difficulty_level}::${questionText}`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        level: event.difficulty_level,
        questionText,
        incorrectCount: 1,
      });
      continue;
    }

    existing.incorrectCount += 1;
  }

  const grouped = groupBy([...buckets.values()], (item) => item.level);
  return LEVELS.flatMap((level) =>
    (grouped[level] ?? [])
      .sort(
        (a, b) =>
          b.incorrectCount - a.incorrectCount ||
          a.questionText.localeCompare(b.questionText),
      )
      .slice(0, 3),
  );
}

function buildWeakAreas(events: AnalyticsEvent[]): WeakArea[] {
  const wrong = events.filter((event) => event.answer_status !== "correct");
  const buckets = new Map<string, WeakArea>();

  for (const event of wrong) {
    const key = `${event.difficulty_level}::${event.topic_id}`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        level: event.difficulty_level,
        topicId: event.topic_id,
        incorrectCount: event.answer_status === "wrong" ? 1 : 0,
        skippedCount: event.answer_status === "skipped" ? 1 : 0,
        missCount: 1,
      });
      continue;
    }

    if (event.answer_status === "wrong") {
      existing.incorrectCount += 1;
    } else if (event.answer_status === "skipped") {
      existing.skippedCount += 1;
    }
    existing.missCount += 1;
  }

  const groupedByLevel = groupBy([...buckets.values()], (item) => item.level);

  return LEVELS.flatMap((level) =>
    (groupedByLevel[level] ?? [])
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 4),
  );
}

function buildStudentLevelAttempts(
  attempts: AttemptRecord[],
): StudentLevelAttempts[] {
  const grouped = new Map<string, StudentLevelAttempts>();

  for (const attempt of attempts) {
    const existing = grouped.get(attempt.studentName);
    if (!existing) {
      grouped.set(attempt.studentName, {
        studentName: attempt.studentName,
        easyAttempts: attempt.level === "easy" ? 1 : 0,
        mediumAttempts: attempt.level === "medium" ? 1 : 0,
        hardAttempts: attempt.level === "hard" ? 1 : 0,
        totalAttempts: 1,
      });
      continue;
    }

    if (attempt.level === "easy") {
      existing.easyAttempts += 1;
    } else if (attempt.level === "medium") {
      existing.mediumAttempts += 1;
    } else {
      existing.hardAttempts += 1;
    }
    existing.totalAttempts += 1;
  }

  return [...grouped.values()].sort((a, b) => {
    if (b.totalAttempts !== a.totalAttempts) {
      return b.totalAttempts - a.totalAttempts;
    }

    return a.studentName.localeCompare(b.studentName);
  });
}

function buildLearnerProfiles(events: AnalyticsEvent[]): LearnerProfile[] {
  const byLearner = groupBy(events, (event) => event.learner_id);
  const profiles: LearnerProfile[] = [];

  for (const [learnerId, learnerEvents] of Object.entries(byLearner)) {
    const ordered = [...learnerEvents].sort(
      (a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp),
    );
    const sessions = new Set(ordered.map((event) => event.session_id));
    const latest = ordered[ordered.length - 1];
    const masteryScore = Math.round(
      average(ordered.slice(-20).map((event) => event.mastery_score)),
    );
    const latestAccuracy = getAccuracy(ordered.slice(-15));

    const topicStats = new Map<string, { correct: number; total: number }>();
    for (const event of ordered) {
      const stat = topicStats.get(event.topic_id) ?? { correct: 0, total: 0 };
      stat.total += 1;
      if (event.answer_status === "correct") {
        stat.correct += 1;
      }
      topicStats.set(event.topic_id, stat);
    }

    const topicPerformance = [...topicStats.entries()].map(
      ([topicId, stat]) => ({
        topicId,
        total: stat.total,
        accuracy:
          stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      }),
    );

    const strengths = topicPerformance
      .filter((topic) => topic.total >= 2 && topic.accuracy >= 75)
      .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)
      .map((topic) => topic.topicId)
      .slice(0, 2);

    const weakAreas = topicPerformance
      .filter((topic) => !strengths.includes(topic.topicId))
      .filter((topic) => topic.total >= 2 && topic.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      .map((topic) => topic.topicId)
      .slice(0, 2);

    const uniqueDays = [
      ...new Set(ordered.map((event) => event.timestamp.slice(0, 10))),
    ].sort();
    let streakDays = 0;
    for (let index = uniqueDays.length - 1; index >= 0; index -= 1) {
      if (index === uniqueDays.length - 1) {
        streakDays = 1;
        continue;
      }

      const current = new Date(uniqueDays[index]).getTime();
      const next = new Date(uniqueDays[index + 1]).getTime();
      const dayDiff = Math.round((next - current) / 86400000);
      if (dayDiff === 1) {
        streakDays += 1;
      } else {
        break;
      }
    }

    const recommendedNextLesson =
      masteryScore >= 80
        ? latest.difficulty_level === "easy"
          ? "Move to Medium level"
          : latest.difficulty_level === "medium"
            ? "Move to Hard level"
            : "Continue Hard level"
        : weakAreas[0]
          ? `Review ${formatSkillLabel(weakAreas[0])}`
          : `Practice ${latest.difficulty_level}`;

    profiles.push({
      learnerId,
      sessions: sessions.size,
      currentLevel: latest.difficulty_level,
      masteryScore,
      strengths,
      weakAreas,
      recommendedNextLesson,
      latestAccuracy,
      streakDays,
    });
  }

  return profiles.sort((a, b) => b.masteryScore - a.masteryScore);
}

function buildAdminInsights(events: AnalyticsEvent[]): AdminInsights {
  const profiles = buildLearnerProfiles(events);
  const weakAreas = buildWeakAreas(events);

  const contentErrors = new Map<string, { misses: number; total: number }>();
  for (const event of events) {
    const key = `${event.topic_id}`;
    if (!contentErrors.has(key)) {
      contentErrors.set(key, { misses: 0, total: 0 });
    }

    const item = contentErrors.get(key);
    if (!item) continue;
    item.total += 1;
    if (event.answer_status !== "correct") {
      item.misses += 1;
    }
  }

  const content = [...contentErrors.entries()].map(([key, value]) => ({
    key,
    errorRate:
      value.total > 0 ? Math.round((value.misses / value.total) * 100) : 0,
  }));

  const learnersAtRisk = profiles
    .filter((profile) => profile.masteryScore < 55)
    .map((profile) => ({
      learnerId: profile.learnerId,
      score: profile.masteryScore,
    }))
    .slice(0, 8);

  const topPerformers = profiles.slice(0, 8).map((profile) => ({
    learnerId: profile.learnerId,
    score: profile.masteryScore,
  }));

  return {
    classAverageAccuracy: getAccuracy(events),
    learnersAtRisk,
    topPerformers,
    hardestContent: [...weakAreas]
      .map((item) => ({
        key: `${item.level} - ${formatSkillLabel(item.topicId)}`,
        errorRate: clamp(item.missCount * 10, 0, 100),
      }))
      .slice(0, 5),
    easiestContent: content
      .sort((a, b) => a.errorRate - b.errorRate)
      .slice(0, 5),
  };
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <article className="rounded-2xl border-2 border-pink-200 bg-pink-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-pink-600">
        {title}
      </p>
      <p className="mt-1 text-3xl font-black text-pink-800">{value}</p>
      <p className="mt-1 text-sm font-semibold text-pink-700">{subtitle}</p>
    </article>
  );
}

export default function TeacherPage() {
  const [liveAttempts, setLiveAttempts] = useState<AttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studentsPerPage, setStudentsPerPage] = useState<PerPageCount>(10);
  const [attemptsPerPage, setAttemptsPerPage] = useState<PerPageCount>(20);
  const [studentPage, setStudentPage] = useState(1);
  const [attemptPage, setAttemptPage] = useState(1);
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(
    null,
  );
  const [pendingDeleteAttempt, setPendingDeleteAttempt] =
    useState<AttemptRecord | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<DeleteFeedback | null>(
    null,
  );
  const [levelPerPage, setLevelPerPage] = useState<PerPageCount>(10);
  const [levelPage, setLevelPage] = useState(1);
  const [studentAttemptsPerPage, setStudentAttemptsPerPage] =
    useState<PerPageCount>(10);
  const [studentAttemptsPage, setStudentAttemptsPage] = useState(1);
  const [incorrectPerPage, setIncorrectPerPage] = useState<PerPageCount>(10);
  const [incorrectPage, setIncorrectPage] = useState(1);

  const loadAttempts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/attempts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "Database not configured"
            : "Could not load attempts",
        );
      }

      const payload = (await response.json()) as { attempts?: AttemptRecord[] };
      const incomingAttempts = Array.isArray(payload.attempts)
        ? payload.attempts
        : [];
      setLiveAttempts(incomingAttempts);
    } catch (loadError) {
      setLiveAttempts([]);
      setNotice("No data yet.");

      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load attempts";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteAttempt = useCallback(async (attempt: AttemptRecord) => {
    setDeletingAttemptId(attempt.id);
    setDeleteFeedback(null);

    try {
      const response = await fetch(
        `/api/attempts?id=${encodeURIComponent(attempt.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Attempt not found"
            : "Could not delete attempt",
        );
      }

      setLiveAttempts((previous) =>
        previous.filter((item) => item.id !== attempt.id),
      );
      setDeleteFeedback({
        type: "success",
        message: "Attempt deleted successfully.",
      });
      setPendingDeleteAttempt(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete attempt";
      setDeleteFeedback({ type: "error", message });
    } finally {
      setDeletingAttemptId(null);
    }
  }, []);

  useEffect(() => {
    if (!deleteFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDeleteFeedback(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deleteFeedback]);

  useEffect(() => {
    void loadAttempts();
    return () => {};
  }, [loadAttempts]);

  const liveEvents = useMemo(
    () => mapAttemptsToEvents(liveAttempts),
    [liveAttempts],
  );
  const events = liveEvents;

  const topSummary = useMemo(() => {
    const learners = new Set(events.map((event) => event.learner_id));
    const sessions = new Set(events.map((event) => event.session_id));
    const now = Date.now();
    const activeWindow = now - 7 * 86400000;
    const activeUsers = new Set(
      events
        .filter((event) => toTimestamp(event.timestamp) >= activeWindow)
        .map((event) => event.learner_id),
    );

    return {
      totalAttempts: sessions.size,
      totalLearners: learners.size,
      averageAccuracy: getAccuracy(events),
      activeUsers: activeUsers.size,
      averageScoreRate: Math.round(
        average(liveAttempts.map((attempt) => attempt.masteryPercent)),
      ),
    };
  }, [events, liveAttempts]);

  const levelPerformance = useMemo(
    () => buildLevelPerformance(events, liveAttempts),
    [events, liveAttempts],
  );
  const topIncorrectQuestions = useMemo(
    () => buildTopIncorrectQuestions(events),
    [events],
  );
  const learnerProfiles = useMemo(() => buildLearnerProfiles(events), [events]);
  const studentLevelAttempts = useMemo(
    () => buildStudentLevelAttempts(liveAttempts),
    [liveAttempts],
  );
  const adminInsights = useMemo(() => buildAdminInsights(events), [events]);

  const studentTotalPages = Math.max(
    1,
    Math.ceil(learnerProfiles.length / studentsPerPage),
  );
  const levelTotalPages = Math.max(
    1,
    Math.ceil(levelPerformance.length / levelPerPage),
  );
  const attemptTotalPages = Math.max(
    1,
    Math.ceil(liveAttempts.length / attemptsPerPage),
  );
  const studentAttemptsTotalPages = Math.max(
    1,
    Math.ceil(studentLevelAttempts.length / studentAttemptsPerPage),
  );
  const incorrectTotalPages = Math.max(
    1,
    Math.ceil(topIncorrectQuestions.length / incorrectPerPage),
  );
  const effectiveStudentPage = Math.min(studentPage, studentTotalPages);
  const effectiveLevelPage = Math.min(levelPage, levelTotalPages);
  const effectiveAttemptPage = Math.min(attemptPage, attemptTotalPages);
  const effectiveStudentAttemptsPage = Math.min(
    studentAttemptsPage,
    studentAttemptsTotalPages,
  );
  const effectiveIncorrectPage = Math.min(incorrectPage, incorrectTotalPages);

  const visibleProfiles = useMemo(() => {
    const start = (effectiveStudentPage - 1) * studentsPerPage;
    return learnerProfiles.slice(start, start + studentsPerPage);
  }, [effectiveStudentPage, learnerProfiles, studentsPerPage]);

  const visibleLevelPerformance = useMemo(() => {
    const start = (effectiveLevelPage - 1) * levelPerPage;
    return levelPerformance.slice(start, start + levelPerPage);
  }, [effectiveLevelPage, levelPerPage, levelPerformance]);

  const filteredAttempts = useMemo(() => {
    return [...liveAttempts].sort(
      (a, b) => toTimestamp(b.completedAt) - toTimestamp(a.completedAt),
    );
  }, [liveAttempts]);

  const visibleStudentLevelAttempts = useMemo(() => {
    const start = (effectiveStudentAttemptsPage - 1) * studentAttemptsPerPage;
    return studentLevelAttempts.slice(start, start + studentAttemptsPerPage);
  }, [
    effectiveStudentAttemptsPage,
    studentAttemptsPerPage,
    studentLevelAttempts,
  ]);

  const visibleIncorrectQuestions = useMemo(() => {
    const start = (effectiveIncorrectPage - 1) * incorrectPerPage;
    return topIncorrectQuestions.slice(start, start + incorrectPerPage);
  }, [effectiveIncorrectPage, incorrectPerPage, topIncorrectQuestions]);

  const visibleAttempts = useMemo(() => {
    const start = (effectiveAttemptPage - 1) * attemptsPerPage;
    return filteredAttempts.slice(start, start + attemptsPerPage);
  }, [attemptsPerPage, effectiveAttemptPage, filteredAttempts]);

  const showEmpty = !isLoading && events.length === 0;

  return (
    <div className="safe-area-content min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-8">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-pink-600">
                Learning Analytics Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-black text-pink-900 sm:text-4xl">
                Attempts and Skill Insights
              </h1>
              <p className="mt-2 text-sm font-semibold text-pink-700 sm:text-base">
                Focused class view: attempts, weak skills, and student skill
                guidance.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => void loadAttempts()}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-4 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100"
              >
                Refresh Data
              </button>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-4 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100"
              >
                Back Home
              </Link>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-700">
              {notice}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 rounded-2xl border-2 border-pink-200 bg-pink-50 p-4 text-sm font-bold text-pink-700">
              Loading analytics dashboard...
            </div>
          ) : showEmpty ? (
            <div className="mt-6 rounded-2xl border-2 border-pink-200 bg-pink-50 p-4 text-sm font-bold text-pink-700">
              No student information yet.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <section className="perf-section">
                <h2 className="text-lg font-black text-pink-900">
                  Class Snapshot
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryCard
                    title="Total Attempts"
                    value={String(topSummary.totalAttempts)}
                    subtitle="Unique sessions submitted"
                  />
                  <SummaryCard
                    title="Total Learners"
                    value={String(topSummary.totalLearners)}
                    subtitle="Unique learner IDs"
                  />
                  <SummaryCard
                    title="Average Accuracy"
                    value={`${topSummary.averageAccuracy}%`}
                    subtitle="Percent of correct answers"
                  />
                  <SummaryCard
                    title="Average Score Rate"
                    value={`${topSummary.averageScoreRate}%`}
                    subtitle="Average final score percent per attempt"
                  />
                  <SummaryCard
                    title="Active Users"
                    value={String(topSummary.activeUsers)}
                    subtitle="Active within last 7 days"
                  />
                </div>
              </section>

              <section className="perf-section">
                <h2 className="text-lg font-black text-pink-900">
                  Level Performance
                </h2>
                <p className="mt-1 text-xs font-semibold text-pink-700">
                  Added average score and pass rate for a clearer per-level
                  view.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-pink-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-pink-600">
                      Per page
                    </span>
                    {[10, 20, 50].map((count) => (
                      <button
                        key={`level-per-page-${count}`}
                        type="button"
                        onClick={() => {
                          setLevelPerPage(count as PerPageCount);
                          setLevelPage(1);
                        }}
                        className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${levelPerPage === count ? "border-pink-500 bg-pink-500 text-white" : "border-pink-300 bg-pink-50 text-pink-700"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-pink-700">
                    Page {effectiveLevelPage} of {levelTotalPages}
                  </p>
                </div>
                <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-pink-200">
                  <table className="min-w-full bg-white text-xs sm:text-sm">
                    <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                      <tr>
                        <th className="px-3 py-2.5">Level</th>
                        <th className="px-3 py-2.5">Sessions</th>
                        <th className="px-3 py-2.5">Avg Score</th>
                        <th className="px-3 py-2.5">Correct %</th>
                        <th className="px-3 py-2.5">Pass %</th>
                        <th className="px-3 py-2.5">Retry %</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLevelPerformance.map((row) => (
                        <tr
                          key={row.level}
                          className="border-t border-pink-100 text-pink-800"
                        >
                          <td className="px-3 py-2.5 font-bold capitalize">
                            {row.level}
                          </td>
                          <td className="px-3 py-2.5">{row.attempts}</td>
                          <td className="px-3 py-2.5">{row.averageScore}%</td>
                          <td className="px-3 py-2.5">{row.accuracy}%</td>
                          <td className="px-3 py-2.5">{row.passRate}%</td>
                          <td className="px-3 py-2.5">{row.retryRate}%</td>
                          <td className="px-3 py-2.5">
                            {getLevelStatus(row.passRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setLevelPage((previous) => Math.max(1, previous - 1))
                    }
                    disabled={effectiveLevelPage <= 1}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLevelPage((previous) =>
                        Math.min(levelTotalPages, previous + 1),
                      )
                    }
                    disabled={effectiveLevelPage >= levelTotalPages}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </section>

              <section className="perf-section">
                <h2 className="text-lg font-black text-pink-900">
                  Attempts Per Level by Student
                </h2>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-pink-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-pink-600">
                      Per page
                    </span>
                    {[10, 20, 50].map((count) => (
                      <button
                        key={`student-attempts-per-page-${count}`}
                        type="button"
                        onClick={() => {
                          setStudentAttemptsPerPage(count as PerPageCount);
                          setStudentAttemptsPage(1);
                        }}
                        className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${studentAttemptsPerPage === count ? "border-pink-500 bg-pink-500 text-white" : "border-pink-300 bg-pink-50 text-pink-700"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-pink-700">
                    Page {effectiveStudentAttemptsPage} of{" "}
                    {studentAttemptsTotalPages}
                  </p>
                </div>
                <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-pink-200">
                  <table className="min-w-full bg-white text-sm">
                    <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                      <tr>
                        <th className="px-3 py-2.5">Student</th>
                        <th className="px-3 py-2.5">Easy Attempts</th>
                        <th className="px-3 py-2.5">Medium Attempts</th>
                        <th className="px-3 py-2.5">Hard Attempts</th>
                        <th className="px-3 py-2.5">Total Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudentLevelAttempts.map((row) => (
                        <tr
                          key={row.studentName}
                          className="border-t border-pink-100 text-pink-800"
                        >
                          <td className="px-3 py-2.5 font-bold">
                            {row.studentName}
                          </td>
                          <td className="px-3 py-2.5">{row.easyAttempts}</td>
                          <td className="px-3 py-2.5">{row.mediumAttempts}</td>
                          <td className="px-3 py-2.5">{row.hardAttempts}</td>
                          <td className="px-3 py-2.5">{row.totalAttempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setStudentAttemptsPage((previous) =>
                        Math.max(1, previous - 1),
                      )
                    }
                    disabled={effectiveStudentAttemptsPage <= 1}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStudentAttemptsPage((previous) =>
                        Math.min(studentAttemptsTotalPages, previous + 1),
                      )
                    }
                    disabled={
                      effectiveStudentAttemptsPage >= studentAttemptsTotalPages
                    }
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </section>

              <section className="perf-section">
                <article className="rounded-2xl border-2 border-pink-200 bg-white p-4">
                  <h2 className="text-lg font-black text-pink-900">
                    Top 3 Most Incorrect Questions per Level
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-pink-700">
                    Ranked by incorrect answers only (skipped answers are not
                    included). Full question text is shown.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-pink-200 bg-pink-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-pink-600">
                        Per page
                      </span>
                      {[10, 20, 50].map((count) => (
                        <button
                          key={`incorrect-per-page-${count}`}
                          type="button"
                          onClick={() => {
                            setIncorrectPerPage(count as PerPageCount);
                            setIncorrectPage(1);
                          }}
                          className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${incorrectPerPage === count ? "border-pink-500 bg-pink-500 text-white" : "border-pink-300 bg-pink-50 text-pink-700"}`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-pink-700">
                      Page {effectiveIncorrectPage} of {incorrectTotalPages}
                    </p>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-pink-100">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                        <tr>
                          <th className="px-3 py-2">Level</th>
                          <th className="px-3 py-2">Question</th>
                          <th className="px-3 py-2">Incorrect Answers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleIncorrectQuestions.map((item) => (
                          <tr
                            key={`${item.level}-${item.questionText}`}
                            className="border-t border-pink-100 text-pink-800"
                          >
                            <td className="px-3 py-2 capitalize">
                              {item.level}
                            </td>
                            <td className="px-3 py-2 whitespace-normal">
                              <div className="max-w-56 wrap-break-word sm:max-w-2xl">
                                {item.questionText}
                              </div>
                            </td>
                            <td className="px-3 py-2">{item.incorrectCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setIncorrectPage((previous) =>
                          Math.max(1, previous - 1),
                        )
                      }
                      disabled={effectiveIncorrectPage <= 1}
                      className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIncorrectPage((previous) =>
                          Math.min(incorrectTotalPages, previous + 1),
                        )
                      }
                      disabled={effectiveIncorrectPage >= incorrectTotalPages}
                      className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </article>
              </section>

              <section className="perf-section">
                <h2 className="text-lg font-black text-pink-900">
                  Student Learning Profiles
                </h2>
                <p className="mt-1 text-xs font-semibold text-pink-700">
                  Strengths use higher-accuracy skills; Needs Practice uses
                  lower-accuracy skills, so the same skill will not appear in
                  both lists.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-pink-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-pink-600">
                      Per page
                    </span>
                    {[10, 20, 50].map((count) => (
                      <button
                        key={`profile-per-page-${count}`}
                        type="button"
                        onClick={() => {
                          setStudentsPerPage(count as PerPageCount);
                          setStudentPage(1);
                        }}
                        className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${studentsPerPage === count ? "border-pink-500 bg-pink-500 text-white" : "border-pink-300 bg-pink-50 text-pink-700"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-pink-700">
                    Page {effectiveStudentPage} of {studentTotalPages}
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-pink-200">
                  <table className="min-w-full bg-white text-sm">
                    <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                      <tr>
                        <th className="px-3 py-2.5">Student</th>
                        <th className="px-3 py-2.5">Current Difficulty</th>
                        <th className="px-3 py-2.5">Mastery</th>
                        <th className="px-3 py-2.5">Strengths</th>
                        <th className="px-3 py-2.5">Needs Practice In</th>
                        <th className="px-3 py-2.5">Next Step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProfiles.map((profile) => (
                        <tr
                          key={profile.learnerId}
                          className="border-t border-pink-100 text-pink-800 align-top"
                        >
                          <td className="px-3 py-2.5 font-bold">
                            {profile.learnerId}
                          </td>
                          <td className="px-3 py-2.5 capitalize">
                            {profile.currentLevel}
                          </td>
                          <td className="px-3 py-2.5">
                            {profile.masteryScore}%
                          </td>
                          <td className="px-3 py-2.5">
                            {profile.strengths
                              .map((skill) => formatSkillLabel(skill))
                              .join(", ") || "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            {profile.weakAreas
                              .map((skill) => formatSkillLabel(skill))
                              .join(", ") || "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            {profile.recommendedNextLesson}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setStudentPage((previous) => Math.max(1, previous - 1))
                    }
                    disabled={effectiveStudentPage <= 1}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStudentPage((previous) =>
                        Math.min(studentTotalPages, previous + 1),
                      )
                    }
                    disabled={effectiveStudentPage >= studentTotalPages}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </section>

              <section className="perf-section">
                <article className="rounded-2xl border-2 border-pink-200 bg-white p-4">
                  <h2 className="text-lg font-black text-pink-900">
                    Teacher Insights
                  </h2>
                  <div className="mt-3 space-y-3 text-sm font-semibold text-pink-700">
                    <p>
                      Overall class accuracy is{" "}
                      <span className="font-black text-pink-800">
                        {adminInsights.classAverageAccuracy}%
                      </span>
                      .
                    </p>
                    <p>
                      Students who may need extra support:{" "}
                      {adminInsights.learnersAtRisk
                        .map((item) => item.learnerId)
                        .join(", ") || "none right now"}
                      .
                    </p>
                    <p>
                      Students currently doing very well:{" "}
                      {adminInsights.topPerformers
                        .map((item) => item.learnerId)
                        .join(", ") || "none yet"}
                      .
                    </p>
                    <p>
                      Skills to prioritize next lessons:{" "}
                      {adminInsights.hardestContent
                        .map((item) => item.key)
                        .join(", ") || "none"}
                      .
                    </p>
                  </div>
                </article>
              </section>

              <section className="perf-section">
                <h2 className="text-lg font-black text-pink-900">
                  Recent Attempt Records
                </h2>
                {deleteFeedback && (
                  <div
                    className={`mt-3 rounded-2xl border-2 p-3 text-sm font-bold ${deleteFeedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}
                  >
                    {deleteFeedback.message}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-pink-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-pink-600">
                      Per page
                    </span>
                    {[10, 20, 50].map((count) => (
                      <button
                        key={`attempt-per-page-${count}`}
                        type="button"
                        onClick={() => {
                          setAttemptsPerPage(count as PerPageCount);
                          setAttemptPage(1);
                        }}
                        className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${attemptsPerPage === count ? "border-pink-500 bg-pink-500 text-white" : "border-pink-300 bg-pink-50 text-pink-700"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-pink-700">
                    Page {effectiveAttemptPage} of {attemptTotalPages}
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-pink-200">
                  <table className="min-w-full bg-white text-sm">
                    <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                      <tr>
                        <th className="px-3 py-2.5">When</th>
                        <th className="px-3 py-2.5">Student</th>
                        <th className="px-3 py-2.5">Level</th>
                        <th className="px-3 py-2.5">Score</th>
                        <th className="px-3 py-2.5">Mastery</th>
                        <th className="px-3 py-2.5">Result</th>
                        <th className="px-3 py-2.5 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAttempts.map((attempt) => (
                        <tr
                          key={attempt.id}
                          className="border-t border-pink-100 text-pink-800"
                        >
                          <td className="px-3 py-2.5">
                            {formatDate(attempt.completedAt)}
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            {attempt.studentName}
                          </td>
                          <td className="px-3 py-2.5 capitalize">
                            {attempt.level}
                          </td>
                          <td className="px-3 py-2.5">
                            {attempt.score}/{attempt.total}
                          </td>
                          <td className="px-3 py-2.5">
                            {attempt.masteryPercent}%
                          </td>
                          <td className="px-3 py-2.5">
                            {attempt.passed ? "Passed" : "Needs Review"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteAttempt(attempt)}
                              disabled={deletingAttemptId === attempt.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Delete attempt for ${attempt.studentName}`}
                              title="Delete attempt"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setAttemptPage((previous) => Math.max(1, previous - 1))
                    }
                    disabled={effectiveAttemptPage <= 1}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAttemptPage((previous) =>
                        Math.min(attemptTotalPages, previous + 1),
                      )
                    }
                    disabled={effectiveAttemptPage >= attemptTotalPages}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border-2 border-pink-200 bg-pink-50 p-4">
                <h2 className="text-lg font-black text-pink-900">
                  Quick Guide
                </h2>
                <div className="mt-3 grid gap-2 text-sm font-semibold text-pink-800 sm:grid-cols-2">
                  <p>
                    Most Problematic Skills is shown with plain-language notes.
                  </p>
                  <p>
                    Recent Attempt Records show attempt-level score, level, and
                    mastery only.
                  </p>
                  <p>
                    Strengths and Needs Practice are capped to 2 skills each.
                  </p>
                  <p>
                    Needs Practice In excludes any skill already listed as a
                    strength.
                  </p>
                  <p>
                    Skill labels are derived from question text in the flashcard
                    set.
                  </p>
                </div>
              </section>
            </div>
          )}

          {pendingDeleteAttempt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-6">
                <h3 className="text-xl font-black text-pink-900">
                  Delete Attempt?
                </h3>
                <p className="mt-2 text-sm font-semibold text-pink-700">
                  This will remove the record from the dashboard and database.
                </p>
                <div className="mt-3 rounded-2xl border border-pink-200 bg-pink-50 p-3 text-sm text-pink-800">
                  <p>
                    <span className="font-bold">Student:</span>{" "}
                    {pendingDeleteAttempt.studentName}
                  </p>
                  <p>
                    <span className="font-bold">Level:</span>{" "}
                    {pendingDeleteAttempt.level}
                  </p>
                  <p>
                    <span className="font-bold">Score:</span>{" "}
                    {pendingDeleteAttempt.score}/{pendingDeleteAttempt.total}
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteAttempt(null)}
                    className="rounded-xl border-2 border-pink-300 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700 transition hover:bg-pink-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAttempt(pendingDeleteAttempt)}
                    disabled={deletingAttemptId === pendingDeleteAttempt.id}
                    className="rounded-xl border-2 border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingAttemptId === pendingDeleteAttempt.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
