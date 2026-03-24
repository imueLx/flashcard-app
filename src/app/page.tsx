"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flashcardLevelMeta, type FlashcardLevel } from "./data/flashcard";
import {
  readLevelProgress,
  type LevelProgressMap,
} from "./data/level-progress";
import {
  getStudentName,
  hasStudentName,
  setStudentName,
} from "./data/student-attempt";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type WindowWithInstallPrompt = Window & {
  __deferredInstallPrompt?: InstallPromptEvent | null;
};

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function hasDeferredInstallPrompt() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as WindowWithInstallPrompt).__deferredInstallPrompt);
}

export default function Home() {
  const router = useRouter();
  const deferredPromptRef = useRef<InstallPromptEvent | null>(null);
  const platformRef = useRef<"ios" | "android" | "desktop">("desktop");
  const studentNameInputRef = useRef<HTMLInputElement | null>(null);

  const [canPromptInstall, setCanPromptInstall] = useState(
    hasDeferredInstallPrompt,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [installHint, setInstallHint] = useState("");
  const [isPreparingInstall, setIsPreparingInstall] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandaloneMode] = useState(isStandaloneDisplayMode);

  const [levelProgress, setLevelProgress] =
    useState<LevelProgressMap>(readLevelProgress);
  const [studentName, setStudentNameState] = useState(getStudentName);
  const [nameError, setNameError] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("requiredName") === "1" && !hasStudentName(getStudentName())
      ? "Enter your name or nickname before starting a quiz."
      : "";
  });

  const isInstalledOrStandalone = isInstalled || isStandaloneMode;
  const hasSavedStudentName = hasStudentName(studentName);

  const progressSummary = useMemo(() => {
    const nextLevel: FlashcardLevel = !levelProgress.easy.passed
      ? "easy"
      : !levelProgress.medium.passed
        ? "medium"
        : "hard";

    const continueLabel =
      levelProgress[nextLevel].attempts > 0
        ? `Continue ${flashcardLevelMeta[nextLevel].label}`
        : `Start ${flashcardLevelMeta[nextLevel].label}`;

    return {
      nextLevel,
      continueLabel,
    };
  }, [levelProgress]);

  const startLearningHref = `/quiz?level=${progressSummary.nextLevel}`;
  const startLearningLabel = progressSummary.continueLabel;

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      platformRef.current = "ios";
    } else if (/android/.test(ua)) {
      platformRef.current = "android";
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setLevelProgress(readLevelProgress());
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cleanupServiceWorkerListener = () => {};

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          setInstallHint("Service worker unavailable. Check browser settings.");
        }
      });

      const onControllerChange = () => {};
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

  function saveStudentNameValue() {
    const saved = setStudentName(studentName);
    setStudentNameState(saved);
    return saved;
  }

  function requireStudentName() {
    const saved = saveStudentNameValue();
    if (hasStudentName(saved)) {
      setNameError("");
      return true;
    }

    setNameError("Enter your name or nickname before starting a quiz.");
    studentNameInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    studentNameInputRef.current?.focus();
    return false;
  }

  function startQuiz(levelHref: string) {
    if (!requireStudentName()) {
      return;
    }

    router.push(levelHref);
  }

  function openLevels() {
    if (!requireStudentName()) {
      return;
    }

    router.push("/levels");
  }

  async function installApp() {
    if (!window.isSecureContext) {
      setInstallHint(
        "To install the app, open this on a secure link (https). Ask a parent or teacher for help.",
      );
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
        setInstallHint("Awesome! BlushCards is now on your home screen 🎉");
      } else {
        setInstallHint("No problem! You can tap Install App again anytime.");
      }
      return;
    }

    if (platformRef.current !== "ios") {
      setIsPreparingInstall(true);
      setInstallHint("Getting your install button ready...");
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
          setInstallHint("Awesome! BlushCards is now on your home screen 🎉");
        } else {
          setInstallHint("No problem! You can tap Install App again anytime.");
        }
        return;
      }
    }

    if (platformRef.current !== "ios" && !canPromptInstall) {
      setInstallHint(
        "I can't show the install pop-up here, so follow the steps below.",
      );
    }

    const platform = platformRef.current;

    if (platform === "ios") {
      setShowIOSGuide(true);
      return;
    }

    if (platform === "android") {
      setInstallHint(
        'Android steps: tap menu (⋮) in your browser, then tap "Install app" or "Add to Home screen".',
      );
      return;
    }

    setInstallHint(
      'Computer steps: in Chrome or Edge, click the install icon (⊕) in the address bar, or open menu → "Install app".',
    );
  }

  const displayName = studentName.trim() || "Learner";

  return (
    <div className="safe-area-content min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-8">
      {!isInstalledOrStandalone && (
        <section className="mx-auto mb-4 max-w-6xl rounded-3xl border-2 border-pink-200 bg-linear-to-r from-pink-100 via-white to-pink-50 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-pink-600">
                Install App
              </p>
              <h2 className="mt-1 text-lg font-black text-pink-900 sm:text-2xl">
                Study even without internet
              </h2>
              <p className="mt-1 text-sm font-semibold text-pink-700">
                Add BlushCards to your home screen and use offline anytime.
              </p>
            </div>

            <button
              type="button"
              onClick={installApp}
              disabled={isPreparingInstall}
              className="install-pulse min-h-12 rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
            >
              {isPreparingInstall
                ? "Preparing Install..."
                : canPromptInstall
                  ? "Install App"
                  : "Show Install Steps"}
            </button>
          </div>

          {installHint && (
            <p className="mt-2 text-sm font-semibold text-pink-700">
              {installHint}
            </p>
          )}
        </section>
      )}

      {isInstalledOrStandalone && (
        <section className="mx-auto mb-4 max-w-6xl rounded-2xl border-2 border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">
          App installed. You are ready to learn offline.
        </section>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-pink-900/40 px-4 pb-6 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm animate-slide-up rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-2xl sm:p-6">
            <h3 className="text-lg font-black text-pink-800">
              Install on iPhone / iPad 📱
            </h3>
            <p className="mt-2 text-sm font-semibold text-pink-700">
              Follow these easy steps. You can ask a parent, guardian, or
              teacher to help.
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-black text-white">
                  1
                </span>
                <p className="text-sm font-semibold text-pink-700">
                  Open this page in <strong>Safari</strong>, then tap the{" "}
                  <strong>Share</strong> button{" "}
                  <span className="inline-block text-lg leading-none">⎋</span>{" "}
                  at the bottom.
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
                  Tap <strong>&quot;Add&quot;</strong>. Done! You can open
                  BlushCards from your home screen.
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
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-xl sm:p-8">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
            <article className="rounded-3xl border-2 border-pink-200 bg-linear-to-b from-pink-50 via-white to-pink-50 p-5 sm:p-7">
              <p className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-pink-700">
                <span className="animate-sparkle">✨</span>
                BlushCards
              </p>

              <h1 className="mt-3 text-3xl font-black leading-tight text-pink-900 sm:text-5xl">
                Learn Grammar the Fun Way
              </h1>

              <p className="mt-3 max-w-xl text-sm font-semibold text-pink-800 sm:text-lg">
                Tap Start Learning, answer flashcards, and collect stars while
                you level up.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-bold text-pink-700">
                  🎯 Quick lessons
                </span>
                <span className="rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-bold text-pink-700">
                  📴 Works offline
                </span>
                <span className="rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-bold text-pink-700">
                  ⭐ Earn rewards
                </span>
              </div>

              <div className="mt-6 grid gap-2.5 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => startQuiz(startLearningHref)}
                  className="animate-pulse-glow inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3 text-base font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 active:scale-[0.99] sm:w-auto"
                >
                  Start Learning 🚀
                </button>
                <button
                  type="button"
                  onClick={openLevels}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3 text-base font-bold text-pink-700 transition hover:bg-pink-100 active:scale-[0.99] sm:w-auto"
                >
                  View Levels
                </button>
              </div>

              <p className="mt-3 text-sm font-semibold text-pink-700">
                {startLearningLabel} to keep your progress going.
              </p>
            </article>

            <aside className="pink-gradient-subtle rounded-3xl border-2 border-pink-200 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-pink-600">
                    Student Card
                  </p>
                  <h2 className="mt-1 text-xl font-black text-pink-900">
                    Hi, {displayName}! 🌟
                  </h2>
                </div>
                <div className="animate-float text-4xl">🧸</div>
              </div>

              <div className="mt-4 rounded-2xl border-2 border-pink-200 bg-white p-3">
                <label
                  htmlFor="student-name"
                  className="text-xs font-extrabold uppercase tracking-wide text-pink-600"
                >
                  Student Name
                </label>
                <input
                  ref={studentNameInputRef}
                  id="student-name"
                  type="text"
                  value={studentName}
                  onChange={(event) => {
                    setStudentNameState(event.target.value);
                    if (nameError) {
                      setNameError("");
                    }
                  }}
                  onBlur={saveStudentNameValue}
                  placeholder="Type your name"
                  aria-invalid={nameError ? "true" : "false"}
                  className={`mt-2 w-full rounded-xl border-2 bg-pink-50 px-3 py-2.5 text-sm font-semibold text-pink-800 outline-none transition focus:border-pink-400 ${
                    nameError ? "border-red-300" : "border-pink-200"
                  }`}
                />
                {nameError && (
                  <p className="mt-2 text-xs font-bold text-red-500">
                    {nameError}
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2 rounded-2xl border border-pink-200 bg-white p-3 text-center">
                  <p className="text-sm font-bold text-pink-700">
                    {hasSavedStudentName
                      ? "Ready for today's lesson? Let's learn one step at a time."
                      : "Add your name or nickname first, then you can start your quiz."}
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <section className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-pink-600">
                Continue Lesson
              </p>
              <h3 className="mt-2 text-lg font-black text-pink-900">
                {flashcardLevelMeta[progressSummary.nextLevel].label} Level
              </h3>
              <p className="mt-1 text-sm font-semibold text-pink-700">
                Pick up where you left off.
              </p>
              <button
                type="button"
                onClick={() => startQuiz(startLearningHref)}
                className="mt-4 inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl bg-pink-500 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-pink-600 active:scale-[0.99]"
              >
                Continue ▶
              </button>
            </article>

            <article className="rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-pink-600">
                Browse Levels
              </p>
              <h3 className="mt-2 text-lg font-black text-pink-900">
                Easy, Medium, Hard
              </h3>
              <p className="mt-1 text-sm font-semibold text-pink-700">
                Choose your challenge and unlock new cards.
              </p>
              <button
                type="button"
                onClick={openLevels}
                className="mt-4 inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-4 py-2.5 text-sm font-bold text-pink-700 transition hover:bg-pink-100 active:scale-[0.99]"
              >
                Open Levels
              </button>
            </article>
          </section>

          <footer className="mt-4 rounded-2xl border border-pink-200 bg-pink-50/70 p-3 text-center text-xs font-semibold text-pink-700">
            Tap Start Learning to begin. Short lessons, instant feedback, and
            offline reliability built for kids.
          </footer>
        </section>
      </main>

      <div className="h-6" />
    </div>
  );
}
