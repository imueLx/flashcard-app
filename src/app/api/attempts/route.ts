import { NextResponse } from "next/server";
import { normalizeLevel, type FlashcardLevel } from "@/app/data/flashcard";
import { getMongoDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type AttemptDocument = {
  studentName: string;
  studentNameLower: string;
  level: FlashcardLevel;
  score: number;
  total: number;
  masteryPercent: number;
  passed: boolean;
  completedAt: Date;
  deviceId: string;
  createdAt: Date;
};

type AttemptResponse = {
  id: string;
  studentName: string;
  level: FlashcardLevel;
  score: number;
  total: number;
  masteryPercent: number;
  passed: boolean;
  completedAt: string;
  deviceId: string;
  createdAt: string;
};

function sanitizeStudentName(value: unknown): string {
  if (typeof value !== "string") {
    return "Unknown Student";
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : "Unknown Student";
}

function toSafeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function toSafePercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function toSafeDate(value: unknown): Date {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }
  }

  return new Date();
}

function mapResponse(
  doc: AttemptDocument & { _id: ObjectId },
): AttemptResponse {
  return {
    id: doc._id.toString(),
    studentName: doc.studentName,
    level: doc.level,
    score: doc.score,
    total: doc.total,
    masteryPercent: doc.masteryPercent,
    passed: doc.passed,
    completedAt: doc.completedAt.toISOString(),
    deviceId: doc.deviceId,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (
      body.level !== "easy" &&
      body.level !== "medium" &&
      body.level !== "hard"
    ) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const level = normalizeLevel(body.level);

    const score = toSafeInt(body.score);
    const total = toSafeInt(body.total);
    const masteryPercent = toSafePercent(body.masteryPercent);
    const studentName = sanitizeStudentName(body.studentName);

    const payload: AttemptDocument = {
      studentName,
      studentNameLower: studentName.toLowerCase(),
      level,
      score,
      total,
      masteryPercent,
      passed: Boolean(body.passed),
      completedAt: toSafeDate(body.completedAt),
      deviceId:
        typeof body.deviceId === "string" && body.deviceId.length > 0
          ? body.deviceId
          : "unknown-device",
      createdAt: new Date(),
    };

    const db = await getMongoDb();
    const collection = db.collection<AttemptDocument>("attempts");
    const result = await collection.insertOne(payload);

    return NextResponse.json({ ok: true, id: result.insertedId.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("MONGODB_URI")) {
      return NextResponse.json(
        { error: "Database is not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to upload attempt" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const db = await getMongoDb();
    const collection = db.collection<AttemptDocument>("attempts");

    const docs = await collection
      .find({}, { sort: { completedAt: -1 }, limit: 1000 })
      .toArray();

    return NextResponse.json({
      attempts: docs.map((doc) =>
        mapResponse(doc as AttemptDocument & { _id: ObjectId }),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("MONGODB_URI")) {
      return NextResponse.json(
        { error: "Database is not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to load attempts" },
      { status: 500 },
    );
  }
}
