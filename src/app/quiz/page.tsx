"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";
import {
  FlashcardOptionKey,
  flashcardLevelMeta,
  getFlashcardsByLevel,
  getMasteryPercent,
  getStarsEarned,
  getBadge,
  normalizeLevel,
  shuffleCards,
  type Flashcard,
} from "../data/flashcard";
import {
  createDefaultLevelProgress,
  getRequiredScore,
  getUnlockRequirement,
  isLevelUnlocked,
  isPassed,
  readLevelProgress,
  recordLevelAttempt,
  type LevelProgressMap,
} from "../data/level-progress";

type WrongAnswer = {
  card: Flashcard;
  picked: FlashcardOptionKey;
};

type PersistedCardAnswer = {
  cardId: number;
  picked: FlashcardOptionKey;
};

type PersistedQuizState = {
  cardIds: number[];
  activeIndex: number;
  showBack: boolean;
  isShuffled: boolean;
  savedAt: number;
  answersByCard?: PersistedCardAnswer[];
  attemptRecorded?: boolean;
};

const BACKGROUND_MUSIC_URL = "/audio/background-audio.mp3";
const QUIZ_STATE_TTL_MS = 10 * 60 * 1000;

function formatQuestionBlank(text: string) {
  return text.replace(/_/g, "_______");
}

export default function QuizPage() {
  return (
    <Suspense fallback={<QuizLoadingShell />}>
      <QuizContent />
    </Suspense>
  );
}

function QuizContent() {
  const searchParams = useSearchParams();
  const level = normalizeLevel(searchParams.get("level"));
  const levelMeta = flashcardLevelMeta[level];
  const baseCards = getFlashcardsByLevel(level);
  const quizStateKey = `quiz-state-v2-${level}`;
  const [isAttemptRecorded, setIsAttemptRecorded] = useState(false);

  const [isHydrated, setIsHydrated] = useState(false);
  const [levelProgress, setLevelProgress] = useState<LevelProgressMap>(
    createDefaultLevelProgress,
  );
  const [isLevelProgressReady, setIsLevelProgressReady] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>(baseCards);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answersByCard, setAnswersByCard] = useState<
    Record<number, FlashcardOptionKey>
  >({});
  const [showBack, setShowBack] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [isMusicAvailable, setIsMusicAvailable] = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [starAnimation, setStarAnimation] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const preloadedImageSrcRef = useRef<Set<string>>(new Set());
  const completionPersistedRef = useRef(false);

  const levelUnlocked = isLevelProgressReady
    ? isLevelUnlocked(levelProgress, level)
    : true;
  const unlockRequirement = getUnlockRequirement(level);
  const unlockTarget =
    level === "easy" ? "medium" : level === "medium" ? "hard" : null;

  const activeCard = cards[activeIndex] ?? null;
  const selectedOption = activeCard
    ? (answersByCard[activeCard.id] ?? null)
    : null;
  const isAnswered = selectedOption !== null;
  const isLastCard = activeIndex >= cards.length - 1;
  const completedCards = cards.filter((card) => answersByCard[card.id]).length;
  const progressPercent =
    cards.length > 0 ? (completedCards / cards.length) * 100 : 0;
  const quizDone = isLastCard && isAnswered;
  const score = cards.reduce(
    (total, card) =>
      answersByCard[card.id] === card.answer ? total + 1 : total,
    0,
  );
  const wrongAnswers: WrongAnswer[] = cards.flatMap((card) => {
    const picked = answersByCard[card.id];
    if (!picked || picked === card.answer) {
      return [];
    }

    return [{ card, picked }];
  });
  const masteryPercent = getMasteryPercent(score, cards.length);
  const starsEarned = getStarsEarned(masteryPercent);
  const badge = getBadge(masteryPercent);
  const passingScore = getRequiredScore(cards.length);
  const didPassCurrentRun = isPassed(score, cards.length);

  useEffect(() => {
    setLevelProgress(readLevelProgress());
    setIsLevelProgressReady(true);
  }, []);

  function hasSameOrder(first: Flashcard[], second: Flashcard[]): boolean {
    if (first.length !== second.length) {
      return false;
    }

    return first.every((card, index) => card.id === second[index]?.id);
  }

  function getShuffledDeck(
    source: Flashcard[],
    previous: Flashcard[],
  ): Flashcard[] {
    if (source.length < 2) {
      return source;
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const shuffled = shuffleCards(source);
      if (!hasSameOrder(shuffled, previous)) {
        return shuffled;
      }
    }

    return [...source.slice(1), source[0]];
  }

  useEffect(() => {
    if (!isLevelProgressReady || !levelUnlocked) {
      return;
    }

    setIsHydrated(false);

    const cardsById = new Map(baseCards.map((card) => [card.id, card]));

    try {
      const raw = localStorage.getItem(quizStateKey);
      if (!raw) {
        throw new Error("no-saved-state");
      }

      const saved = JSON.parse(raw) as PersistedQuizState;
      if (
        typeof saved.savedAt !== "number" ||
        Date.now() - saved.savedAt > QUIZ_STATE_TTL_MS
      ) {
        localStorage.removeItem(quizStateKey);
        throw new Error("saved-state-expired");
      }

      const restoredCards = saved.cardIds
        .map((id) => cardsById.get(id))
        .filter((card): card is Flashcard => Boolean(card));

      const uniqueRestoredIds = new Set(restoredCards.map((card) => card.id));
      const missingCards = baseCards.filter(
        (card) => !uniqueRestoredIds.has(card.id),
      );
      const deck = [...restoredCards, ...missingCards];

      const maxIndex = Math.max(deck.length - 1, 0);
      const safeIndex = Math.min(Math.max(saved.activeIndex ?? 0, 0), maxIndex);
      const restoredAnswersByCard = Object.fromEntries(
        (saved.answersByCard ?? [])
          .map((item) => {
            const card = cardsById.get(item.cardId);
            if (!card) {
              return null;
            }

            return [card.id, item.picked] as const;
          })
          .filter((entry): entry is readonly [number, FlashcardOptionKey] =>
            Boolean(entry),
          ),
      ) as Record<number, FlashcardOptionKey>;

      const activeCardId = deck[safeIndex]?.id;

      setCards(deck.length > 0 ? deck : getShuffledDeck(baseCards, baseCards));
      setActiveIndex(safeIndex);
      setAnswersByCard(restoredAnswersByCard);
      setShowBack(
        Boolean(
          saved.showBack &&
          typeof activeCardId === "number" &&
          restoredAnswersByCard[activeCardId],
        ),
      );
      setIsAttemptRecorded(Boolean(saved.attemptRecorded));
      setIsShuffled(Boolean(saved.isShuffled));
      setShowReview(false);
      setImageFailed(false);
    } catch {
      setAnswersByCard({});
      setShowBack(false);
      setCards((previousCards) => getShuffledDeck(baseCards, previousCards));
      setActiveIndex(0);
      setShowReview(false);
      setIsShuffled(true);
      setIsAttemptRecorded(false);
      setImageFailed(false);
    }

    setIsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLevelProgressReady, level, levelUnlocked]);

  useEffect(() => {
    if (!isHydrated || !levelUnlocked) {
      return;
    }

    const state: PersistedQuizState = {
      cardIds: cards.map((card) => card.id),
      activeIndex,
      showBack,
      isShuffled,
      savedAt: Date.now(),
      answersByCard: Object.entries(answersByCard).map(([cardId, picked]) => ({
        cardId: Number(cardId),
        picked,
      })),
      attemptRecorded: isAttemptRecorded,
    };

    localStorage.setItem(quizStateKey, JSON.stringify(state));
  }, [
    activeIndex,
    cards,
    answersByCard,
    isHydrated,
    isAttemptRecorded,
    isShuffled,
    levelUnlocked,
    quizStateKey,
    showBack,
  ]);

  useEffect(() => {
    if (!isLevelProgressReady || !levelUnlocked) {
      completionPersistedRef.current = false;
      return;
    }

    if (!quizDone) {
      completionPersistedRef.current = false;
      return;
    }

    if (completionPersistedRef.current) {
      return;
    }

    if (isAttemptRecorded) {
      completionPersistedRef.current = true;
      return;
    }

    const updated = recordLevelAttempt(
      levelProgress,
      level,
      score,
      cards.length,
    );
    setLevelProgress(updated);
    setIsAttemptRecorded(true);
    completionPersistedRef.current = true;
  }, [
    cards.length,
    isAttemptRecorded,
    isLevelProgressReady,
    level,
    levelProgress,
    levelUnlocked,
    quizDone,
    score,
  ]);

  useEffect(() => {
    setImageFailed(false);
  }, [activeIndex]);

  useEffect(() => {
    if (!isHydrated || cards.length === 0) {
      return;
    }

    const preloadImage = (src?: string) => {
      if (!src || preloadedImageSrcRef.current.has(src)) {
        return;
      }

      preloadedImageSrcRef.current.add(src);
      const preloadTarget = new window.Image();
      preloadTarget.decoding = "async";
      preloadTarget.src = src;
    };

    const candidateIndexes = [
      activeIndex,
      activeIndex + 1,
      activeIndex + 2,
      activeIndex - 1,
    ];

    candidateIndexes.forEach((index) => {
      if (index < 0 || index >= cards.length) {
        return;
      }

      preloadImage(cards[index]?.imageSrc);
    });
  }, [activeIndex, cards, isHydrated]);

  useEffect(() => {
    const audio = new Audio(BACKGROUND_MUSIC_URL);
    audio.loop = true;
    audio.volume = 0.15;
    audio.preload = "none";
    audio.addEventListener("error", () => {
      setIsMusicOn(false);
      setIsMusicAvailable(false);
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggleMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !isMusicAvailable) return;
    if (isMusicOn) {
      audio.pause();
      setIsMusicOn(false);
      return;
    }
    try {
      await audio.play();
      setIsMusicOn(true);
    } catch {
      setIsMusicOn(false);
      setIsMusicAvailable(false);
    }
  }, [isMusicAvailable, isMusicOn]);

  function answer(option: FlashcardOptionKey) {
    if (!activeCard || isAnswered) return;
    const correct = option === activeCard.answer;
    setAnswersByCard((previousAnswers) => ({
      ...previousAnswers,
      [activeCard.id]: option,
    }));
    setShowBack(true);
    if (correct) {
      setStarAnimation(true);
      setTimeout(() => setStarAnimation(false), 600);
    }
    // Show confetti on last correct answer for perfect score
    if (correct && isLastCard && score + 1 === cards.length) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
  }

  function nextCard() {
    if (!isAnswered || isLastCard) return;
    setActiveIndex((c) => c + 1);
    setShowBack(false);
  }

  function prevCard() {
    if (activeIndex === 0) return;
    setActiveIndex((c) => c - 1);
    setShowBack(false);
  }

  function restart() {
    setActiveIndex(0);
    setAnswersByCard({});
    setShowBack(false);
    setShowReview(false);
    setShowConfetti(false);
    setIsAttemptRecorded(false);
    if (isShuffled) {
      setCards((previousCards) => getShuffledDeck(baseCards, previousCards));
    }
  }

  function resetProgress() {
    localStorage.removeItem(quizStateKey);
    setCards(getShuffledDeck(baseCards, baseCards));
    setActiveIndex(0);
    setAnswersByCard({});
    setShowBack(false);
    setIsShuffled(true);
    setShowReview(false);
    setShowConfetti(false);
    setIsAttemptRecorded(false);
    setImageFailed(false);
  }

  function flipCard() {
    if (!isAnswered) return;
    setShowBack((c) => !c);
  }

  function handleCardTap(event: MouseEvent<HTMLElement>) {
    if (!isAnswered) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) {
      return;
    }

    setShowBack((c) => !c);
  }

  function handleCardTouchStart(event: TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) {
      touchStartXRef.current = null;
      return;
    }

    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleCardTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!isAnswered) return;

    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (startX === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX;
    if (typeof endX !== "number") {
      return;
    }

    if (Math.abs(endX - startX) >= 40) {
      setShowBack((c) => !c);
    }
  }

  if (!isLevelProgressReady) return <QuizLoadingShell />;

  if (!levelUnlocked) {
    const requiredLevel = unlockRequirement
      ? flashcardLevelMeta[unlockRequirement]
      : null;
    const requiredProgress = unlockRequirement
      ? levelProgress[unlockRequirement]
      : null;
    const requiredScore = requiredLevel
      ? getRequiredScore(requiredLevel.itemCount)
      : 0;

    return (
      <div className="safe-area-content flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="w-full max-w-md rounded-3xl border-2 border-pink-200 bg-white p-5 text-center shadow-xl sm:p-6">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-3 text-2xl font-black text-pink-800 sm:text-3xl">
            {levelMeta.label} Level Locked
          </h1>
          {requiredLevel ? (
            <p className="mt-2 rounded-2xl bg-pink-50 px-4 py-3 text-sm font-bold text-pink-700">
              Pass <span className="font-black">{requiredLevel.label}</span>{" "}
              first with at least{" "}
              <span className="font-black">
                {requiredScore}/{requiredLevel.itemCount}
              </span>
              .
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-pink-700">
              Complete previous levels first.
            </p>
          )}

          {requiredLevel && requiredProgress && (
            <div className="mt-3 rounded-2xl border-2 border-pink-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-pink-600">
                Your best in {requiredLevel.label}
              </p>
              <p className="mt-1 text-2xl font-black text-pink-700">
                {requiredProgress.bestScore}/{requiredLevel.itemCount}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {requiredLevel && unlockRequirement && (
              <Link
                href={`/quiz?level=${unlockRequirement}`}
                className="inline-flex min-h-11.5 items-center justify-center rounded-2xl bg-pink-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-600 active:scale-[0.99]"
              >
                Play {requiredLevel.label} Now ▶
              </Link>
            )}
            <Link
              href="/levels"
              className="inline-flex min-h-11.5 items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99]"
            >
              ← All Levels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isHydrated) return <QuizLoadingShell />;

  // ─── Offline / empty data fallback ───
  if (cards.length === 0) {
    return (
      <div className="safe-area-content flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="w-full max-w-md rounded-3xl border-2 border-pink-200 bg-white p-6 text-center shadow-xl">
          <p className="text-5xl">📴</p>
          <h1 className="mt-4 text-2xl font-black text-pink-800">
            No Cards Available
          </h1>
          <p className="mt-2 text-sm font-semibold text-pink-700">
            The flashcard data couldn&apos;t load. This may happen if the app
            hasn&apos;t finished caching for offline use.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11.5 rounded-2xl bg-pink-500 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-600 active:scale-[0.99]"
            >
              Try Again 🔄
            </button>
            <Link
              href="/levels"
              className="inline-flex min-h-11.5 items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99]"
            >
              ← All Levels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Review Wrong Answers View ───
  if (showReview) {
    return (
      <div className="safe-area-content min-h-screen bg-background px-3 py-5 text-foreground sm:px-4 sm:py-8">
        <main className="mx-auto w-full max-w-4xl">
          <div className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-black text-pink-800 sm:text-3xl">
                📝 Review Mistakes
              </h1>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="min-h-11 rounded-2xl bg-pink-500 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-pink-600 active:scale-[0.99]"
              >
                ← Back to Results
              </button>
            </div>

            {wrongAnswers.length === 0 ? (
              <div className="rounded-2xl bg-green-50 p-6 text-center">
                <p className="text-4xl">🎉</p>
                <p className="mt-2 text-lg font-black text-green-700">
                  Perfect score! No mistakes!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {wrongAnswers.map((w, i) => (
                  <div
                    key={w.card.id}
                    className="animate-slide-up rounded-2xl border-2 border-pink-200 bg-pink-50/50 p-5"
                    style={{
                      animationDelay: `${i * 0.05}s`,
                      animationFillMode: "both",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-black text-pink-800">
                        Q{i + 1}: {formatQuestionBlank(w.card.front)}
                      </p>
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
                        ✗ Wrong
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-bold uppercase text-red-400">
                          Your answer
                        </p>
                        <p className="mt-1 text-sm font-bold text-red-700">
                          {w.picked.toUpperCase()}. {w.card.options[w.picked]}
                        </p>
                      </div>
                      <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                        <p className="text-xs font-bold uppercase text-green-500">
                          Correct answer
                        </p>
                        <p className="mt-1 text-sm font-bold text-green-700">
                          {w.card.answer.toUpperCase()}.{" "}
                          {w.card.options[w.card.answer]}
                        </p>
                      </div>
                    </div>
                    {w.card.explanation && (
                      <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-pink-700">
                        💡 {w.card.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={restart}
                className="inline-flex min-h-11.5 items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 active:scale-[0.99]"
              >
                Try Again 🔄
              </button>
              <Link
                href="/levels"
                className="inline-flex min-h-11.5 items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99]"
              >
                All Levels 📚
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="safe-area-content flex min-h-dvh flex-col bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8">
      {/* Confetti */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="animate-confetti absolute text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
              }}
            >
              {["🌸", "⭐", "💖", "🎀", "✨"][i % 5]}
            </span>
          ))}
        </div>
      )}

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center sm:justify-start">
        {/* ─── Header ─── */}
        <header className="mb-3 rounded-2xl border-2 border-pink-200 bg-white px-3 py-2 shadow-sm sm:mb-6 sm:rounded-3xl sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/levels"
              className="inline-flex min-h-10.5 shrink-0 items-center gap-1.5 rounded-xl bg-pink-500 px-3.5 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-pink-600 active:scale-[0.99] sm:px-4"
            >
              ← Levels
            </Link>
            <p className="min-w-0 truncate rounded-full bg-pink-100 px-2.5 py-1 text-xs font-extrabold text-pink-800 sm:px-3 sm:text-sm">
              {levelMeta.label} • {Math.min(activeIndex + 1, cards.length)}/
              {cards.length}
              {isShuffled && " 🔀"}
            </p>

            <div className="flex shrink-0 items-center gap-1.5">
              <div
                className={`flex items-center gap-0.5 rounded-xl border border-pink-200 bg-pink-50 px-2 py-1 ${starAnimation ? "animate-bounce-star" : ""}`}
              >
                <span className="text-sm">⭐</span>
                <span className="text-xs font-extrabold text-pink-700">
                  {score}/{cards.length}
                </span>
              </div>

              <button
                type="button"
                onClick={toggleMusic}
                disabled={!isMusicAvailable}
                className="min-h-10 rounded-xl border-2 border-pink-200 bg-pink-50 px-2.5 py-1.5 text-sm transition hover:bg-pink-100 disabled:opacity-50"
                aria-label={isMusicOn ? "Mute music" : "Play music"}
              >
                {isMusicAvailable ? (isMusicOn ? "🔊" : "🔇") : "🚫"}
              </button>
            </div>
          </div>
        </header>

        {/* ─── Main Card Area ─── */}
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-lg sm:p-6">
          {/* Title and badge */}
          <div className="mb-2 flex items-center justify-between gap-2 sm:mb-5">
            <h1 className="text-lg font-black text-pink-800 sm:text-3xl">
              {levelMeta.label} Level
            </h1>
            <span className="hidden rounded-full border-2 border-pink-300 bg-pink-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-pink-800 sm:inline-block sm:text-sm">
              Grade 5 English
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-pink-100 sm:h-3">
              <div
                className="h-full rounded-full bg-linear-to-r from-pink-500 to-pink-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-pink-700">
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* ─── Flashcard ─── */}
          <article className="mx-auto w-full max-w-3xl">
            <div className="relative sm:pb-2">
              {/* Stacked card effect (desktop only) */}
              <div className="pointer-events-none absolute inset-x-3 top-2 hidden h-full rounded-3xl border border-pink-200 bg-pink-100/50 sm:block" />
              <div className="pointer-events-none absolute inset-x-1.5 top-1 hidden h-full rounded-3xl border border-pink-200 bg-white/80 sm:block" />

              <section
                key={`${activeIndex}-${showBack ? "back" : "front"}`}
                className="study-card animate-card-flip relative rounded-2xl border-2 border-pink-300 bg-white p-3 shadow-2xl sm:min-h-96 sm:rounded-3xl sm:p-8"
                onClick={handleCardTap}
                onTouchStart={handleCardTouchStart}
                onTouchEnd={handleCardTouchEnd}
                onKeyDown={(event) => {
                  if (!isAnswered) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setShowBack((c) => !c);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Flashcard. Tap, swipe, or press Enter to flip after answering."
              >
                {/* Card face label */}
                <div className="mb-2 flex items-center justify-between sm:mb-5">
                  <p className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-pink-800 sm:px-3 sm:py-1">
                    {showBack ? "✨ Answer" : "📖 Question"}
                  </p>
                  {isAnswered && (
                    <span className="text-xs font-semibold text-pink-700 sm:text-sm">
                      Tap or swipe to flip
                    </span>
                  )}
                </div>

                {!activeCard ? (
                  <div className="grid min-h-80 place-items-center text-center">
                    <div>
                      <p className="text-2xl font-black text-pink-800">
                        No cards found
                      </p>
                      <p className="mt-2 text-sm font-semibold text-pink-700">
                        Please pick another level.
                      </p>
                    </div>
                  </div>
                ) : !showBack ? (
                  <>
                    <div className="mb-3 grid min-h-20 place-items-center rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50 p-2 text-center sm:mb-4 sm:min-h-28 sm:p-3">
                      {activeCard.imageSrc && !imageFailed ? (
                        <Image
                          src={activeCard.imageSrc}
                          alt={`Question ${activeCard.id} illustration`}
                          width={640}
                          height={360}
                          sizes="(max-width: 640px) 100vw, 640px"
                          unoptimized
                          loading="eager"
                          fetchPriority="high"
                          priority={activeIndex === 0}
                          onError={() => setImageFailed(true)}
                          className="h-28 w-full rounded-xl object-contain sm:h-40"
                        />
                      ) : (
                        <div>
                          <p className="text-3xl">�</p>
                          <p className="mt-1 text-xs font-bold text-pink-700">
                            Picture not available
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Question */}
                    <p className="text-lg font-black leading-snug text-pink-900 sm:text-3xl">
                      {formatQuestionBlank(activeCard.front)}
                    </p>

                    {/* Options */}
                    <div className="mt-4 grid gap-2 sm:mt-7 sm:gap-3">
                      {(
                        Object.entries(activeCard.options) as [
                          FlashcardOptionKey,
                          string,
                        ][]
                      ).map(([optionKey, value]) => {
                        const isCorrect = optionKey === activeCard.answer;
                        const isPicked = selectedOption === optionKey;

                        let style =
                          "border-pink-200 hover:border-pink-400 hover:bg-pink-50";
                        if (isAnswered && isCorrect) {
                          style = "border-green-400 bg-green-50 text-green-700";
                        } else if (isAnswered && isPicked && !isCorrect) {
                          style = "border-red-400 bg-red-50 text-red-600";
                        }

                        return (
                          <button
                            key={optionKey}
                            type="button"
                            onClick={() => answer(optionKey)}
                            disabled={isAnswered}
                            className={`rounded-2xl border-2 bg-white px-3 py-3 text-left text-sm font-semibold transition sm:px-4 sm:py-4 sm:text-base ${style} ${
                              isAnswered ? "cursor-default" : "cursor-pointer"
                            } ${isAnswered && isCorrect ? "animate-pop-in" : ""} ${isAnswered && isPicked && !isCorrect ? "animate-shake" : ""}`}
                          >
                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-xs font-black uppercase text-pink-800 sm:mr-3 sm:h-7 sm:w-7 sm:text-sm">
                              {optionKey}
                            </span>
                            {value}
                            {isAnswered && isCorrect && (
                              <span className="ml-2">✅</span>
                            )}
                            {isAnswered && isPicked && !isCorrect && (
                              <span className="ml-2">❌</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {!isAnswered && (
                      <p className="mt-2 text-xs font-semibold text-pink-700 sm:mt-5 sm:text-sm">
                        Pick an answer ✨
                      </p>
                    )}
                  </>
                ) : (
                  /* ─── Back of Card ─── */
                  <div className="flex h-full flex-col justify-between gap-4 sm:gap-6">
                    <div>
                      <p className="text-base font-extrabold text-pink-600 sm:text-lg">
                        Correct Answer
                      </p>
                      <p className="mt-1 text-xl font-black text-pink-800 sm:text-4xl">
                        {activeCard.answer.toUpperCase()}.{" "}
                        {activeCard.options[activeCard.answer]}
                      </p>

                      <div
                        className={`mt-3 rounded-2xl border-2 p-3 sm:mt-6 sm:p-5 ${
                          selectedOption === activeCard?.answer
                            ? "border-green-300 bg-green-50"
                            : "border-red-300 bg-red-50"
                        }`}
                      >
                        <p className="text-base font-extrabold">
                          {selectedOption === activeCard?.answer
                            ? "✅ You got it right!"
                            : "❌ Not quite right"}
                        </p>
                        <p className="mt-2 text-sm font-semibold opacity-85">
                          {activeCard.explanation ??
                            "Review the sentence and subject agreement rule."}
                        </p>
                      </div>

                      {/* Star earned indicator */}
                      {selectedOption === activeCard?.answer && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-2 sm:mt-4 sm:p-3">
                          <span className="animate-bounce-star text-2xl">
                            ⭐
                          </span>
                          <span className="text-sm font-bold text-yellow-700">
                            +1 Star earned!
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-pink-700 sm:text-sm">
                      Flip to see question, or Next →
                    </p>
                  </div>
                )}
              </section>
            </div>
          </article>

          {/* ─── Navigation Controls ─── */}
          <div className="mx-auto mt-4 w-full max-w-3xl sm:mt-6">
            <div className="grid grid-cols-1 gap-2 rounded-2xl border-2 border-pink-200 bg-pink-50 p-2 sm:grid-cols-3 sm:gap-2 sm:p-3">
              <button
                type="button"
                onClick={prevCard}
                disabled={activeIndex === 0}
                className="min-h-11 w-full rounded-xl border-2 border-pink-300 bg-white px-3 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] disabled:opacity-40 sm:rounded-2xl"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={flipCard}
                disabled={!isAnswered}
                className="min-h-11 w-full rounded-xl border-2 border-pink-300 bg-white px-3 py-2.5 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] disabled:opacity-40 sm:rounded-2xl"
              >
                {showBack ? "Question" : "Flip"} 🔄
              </button>
              <button
                type="button"
                onClick={nextCard}
                disabled={!isAnswered || isLastCard}
                className="min-h-11 w-full rounded-xl bg-linear-to-r from-pink-500 to-pink-400 px-3 py-2.5 text-sm font-extrabold text-white shadow-md shadow-pink-500/25 transition hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-40 sm:rounded-2xl"
              >
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="mt-2 min-h-11 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-50 hover:text-pink-800 active:scale-[0.99]"
            >
              🗑️ Reset Progress & Shuffle
            </button>
          </div>

          {showResetConfirm && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-pink-900/35 px-4">
              <div className="w-full max-w-sm rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-2xl sm:p-6">
                <h3 className="text-lg font-black text-pink-800 sm:text-xl">
                  Reset progress?
                </h3>
                <p className="mt-2 text-sm font-semibold text-pink-700">
                  This will clear your saved progress for this level and
                  reshuffle the cards.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="min-h-11 rounded-xl border-2 border-pink-200 bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetProgress();
                      setShowResetConfirm(false);
                    }}
                    className="min-h-11 rounded-xl bg-pink-500 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-pink-600 active:scale-[0.99]"
                  >
                    Yes, Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Quiz Complete Panel ─── */}
          {quizDone && (
            <div className="mx-auto mt-6 w-full max-w-3xl animate-pop-in rounded-3xl border-2 border-pink-300 bg-linear-to-b from-pink-50 to-white p-6 text-center shadow-lg">
              {/* Badge */}
              <div className="mb-3 text-5xl">{badge.emoji}</div>
              <h2 className="text-2xl font-black text-pink-800">
                {badge.label}
              </h2>

              {/* Stars */}
              <div className="mt-3 flex items-center justify-center gap-1">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`text-3xl ${n <= starsEarned ? "animate-bounce-star" : "opacity-30"}`}
                    style={{ animationDelay: `${n * 0.15}s` }}
                  >
                    ⭐
                  </span>
                ))}
              </div>

              {/* Score */}
              <div className="mt-4 rounded-2xl border-2 border-pink-200 bg-white p-4">
                <p className="text-sm font-bold text-pink-700">Mastery Score</p>
                <p className="mt-1 text-4xl font-black text-pink-700">
                  {masteryPercent}%
                </p>
                <p className="mt-1 text-sm font-semibold text-pink-700">
                  {score} out of {cards.length} correct
                </p>
              </div>

              <div
                className={`mt-3 rounded-2xl border-2 p-4 text-left ${
                  didPassCurrentRun
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-pink-200 bg-pink-50 text-pink-700"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide">
                  Pass Mark
                </p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5">
                  <p className="text-sm font-bold">Need</p>
                  <p className="text-xl font-black">
                    {passingScore}/{cards.length}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5">
                  <p className="text-sm font-bold">You got</p>
                  <p className="text-xl font-black">
                    {score}/{cards.length}
                  </p>
                </div>
                <p className="mt-3 text-sm font-extrabold">
                  {didPassCurrentRun
                    ? "🎉 Awesome! You passed this level."
                    : "💪 Nice try! Play again to beat the pass mark."}
                  {didPassCurrentRun && unlockTarget
                    ? ` ${flashcardLevelMeta[unlockTarget].label} is now unlocked.`
                    : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-5 grid w-full gap-2.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
                {didPassCurrentRun && unlockTarget && (
                  <Link
                    href={`/quiz?level=${unlockTarget}`}
                    className="inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-pink-400 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 active:scale-[0.99] sm:w-auto"
                  >
                    Next Level: {flashcardLevelMeta[unlockTarget].label} ▶
                  </Link>
                )}
                <button
                  type="button"
                  onClick={restart}
                  className={`inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl px-6 py-3 text-sm font-extrabold transition active:scale-[0.99] sm:w-auto ${
                    didPassCurrentRun && unlockTarget
                      ? "border-2 border-pink-300 bg-pink-50 text-pink-600 hover:bg-pink-100"
                      : "bg-linear-to-r from-pink-500 to-pink-400 text-white shadow-lg shadow-pink-500/25 hover:-translate-y-0.5"
                  }`}
                >
                  Play Again 🔄
                </button>
                {wrongAnswers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowReview(true)}
                    className="inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-pink-50 px-6 py-3 text-sm font-bold text-pink-600 transition hover:bg-pink-100 active:scale-[0.99] sm:w-auto"
                  >
                    Review Mistakes 📝
                  </button>
                )}
                <Link
                  href="/levels"
                  className="inline-flex min-h-11.5 w-full items-center justify-center rounded-2xl border-2 border-pink-300 bg-white px-6 py-3 text-sm font-bold text-pink-600 transition hover:bg-pink-50 active:scale-[0.99] sm:w-auto"
                >
                  All Levels 📚
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <div className="h-6" />
    </div>
  );
}

function QuizLoadingShell() {
  return (
    <div className="safe-area-content min-h-screen bg-background px-4 py-8 text-foreground sm:py-10">
      <main className="mx-auto w-full max-w-4xl">
        <section className="rounded-3xl border-2 border-pink-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-pink-100" />
          <div className="mt-6 h-96 animate-pulse rounded-3xl bg-pink-50" />
        </section>
      </main>
    </div>
  );
}
