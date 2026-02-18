"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  flashcardLevelMeta,
  flashcardLevels,
  searchCards,
  type FlashcardLevel,
  type Flashcard,
} from "./data/flashcard";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Home() {
  const deferredPromptRef = useRef<InstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installHint, setInstallHint] = useState(
    "Tap to install this app on your device",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Flashcard[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);

  useEffect(() => {
    const isSecure = window.isSecureContext;
    if (!isSecure) {
      setInstallHint("Install requires HTTPS (or localhost).");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.active) {
            setIsOfflineReady(true);
          }
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                setIsOfflineReady(true);
              }
            });
          });
        })
        .catch(() => {
          setInstallHint("Service worker unavailable. Check browser settings.");
        });
    }

    const inStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (inStandaloneMode) {
      setIsInstalled(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as InstallPromptEvent;
      setCanPromptInstall(true);
      setInstallHint("Ready! Tap Install App to add it to your home screen.");
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanPromptInstall(false);
      setIsInstalled(true);
      setInstallHint("Installed successfully 🎉");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function installApp() {
    const deferredPrompt = deferredPromptRef.current;

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPromptRef.current = null;
        setCanPromptInstall(false);
        setIsInstalled(true);
        setInstallHint("Installed successfully 🎉");
      } else {
        setInstallHint("Install was canceled. You can try again anytime.");
      }
      return;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);

    if (isIOS) {
      setInstallHint("On iPhone/iPad: tap Share, then Add to Home Screen.");
      return;
    }

    setInstallHint("Use your browser menu (⋮) and choose Install App.");
  }

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      setSearchResults(searchCards(q));
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }

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
      {/* ─── Install Banner ─── */}
      {!isInstalled && (
        <div className="mx-auto mb-4 max-w-6xl">
          <button
            type="button"
            onClick={installApp}
            className="install-pulse flex w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="text-2xl">📲</span>
            {canPromptInstall
              ? "Install App on Your Device"
              : "Install App (Browser Menu)"}
          </button>
          <p className="mt-2 text-center text-sm font-semibold text-pink-600/80">
            {installHint}
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl">
        {/* ─── Hero Section ─── */}
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-10">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-pink-600">
                <span className="animate-sparkle">✨</span>
                Grade 5 English Quiz
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight text-pink-900 sm:text-5xl">
                Fun Flashcards! 🌸
              </h1>
              <p className="mt-3 max-w-2xl text-base font-semibold text-pink-700/80 sm:text-lg">
                Pick a level and start learning — each set has flashcards with
                instant feedback, explanations, and rewards!
              </p>
            </div>
            <div className="animate-float text-5xl sm:text-7xl">🎀</div>
          </div>

          {/* ─── Search Bar ─── */}
          <div className="relative mt-6">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-pink-200 bg-pink-50/50 px-4 py-3 transition focus-within:border-pink-400 focus-within:shadow-md">
              <span className="text-xl text-pink-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search questions or topics..."
                className="w-full bg-transparent text-base font-semibold text-pink-900 outline-none placeholder:text-pink-300"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearch(false);
                  }}
                  className="rounded-full bg-pink-200 px-2.5 py-0.5 text-xs font-bold text-pink-700 hover:bg-pink-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showSearch && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border-2 border-pink-200 bg-white p-3 shadow-xl">
                {searchResults.length === 0 ? (
                  <p className="py-4 text-center text-sm font-semibold text-pink-400">
                    No matching questions found 🌷
                  </p>
                ) : (
                  searchResults.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-xl border-b border-pink-100 p-3 last:border-0"
                    >
                      <p className="text-sm font-bold text-pink-800">
                        {card.front}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-pink-500">
                        Answer: {card.options[card.answer]} &bull; {card.topic}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ─── Quick Start ─── */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/quiz?level=easy"
              className="rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-8 py-3.5 text-base font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Start Quiz 🚀
            </Link>
            <a
              href="#levels"
              className="rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3.5 text-base font-bold text-pink-600 transition hover:bg-pink-100"
            >
              View All Levels
            </a>
          </div>

          {/* ─── Feature Highlights ─── */}
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              { icon: "🔀", label: "Shuffle Mode" },
              { icon: "📴", label: "Works Offline" },
              { icon: "⭐", label: "Earn Stars" },
              { icon: "📊", label: "Score Tracker" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 rounded-xl border border-pink-200 bg-pink-50/50 p-3"
              >
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm font-bold text-pink-700">
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {/* ─── Level Cards ─── */}
          <div id="levels" className="mt-8 grid gap-4 md:grid-cols-3">
            {flashcardLevels.map((level, index) => {
              const cfg = flashcardLevelMeta[level];
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
                  <p className="mt-1 text-sm font-semibold text-pink-600/80">
                    {cfg.subtitle}
                  </p>
                  <p className="mt-2 text-sm font-medium text-pink-500">
                    {cfg.itemCount} flashcards
                  </p>

                  <Link
                    href={`/quiz?level=${level}`}
                    className="mt-4 inline-flex w-full justify-center rounded-2xl border-2 border-pink-400 bg-white px-4 py-3 text-sm font-extrabold text-pink-600 transition hover:bg-pink-500 hover:text-white"
                  >
                    Play {cfg.label} ▶
                  </Link>
                </article>
              );
            })}
          </div>

          {/* ─── How to Play ─── */}
          <div className="mt-8 rounded-3xl border-2 border-pink-200 bg-pink-50 p-5">
            <h3 className="text-lg font-extrabold text-pink-700">
              🎮 How to Play
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Read the Question",
                  desc: "Look at the front of the card and read carefully.",
                },
                {
                  step: "2",
                  title: "Choose Your Answer",
                  desc: "Pick from the options — the card will flip to show the answer!",
                },
                {
                  step: "3",
                  title: "Earn Stars!",
                  desc: "Get stars and badges based on your score. Try for a perfect run!",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-sm font-black text-white">
                    {s.step}
                  </span>
                  <div>
                    <p className="font-bold text-pink-800">{s.title}</p>
                    <p className="mt-1 text-xs font-medium text-pink-600/80">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Info Footer ─── */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-pink-200 bg-white p-4">
              <h4 className="font-extrabold text-pink-700">📚 Subject</h4>
              <p className="mt-1 text-sm font-semibold text-pink-600/80">
                Subject–Verb Agreement — Grade 5 English
              </p>
            </div>
            <div className="rounded-2xl border border-pink-200 bg-white p-4">
              <h4 className="font-extrabold text-pink-700">
                🌐 Offline Status
              </h4>
              {isOfflineReady ? (
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-green-600">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  OFFLINE READY — study anytime!
                </p>
              ) : (
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-pink-600/80">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                  Preparing offline mode…
                </p>
              )}
            </div>
          </div>

          {/* ─── About / Credits ─── */}
          <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50/50 p-5">
            <h3 className="text-lg font-extrabold text-pink-700">
              📋 About This App
            </h3>
            <p className="mt-2 text-sm font-semibold text-pink-600/80">
              An interactive flashcard quiz designed to help Grade 5 students
              master Subject-Verb Agreement in English. Features 40 questions
              across three difficulty levels with instant feedback, star
              rewards, and full offline support.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-pink-400">
                  Proponent
                </p>
                <p className="mt-1 text-sm font-extrabold text-pink-800">
                  STUDENT NAME
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-pink-400">
                  Adviser
                </p>
                <p className="mt-1 text-sm font-extrabold text-pink-800">
                  TEACHER NAME
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Bottom spacing ─── */}
      <div className="h-6" />
    </div>
  );
}
