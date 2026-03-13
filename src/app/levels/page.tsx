"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  flashcardLevelMeta,
  flashcardLevels,
  type FlashcardLevel,
} from "../data/flashcard";
import {
  createDefaultLevelProgress,
  getRequiredScore,
  getUnlockRequirement,
  isLevelUnlocked,
  readLevelProgress,
  type LevelProgressMap,
} from "../data/level-progress";

export default function LevelsPage() {
  const [levelProgress, setLevelProgress] = useState<LevelProgressMap>(
    createDefaultLevelProgress,
  );
  const [isLevelProgressReady, setIsLevelProgressReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLevelProgress(readLevelProgress());
      setIsLevelProgressReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const emojiByLevel: Record<FlashcardLevel, string> = {
    easy: "🌸",
    medium: "🌺",
    hard: "💮",
  };

  const colorByLevel: Record<FlashcardLevel, string> = {
    easy: "from-pink-100 to-pink-50",
    medium: "from-pink-200 to-pink-100",
    hard: "from-pink-300 to-pink-200",
  };

  return (
    <div className="safe-area-content min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-8">
      <main className="mx-auto w-full max-w-6xl">
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-pink-600">
                📚 Level Selection
              </p>
              <h1 className="mt-3 text-3xl font-black text-pink-900 sm:text-4xl">
                Choose Your Level
              </h1>
              <p className="mt-2 text-sm font-semibold text-pink-700 sm:text-base">
                Track your scores, unlock new levels, and keep learning offline.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-4 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] sm:w-auto"
            >
              ← Home
            </Link>
          </div>

          {!isLevelProgressReady ? (
            <div className="mt-6 rounded-2xl border-2 border-pink-200 bg-pink-50 p-5 text-center">
              <p className="text-sm font-bold text-pink-700">
                Loading progress…
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {flashcardLevels.map((level, index) => {
                const cfg = flashcardLevelMeta[level];
                const progress = levelProgress[level];
                const requiredScore = getRequiredScore(cfg.itemCount);
                const unlocked = isLevelUnlocked(levelProgress, level);
                const requiredLevel = getUnlockRequirement(level);

                return (
                  <article
                    key={level}
                    className={`animate-slide-up rounded-3xl border-2 border-pink-200 bg-linear-to-b ${colorByLevel[level]} p-5 shadow-md transition hover:-translate-y-1 hover:shadow-lg`}
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: "both",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-4xl">{emojiByLevel[level]}</p>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold text-pink-600">
                        Level {index + 1}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-black text-pink-800">
                      {cfg.label}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-pink-700">
                      {cfg.subtitle}
                    </p>
                    <p className="mt-2 text-sm font-medium text-pink-700">
                      {cfg.itemCount} flashcards
                    </p>

                    <div className="mt-3 rounded-2xl border-2 border-pink-200 bg-white/80 p-3 text-pink-700">
                      <p className="text-xs font-black uppercase tracking-wide">
                        🎯 Goal: {requiredScore}/{cfg.itemCount}
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                        <p className="rounded-xl bg-pink-50 px-2.5 py-2 font-bold">
                          ⭐ Best
                          <br />
                          <span className="text-sm font-black sm:text-base">
                            {progress.bestScore}/{cfg.itemCount}
                          </span>
                        </p>
                        <p className="rounded-xl bg-pink-50 px-2.5 py-2 font-bold">
                          🧾 Last
                          <br />
                          <span className="text-sm font-black sm:text-base">
                            {progress.lastScore}/{cfg.itemCount}
                          </span>
                        </p>
                      </div>

                      <p className="mt-2 rounded-xl bg-pink-50 px-2.5 py-2 text-xs font-extrabold sm:text-sm">
                        {progress.passed
                          ? "✅ Great job! Level passed"
                          : progress.attempts > 0
                            ? "🌱 Keep going! You can pass this"
                            : "🚀 First try starts here"}
                      </p>
                    </div>

                    {unlocked ? (
                      <Link
                        href={`/quiz?level=${level}`}
                        className="mt-4 inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl border-2 border-pink-400 bg-white px-4 py-3 text-sm font-extrabold text-pink-600 transition hover:bg-pink-500 hover:text-white active:scale-[0.99]"
                      >
                        Play {cfg.label} ▶
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-4 inline-flex min-h-11.5 w-full cursor-not-allowed items-center justify-center rounded-2xl border-2 border-pink-200 bg-white/80 px-4 py-3 text-sm font-extrabold text-pink-400"
                      >
                        🔒 Locked for now
                      </button>
                    )}

                    {!unlocked && requiredLevel && (
                      <p className="mt-2 rounded-xl bg-pink-50 px-3 py-2 text-center text-xs font-bold text-pink-700">
                        Pass {flashcardLevelMeta[requiredLevel].label} first to
                        unlock this level.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <div className="h-6" />
    </div>
  );
}
