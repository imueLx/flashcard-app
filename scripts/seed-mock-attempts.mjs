import fs from "node:fs";
import { MongoClient } from "mongodb";

const LEVELS = ["easy", "medium", "hard"];
const STUDENTS = [
  "Ana Cruz",
  "Ben Ramos",
  "Carla Reyes",
  "Daniel Lim",
  "Ella Santos",
  "Franco Dela Cruz",
  "Gina Torres",
  "Harold Bautista",
  "Ivy Garcia",
  "James Navarro",
  "Karen Flores",
  "Lance Mercado",
  "Mia Villanueva",
  "Noah Mendoza",
  "Olivia Castro",
  "Paolo Aquino",
  "Quinn Salazar",
  "Rina Ortega",
  "Sean Padilla",
  "Tina Molina",
];

const SEED_DEVICE_PREFIX = "mock-seed-v1";

function readEnv(path) {
  const raw = fs.readFileSync(path, "utf8");
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function levelItemCount(level) {
  return level === "easy" ? 10 : 15;
}

function createSeedAttempts() {
  const docs = [];
  const now = Date.now();

  for (
    let studentIndex = 0;
    studentIndex < STUDENTS.length;
    studentIndex += 1
  ) {
    const studentName = STUDENTS[studentIndex];
    const attemptsCount = 6 + (studentIndex % 5);

    for (
      let attemptIndex = 0;
      attemptIndex < attemptsCount;
      attemptIndex += 1
    ) {
      const level = LEVELS[(studentIndex + attemptIndex) % LEVELS.length];
      const total = levelItemCount(level);
      const base = 42 + ((studentIndex * 5) % 20);
      const growth = attemptIndex * (3 + (studentIndex % 3));
      const masteryPercent = clamp(base + growth, 35, 98);
      const score = Math.round((masteryPercent / 100) * total);

      const completedAt = new Date(
        now -
          (attemptsCount - attemptIndex) * 86400000 -
          studentIndex * 3600000,
      );
      const deviceId = `${SEED_DEVICE_PREFIX}-${studentIndex + 1}`;
      const clientAttemptId = `${SEED_DEVICE_PREFIX}-attempt-${studentIndex + 1}-${attemptIndex + 1}`;

      docs.push({
        clientAttemptId,
        studentName,
        studentNameLower: studentName.toLowerCase(),
        level,
        score,
        total,
        masteryPercent,
        passed: masteryPercent >= 70,
        completedAt,
        deviceId,
        createdAt: new Date(completedAt.getTime() + 1000),
      });
    }
  }

  return docs;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const reset = args.has("--reset");
  const clear = args.has("--clear");

  const env = readEnv(".env.local");
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB || "flashcard_app";

  if (!uri) {
    throw new Error("MONGODB_URI is missing in .env.local");
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const db = client.db(dbName);
    const attempts = db.collection("attempts");

    if (reset) {
      const deleted = await attempts.deleteMany({
        deviceId: { $regex: `^${SEED_DEVICE_PREFIX}` },
      });
      console.log(`Deleted existing mock docs: ${deleted.deletedCount}`);
    }

    if (clear) {
      const deleted = await attempts.deleteMany({
        deviceId: { $regex: `^${SEED_DEVICE_PREFIX}` },
      });
      console.log(`Cleared mock docs: ${deleted.deletedCount}`);
      return;
    }

    const seedDocs = createSeedAttempts();
    const result = await attempts.insertMany(seedDocs, { ordered: false });
    console.log(`Inserted mock docs: ${result.insertedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Mock seed failed: ${message}`);
  process.exit(1);
});
