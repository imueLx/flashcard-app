"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchCards, type Flashcard } from "./data/flashcard";
import { readLevelProgress } from "./data/level-progress";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type WindowWithInstallPrompt = Window & {
  __deferredInstallPrompt?: InstallPromptEvent | null;
};

export default function Home() {
  const deferredPromptRef = useRef<InstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean((window as WindowWithInstallPrompt).__deferredInstallPrompt);
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [installHint, setInstallHint] = useState("");
  const [isPreparingInstall, setIsPreparingInstall] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Flashcard[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [startLearningHref] = useState(() => {
    if (typeof window === "undefined") {
      return "/quiz?level=easy";
    }

    const progress = readLevelProgress();

    if (!progress.easy.passed) {
      return "/quiz?level=easy";
    }

    if (!progress.medium.passed) {
      return "/quiz?level=medium";
    }

    return "/quiz?level=hard";
  });

  const [startLearningLabel] = useState(() => {
    if (typeof window === "undefined") {
      return "Start Easy";
    }

    const progress = readLevelProgress();

    if (!progress.easy.passed) {
      return progress.easy.attempts > 0 ? "Continue Easy" : "Start Easy";
    }

    if (!progress.medium.passed) {
      return progress.medium.attempts > 0 ? "Continue Medium" : "Start Medium";
    }

    return progress.hard.attempts > 0 ? "Continue Hard" : "Start Hard";
  });

  const inStandaloneMode =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true);
  const isInstalledOrStandalone = isInstalled || inStandaloneMode;

  const platformRef = useRef<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      platformRef.current = "ios";
    } else if (/android/.test(ua)) {
      platformRef.current = "android";
    }
  }, []);

  useEffect(() => {
    let cleanupServiceWorkerListener = () => {};

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsOfflineReady(true);
      });

      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          setInstallHint("Service worker unavailable. Check browser settings.");
        }
      });

      const onControllerChange = () => {
        setIsOfflineReady(true);
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );

      cleanupServiceWorkerListener = () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      };
    }

    const inStandaloneNow =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (inStandaloneNow) {
      return cleanupServiceWorkerListener;
    }

    if ("getInstalledRelatedApps" in navigator) {
      (
        navigator as Navigator & {
          getInstalledRelatedApps: () => Promise<unknown[]>;
        }
      )
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps.length > 0) {
            setIsInstalled(true);
          }
        })
        .catch(() => {});
    }

    const globalWindow = window as WindowWithInstallPrompt;

    if (globalWindow.__deferredInstallPrompt) {
      deferredPromptRef.current = globalWindow.__deferredInstallPrompt;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as InstallPromptEvent;
      globalWindow.__deferredInstallPrompt = event as InstallPromptEvent;
      setCanPromptInstall(true);
      setInstallHint("Install is ready. Tap Install App.");
    };

    const onInstallAvailable = () => {
      const pendingPrompt = globalWindow.__deferredInstallPrompt;
      if (pendingPrompt) {
        deferredPromptRef.current = pendingPrompt;
        setCanPromptInstall(true);
        setInstallHint("Install is ready. Tap Install App.");
      }
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      globalWindow.__deferredInstallPrompt = null;
      setCanPromptInstall(false);
      setIsInstalled(true);
      setInstallHint("Installed successfully 🎉");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("pwa-install-available", onInstallAvailable);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      cleanupServiceWorkerListener();
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("pwa-install-available", onInstallAvailable);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function waitForNativeInstallPrompt(timeoutMs = 1800) {
    if (deferredPromptRef.current) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      const globalWindow = window as WindowWithInstallPrompt;

      const cleanup = () => {
        window.removeEventListener("pwa-install-available", onAvailable);
        window.removeEventListener("beforeinstallprompt", onAvailable);
        window.clearTimeout(timeoutId);
      };

      const onAvailable = () => {
        if (globalWindow.__deferredInstallPrompt) {
          deferredPromptRef.current = globalWindow.__deferredInstallPrompt;
          setCanPromptInstall(true);
          cleanup();
          resolve(true);
        }
      };

      const timeoutId = window.setTimeout(() => {
        cleanup();
        if (globalWindow.__deferredInstallPrompt) {
          deferredPromptRef.current = globalWindow.__deferredInstallPrompt;
          setCanPromptInstall(true);
          resolve(true);
          return;
        }
        resolve(false);
      }, timeoutMs);

      window.addEventListener("pwa-install-available", onAvailable);
      window.addEventListener("beforeinstallprompt", onAvailable);
      onAvailable();
    });
  }

  async function installApp() {
    if (!window.isSecureContext) {
      setInstallHint("Install requires HTTPS (or localhost).");
      return;
    }

    const deferredPrompt = deferredPromptRef.current;
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPromptRef.current = null;
        (window as WindowWithInstallPrompt).__deferredInstallPrompt = null;
        setCanPromptInstall(false);
        setIsInstalled(true);
        setInstallHint("Installed successfully 🎉");
      } else {
        setInstallHint("Install was canceled. You can try again anytime.");
      }
      return;
    }

    if (platformRef.current !== "ios") {
      setIsPreparingInstall(true);
      setInstallHint("Preparing install dialog...");
      const becameAvailable = await waitForNativeInstallPrompt();
      setIsPreparingInstall(false);

      if (becameAvailable && deferredPromptRef.current) {
        const refreshedPrompt = deferredPromptRef.current;
        await refreshedPrompt.prompt();
        const choice = await refreshedPrompt.userChoice;
        if (choice.outcome === "accepted") {
          deferredPromptRef.current = null;
          (window as WindowWithInstallPrompt).__deferredInstallPrompt = null;
          setCanPromptInstall(false);
          setIsInstalled(true);
          setInstallHint("Installed successfully 🎉");
        } else {
          setInstallHint("Install was canceled. You can try again anytime.");
        }
        return;
      }
    }

    if (platformRef.current !== "ios" && !canPromptInstall) {
      setInstallHint("Install dialog isn't available on this browser session.");
    }

    const platform = platformRef.current;

    if (platform === "ios") {
      setShowIOSGuide(true);
      return;
    }

    if (platform === "android") {
      setInstallHint(
        'Tap your browser menu (⋮) at the top-right, then choose "Install app" or "Add to Home screen".',
      );
      return;
    }

    setInstallHint(
      "In Chrome/Edge: click the install icon (⊕) in the address bar, or use the browser menu → Install app.",
    );
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

  return (
    <div className="safe-area-content min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-8">
      {!isInstalledOrStandalone && (
        <div className="mx-auto mb-4 max-w-6xl">
          <button
            type="button"
            onClick={installApp}
            disabled={isPreparingInstall}
            className="install-pulse flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            <span className="text-2xl">📲</span>
            {isPreparingInstall
              ? "Checking install..."
              : canPromptInstall
                ? "Install App Now"
                : "Install App"}
          </button>
          {installHint && (
            <p className="mt-2 text-center text-sm font-semibold text-pink-700">
              {installHint}
            </p>
          )}
        </div>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-pink-900/40 px-4 pb-6 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm animate-slide-up rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-2xl sm:p-6">
            <h3 className="text-lg font-black text-pink-800">
              Install on iPhone / iPad
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-black text-white">
                  1
                </span>
                <p className="text-sm font-semibold text-pink-700">
                  Tap the <strong>Share</strong> button{" "}
                  <span className="inline-block text-lg leading-none">⎋</span>{" "}
                  at the bottom of Safari.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-black text-white">
                  2
                </span>
                <p className="text-sm font-semibold text-pink-700">
                  Scroll down and tap{" "}
                  <strong>&quot;Add to Home Screen&quot;</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-black text-white">
                  3
                </span>
                <p className="text-sm font-semibold text-pink-700">
                  Tap <strong>&quot;Add&quot;</strong> to install BlushCards.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 min-h-11 w-full rounded-2xl bg-pink-500 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-pink-600 active:scale-[0.99]"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl">
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-xl sm:p-10">
          <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="w-full">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-pink-600">
                <span className="animate-sparkle">✨</span>
                BlushCards: Grammar Fun
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-pink-900 sm:mt-4 sm:text-5xl">
                BlushCards: Grammar Fun 🌸
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-pink-800 sm:mt-3 sm:text-lg">
                Pick a level and start learning — each set has flashcards with
                instant feedback, explanations, and rewards!
              </p>
            </div>
            <div className="animate-float text-4xl sm:text-7xl">🎀</div>
          </div>

          <div className="mt-5 rounded-3xl border-2 border-pink-200 bg-linear-to-b from-pink-50 to-white p-4 sm:mt-6 sm:p-5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-pink-600">
              Start Here
            </p>
            <h3 className="mt-1 text-lg font-black text-pink-800 sm:text-xl">
              Begin your learning journey
            </h3>
            <p className="mt-1 text-sm font-semibold text-pink-700">
              Choose a level, answer questions, and unlock the next challenge.
            </p>

            <div className="mt-4 grid gap-2.5 sm:mt-5 sm:flex sm:flex-wrap sm:gap-3">
              <Link
                href={startLearningHref}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3.5 text-center text-base font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] sm:w-auto sm:px-8"
              >
                {startLearningLabel} 🚀
              </Link>
              <Link
                href="/levels"
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3.5 text-center text-base font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] sm:w-auto"
              >
                View All Levels
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border-2 border-pink-200 bg-pink-50 p-4 sm:mt-8 sm:p-5">
            <h3 className="text-lg font-extrabold text-pink-700">
              🧠 Learning Stack
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Pick a Level",
                  desc: "Choose easy, medium, or hard in the Levels page.",
                },
                {
                  step: "2",
                  title: "Answer & Learn",
                  desc: "Read each card, answer, and check the explanation.",
                },
                {
                  step: "3",
                  title: "Track Progress",
                  desc: "Pass levels and unlock the next challenge.",
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
                    <p className="mt-1 text-xs font-medium text-pink-700">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-2xl border border-pink-200 bg-white p-4">
              <h4 className="font-extrabold text-pink-700">📚 Subject</h4>
              <p className="mt-1 text-sm font-semibold text-pink-700">
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
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-pink-700">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                  Preparing offline mode…
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">
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

          <div className="relative mt-6 sm:mt-8">
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-pink-700">
              🔎 Explore Questions (Optional)
            </h3>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-pink-200 bg-pink-50/50 px-4 py-3 transition focus-within:border-pink-400 focus-within:shadow-md">
              <span className="text-xl text-pink-600">🔎</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search questions or topics..."
                className="w-full bg-transparent text-base font-semibold text-pink-900 outline-none placeholder:text-pink-600"
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

            {showSearch && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border-2 border-pink-200 bg-white p-3 shadow-xl">
                {searchResults.length === 0 ? (
                  <p className="py-4 text-center text-sm font-semibold text-pink-600">
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
                      <p className="mt-1 text-xs font-semibold text-pink-700">
                        Answer: {card.options[card.answer]} &bull; {card.topic}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50/50 p-5">
            <h3 className="text-lg font-extrabold text-pink-700">
              📋 About This App
            </h3>
            <p className="mt-2 text-sm font-semibold text-pink-700">
              BlushCards: Grammar Fun is an interactive flashcard quiz designed
              to help Grade 5 students master Subject-Verb Agreement in English.
              It includes 40 questions across three difficulty levels with
              instant feedback, star rewards, and full offline support.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-pink-700">
                  Owner
                </p>
                <p className="mt-1 text-sm font-extrabold text-pink-800">
                  Ma. Marella N. Reodeque
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-pink-700">
                  Teacher / Adviser
                </p>
                <p className="mt-1 text-sm font-extrabold text-pink-800">
                  Mr. Chael Villareal
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-pink-700">
                  School
                </p>
                <p className="mt-1 text-sm font-extrabold text-pink-800">
                  St. Anne Collage Lucena, Inc.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="h-6" />
    </div>
  );
}
