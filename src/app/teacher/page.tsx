"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AttemptRecord = {
  id: string;
  studentName: string;
  level: "easy" | "medium" | "hard";
  score: number;
  total: number;
  masteryPercent: number;
  passed: boolean;
  completedAt: string;
  createdAt: string;
};

type StudentSummary = {
  studentName: string;
  attempts: number;
  firstPercent: number;
  latestPercent: number;
  bestPercent: number;
  trend: number;
  lastAttemptAt: string;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function getPercent(score: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((score / total) * 100);
}

export default function TeacherPage() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAttempts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/attempts", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 503) {
            throw new Error(
              "Database is not configured. Add MONGODB_URI to enable teacher dashboard data.",
            );
          }

          throw new Error("Could not load attempts");
        }

        const payload = (await response.json()) as {
          attempts?: AttemptRecord[];
        };
        if (!cancelled) {
          setAttempts(Array.isArray(payload.attempts) ? payload.attempts : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load attempts";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAttempts();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAttempts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return attempts;
    }

    return attempts.filter((attempt) =>
      attempt.studentName.toLowerCase().includes(normalizedQuery),
    );
  }, [attempts, searchQuery]);

  const studentSummaries = useMemo(() => {
    const attemptsByStudent = new Map<string, AttemptRecord[]>();

    for (const attempt of filteredAttempts) {
      const key = attempt.studentName;
      if (!attemptsByStudent.has(key)) {
        attemptsByStudent.set(key, []);
      }
      attemptsByStudent.get(key)?.push(attempt);
    }

    const summaries: StudentSummary[] = [];

    for (const [studentName, studentAttempts] of attemptsByStudent.entries()) {
      const ordered = [...studentAttempts].sort(
        (a, b) =>
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      );

      const first = ordered[0];
      const latest = ordered[ordered.length - 1];
      const firstPercent = getPercent(first.score, first.total);
      const latestPercent = getPercent(latest.score, latest.total);
      const bestPercent = ordered.reduce((best, item) => {
        return Math.max(best, getPercent(item.score, item.total));
      }, 0);

      summaries.push({
        studentName,
        attempts: ordered.length,
        firstPercent,
        latestPercent,
        bestPercent,
        trend: latestPercent - firstPercent,
        lastAttemptAt: latest.completedAt,
      });
    }

    return summaries.sort((a, b) => b.latestPercent - a.latestPercent);
  }, [filteredAttempts]);

  return (
    <div className="safe-area-content min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-8">
      <main className="mx-auto w-full max-w-7xl">
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-pink-600">
                Teacher Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-black text-pink-900 sm:text-4xl">
                Student Attempts
              </h1>
              <p className="mt-2 text-sm font-semibold text-pink-700 sm:text-base">
                View all uploaded quiz attempts and check who is improving over
                time.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-4 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] sm:w-auto"
            >
              Back Home
            </Link>
          </div>

          <div className="mt-5 rounded-2xl border-2 border-pink-200 bg-pink-50 p-3 sm:p-4">
            <label
              htmlFor="student-search"
              className="text-xs font-extrabold uppercase tracking-wide text-pink-600"
            >
              Filter by student name
            </label>
            <input
              id="student-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type student name..."
              className="mt-2 w-full rounded-xl border-2 border-pink-200 bg-white px-3 py-2.5 text-sm font-semibold text-pink-800 outline-none transition focus:border-pink-400"
            />
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-2xl border-2 border-pink-200 bg-pink-50 p-4 text-sm font-bold text-pink-700">
              Loading attempts...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-pink-200">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                    <tr>
                      <th className="px-3 py-2.5">Student</th>
                      <th className="px-3 py-2.5">Attempts</th>
                      <th className="px-3 py-2.5">First</th>
                      <th className="px-3 py-2.5">Latest</th>
                      <th className="px-3 py-2.5">Best</th>
                      <th className="px-3 py-2.5">Trend</th>
                      <th className="px-3 py-2.5">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentSummaries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-4 text-center font-semibold text-pink-700"
                        >
                          No attempts yet.
                        </td>
                      </tr>
                    ) : (
                      studentSummaries.map((student) => (
                        <tr
                          key={student.studentName}
                          className="border-t border-pink-100 text-pink-800"
                        >
                          <td className="px-3 py-2.5 font-bold">
                            {student.studentName}
                          </td>
                          <td className="px-3 py-2.5">{student.attempts}</td>
                          <td className="px-3 py-2.5">
                            {student.firstPercent}%
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            {student.latestPercent}%
                          </td>
                          <td className="px-3 py-2.5">
                            {student.bestPercent}%
                          </td>
                          <td className="px-3 py-2.5 font-extrabold">
                            {student.trend > 0
                              ? `+${student.trend}%`
                              : `${student.trend}%`}
                          </td>
                          <td className="px-3 py-2.5">
                            {formatDate(student.lastAttemptAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-pink-200">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-pink-50 text-left text-xs font-black uppercase tracking-wide text-pink-700">
                    <tr>
                      <th className="px-3 py-2.5">When</th>
                      <th className="px-3 py-2.5">Student</th>
                      <th className="px-3 py-2.5">Level</th>
                      <th className="px-3 py-2.5">Score</th>
                      <th className="px-3 py-2.5">Mastery</th>
                      <th className="px-3 py-2.5">Passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center font-semibold text-pink-700"
                        >
                          No matching attempts.
                        </td>
                      </tr>
                    ) : (
                      filteredAttempts.map((attempt) => (
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
                            {attempt.passed ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
