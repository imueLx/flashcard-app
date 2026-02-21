// data/flashcards.ts
// Converted from your DOCX table (Cards 1–40). [file:16]

export type FlashcardOptionKey = "a" | "b" | "c";
export type FlashcardLevel = "easy" | "medium" | "hard";

export type Flashcard = {
  id: number;
  front: string;
  options: Record<FlashcardOptionKey, string>;
  answer: FlashcardOptionKey;
  explanation?: string;
  topic?: string;
  grade?: string;
  imageSrc?: string;
};

export const flashcardLevels: FlashcardLevel[] = ["easy", "medium", "hard"];

export const flashcardLevelMeta: Record<
  FlashcardLevel,
  {
    label: string;
    subtitle: string;
    itemCount: number;
  }
> = {
  easy: {
    label: "Easy",
    subtitle: "5 questions",
    itemCount: 5,
  },
  medium: {
    label: "Medium",
    subtitle: "10 questions",
    itemCount: 10,
  },
  hard: {
    label: "Hard",
    subtitle: "15 questions",
    itemCount: 15,
  },
};

const topic = "Subject–Verb Agreement";
const grade = "Grade 5";

export const flashcards: Flashcard[] = [
  {
    id: 1,
    front: "The boy _ to school every day.",
    options: { a: "walk", b: "walks", c: "walking" },
    answer: "b",
    explanation: '"boy" is singular, so we use "walks."',
    topic,
    grade,
  },
  {
    id: 2,
    front: "The girls _ in the playground.",
    options: { a: "plays", b: "play", c: "played" },
    answer: "b",
    explanation: '"girls" is plural, so we use "play."',
    topic,
    grade,
  },
  {
    id: 3,
    front: "She _ milk every morning.",
    options: { a: "drink", b: "drinks", c: "drinking" },
    answer: "b",
    explanation: '"she" is singular, so "drinks" is correct.',
    topic,
    grade,
  },
  {
    id: 4,
    front: "They _ basketball after class.",
    options: { a: "plays", b: "play", c: "playing" },
    answer: "b",
    explanation: '"they" is plural.',
    topic,
    grade,
  },
  {
    id: 5,
    front: "My mother _ delicious food.",
    options: { a: "cook", b: "cooks", c: "cooking" },
    answer: "b",
    explanation: 'Singular subject "mother."',
    topic,
    grade,
  },
  {
    id: 6,
    front: "The dogs _ loudly at night.",
    options: { a: "bark", b: "barks", c: "barking" },
    answer: "a",
    explanation: 'Plural subject "dogs."',
    topic,
    grade,
  },
  {
    id: 7,
    front: "He _ his homework before dinner.",
    options: { a: "finish", b: "finishes", c: "finishing" },
    answer: "b",
    explanation: 'Singular subject "he."',
    topic,
    grade,
  },
  {
    id: 8,
    front: "I _ happy today.",
    options: { a: "is", b: "am", c: "are" },
    answer: "b",
    explanation: 'First-person singular uses "am."',
    topic,
    grade,
  },
  {
    id: 9,
    front: "You _ very kind.",
    options: { a: "is", b: "are", c: "am" },
    answer: "b",
    explanation: '"you" always takes "are."',
    topic,
    grade,
  },
  {
    id: 10,
    front: "The cat _ on the sofa.",
    options: { a: "sleep", b: "sleeps", c: "sleeping" },
    answer: "b",
    explanation: 'Singular "cat."',
    topic,
    grade,
  },
  {
    id: 11,
    front: "The students _ their books.",
    options: { a: "opens", b: "open", c: "opening" },
    answer: "b",
    explanation: 'Plural subject "students."',
    topic,
    grade,
  },
  {
    id: 12,
    front: "My teacher _ us new lessons.",
    options: { a: "teach", b: "teaches", c: "teaching" },
    answer: "b",
    explanation: 'Singular "teacher."',
    topic,
    grade,
  },
  {
    id: 13,
    front: "We _ early in the morning.",
    options: { a: "wakes", b: "wake", c: "waking" },
    answer: "b",
    explanation: 'Plural subject "we."',
    topic,
    grade,
  },
  {
    id: 14,
    front: "It _ a lot during the rainy season.",
    options: { a: "rain", b: "rains", c: "raining" },
    answer: "b",
    explanation: 'Singular subject "it."',
    topic,
    grade,
  },
  {
    id: 15,
    front: "The birds _ in the sky.",
    options: { a: "flies", b: "fly", c: "flying" },
    answer: "b",
    explanation: 'Plural subject "birds."',
    topic,
    grade,
  },
  {
    id: 16,
    front: "She _ to school.",
    options: { a: "walk", b: "walks", c: "walking" },
    answer: "b",
    explanation: 'Singular "she."',
    topic,
    grade,
  },
  {
    id: 17,
    front: "The boys _ outside.",
    options: { a: "plays", b: "playing", c: "play" },
    answer: "c",
    explanation: 'Plural subject "boys."',
    topic,
    grade,
  },
  {
    id: 18,
    front: "Everyone _ excited.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: '"everyone" is singular.',
    topic,
    grade,
  },
  {
    id: 19,
    front: "Ana and Mia _ friends.",
    options: { a: "is", b: "are", c: "be" },
    answer: "b",
    explanation: "Compound subject is plural.",
    topic,
    grade,
  },
  {
    id: 20,
    front: "He _ breakfast early.",
    options: { a: "eat", b: "eats", c: "eating" },
    answer: "b",
    explanation: 'Singular "he."',
    topic,
    grade,
  },
  {
    id: 21,
    front: "The dog _ loudly.",
    options: { a: "bark", b: "barking", c: "barks" },
    answer: "c",
    explanation: 'Singular "dog."',
    topic,
    grade,
  },
  {
    id: 22,
    front: "We _ ready for the test.",
    options: { a: "is", b: "are", c: "am" },
    answer: "b",
    explanation: 'Plural "we."',
    topic,
    grade,
  },
  {
    id: 23,
    front: "Nobody _ the answer.",
    options: { a: "know", b: "knows", c: "knowing" },
    answer: "b",
    explanation: 'Singular "nobody."',
    topic,
    grade,
  },
  {
    id: 24,
    front: "The children _ fast.",
    options: { a: "run", b: "runs", c: "running" },
    answer: "a",
    explanation: 'Plural subject "children."',
    topic,
    grade,
  },
  {
    id: 25,
    front: "My father _ carefully.",
    options: { a: "drive", b: "driving", c: "drives" },
    answer: "c",
    explanation: 'Singular "father."',
    topic,
    grade,
  },
  {
    id: 26,
    front: "I _ to church on Sunday.",
    options: { a: "go", b: "goes", c: "going" },
    answer: "a",
    explanation: 'First-person singular "I."',
    topic,
    grade,
  },
  {
    id: 27,
    front: "The flowers _ good.",
    options: { a: "smell", b: "smells", c: "smelling" },
    answer: "a",
    explanation: 'Plural "flowers."',
    topic,
    grade,
  },
  {
    id: 28,
    front: "She and her sister _ music.",
    options: { a: "like", b: "likes", c: "liking" },
    answer: "a",
    explanation: "Plural subject.",
    topic,
    grade,
  },
  {
    id: 29,
    front: "Someone _ at the door.",
    options: { a: "is", b: "are", c: "knocking" },
    answer: "a",
    explanation: 'Singular "someone."',
    topic,
    grade,
  },
  {
    id: 30,
    front: "The teacher _ the lesson.",
    options: { a: "explains", b: "explain", c: "explaining" },
    answer: "a",
    explanation: 'Singular "teacher."',
    topic,
    grade,
  },
  {
    id: 31,
    front: "Each of the students _ a notebook.",
    options: { a: "bring", b: "brings", c: "bringing" },
    answer: "b",
    explanation: '"each" is singular.',
    topic,
    grade,
  },
  {
    id: 32,
    front: "The group of dancers _ ready.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: '"group" is singular.',
    topic,
    grade,
  },
  {
    id: 33,
    front: "Neither the boy nor the girls _ late.",
    options: { a: "is", b: "are", c: "was" },
    answer: "b",
    explanation: 'Plural subject "girls."',
    topic,
    grade,
  },
  {
    id: 34,
    front: "Everyone in the class _ the rules.",
    options: { a: "follow", b: "follows", c: "following" },
    answer: "b",
    explanation: 'Singular "everyone."',
    topic,
    grade,
  },
  {
    id: 35,
    front: "The basket of fruits _ on the table.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: 'Singular "basket."',
    topic,
    grade,
  },
  {
    id: 36,
    front: "My friends and I _ to the library.",
    options: { a: "goes", b: "go", c: "going" },
    answer: "b",
    explanation: 'Plural "friends and I."',
    topic,
    grade,
  },
  {
    id: 37,
    front: "One of my classmates _ very helpful.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: 'Singular "one."',
    topic,
    grade,
  },
  {
    id: 38,
    front: "The teacher, along with the pupils, _ in the room.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: 'Singular main subject "teacher."',
    topic,
    grade,
  },
  {
    id: 39,
    front: "Somebody _ my bag.",
    options: { a: "take", b: "takes", c: "taking" },
    answer: "b",
    explanation: 'Singular "somebody."',
    topic,
    grade,
  },
  {
    id: 40,
    front: "The pair of shoes _ under the bed.",
    options: { a: "are", b: "is", c: "were" },
    answer: "b",
    explanation: 'Singular "pair."',
    topic,
    grade,
  },
];

export const flashcardCount = flashcards.length;

const levelRangeByLevel: Record<
  FlashcardLevel,
  { start: number; end: number }
> = {
  easy: { start: 0, end: 5 },
  medium: { start: 5, end: 15 },
  hard: { start: 15, end: 30 },
};

function withDefaultImageSrc(card: Flashcard): Flashcard {
  if (card.imageSrc) {
    return card;
  }

  return {
    ...card,
    imageSrc: `/images/flashcards/${card.id}.webp`,
  };
}

export function getFlashcardsByLevel(level: FlashcardLevel): Flashcard[] {
  const range = levelRangeByLevel[level];
  return flashcards.slice(range.start, range.end).map(withDefaultImageSrc);
}

/** Fisher-Yates shuffle – returns a new array */
export function shuffleCards(cards: Flashcard[]): Flashcard[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Search cards by front text or topic */
export function searchCards(query: string): Flashcard[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return flashcards.filter(
    (c) =>
      c.front.toLowerCase().includes(q) ||
      (c.topic?.toLowerCase().includes(q) ?? false) ||
      Object.values(c.options).some((o) => o.toLowerCase().includes(q)),
  );
}

export function normalizeLevel(
  value: string | null | undefined,
): FlashcardLevel {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }

  return "easy";
}

/** Mastery helpers */
export function getMasteryPercent(score: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((score / total) * 100);
}

export function getStarsEarned(percent: number): number {
  if (percent >= 90) return 3;
  if (percent >= 70) return 2;
  if (percent >= 50) return 1;
  return 0;
}

export function getBadge(percent: number): { emoji: string; label: string } {
  if (percent === 100) return { emoji: "👑", label: "Perfect!" };
  if (percent >= 90) return { emoji: "🏆", label: "Champion!" };
  if (percent >= 70) return { emoji: "🌟", label: "Great Job!" };
  if (percent >= 50) return { emoji: "💪", label: "Good Try!" };
  return { emoji: "📚", label: "Keep Studying!" };
}
