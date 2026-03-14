import { NextResponse } from "next/server";
import { normalizeLevel, type FlashcardLevel } from "@/app/data/flashcard";
import { getMongoDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type AttemptDocument = {
  clientAttemptId: string;
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

function sanitizeClientAttemptId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed;
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
    const clientAttemptId = sanitizeClientAttemptId(body.clientAttemptId);

    if (!clientAttemptId) {
      return NextResponse.json(
        { error: "Missing clientAttemptId" },
        { status: 400 },
      );
    }

    const now = new Date();

    const payload: AttemptDocument = {
      clientAttemptId,
      studentName,
      studentNameLower: studentName.toLowerCase(),
      level,
      score,
      total,
      masteryPercent,
      passed: Boolean(body.passed),
      completedAt: now,
      deviceId:
        typeof body.deviceId === "string" && body.deviceId.length > 0
          ? body.deviceId
          : "unknown-device",
      createdAt: now,
    };

    const db = await getMongoDb();
    const collection = db.collection<AttemptDocument>("attempts");

    const existing = await collection.findOne({
      clientAttemptId,
      deviceId: payload.deviceId,
    });

    if (existing && "_id" in existing) {
      return NextResponse.json({
        ok: true,
        id: String((existing as AttemptDocument & { _id: ObjectId })._id),
        duplicate: true,
      });
    }

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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() ?? "";

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid attempt id" },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const collection = db.collection<AttemptDocument & { _id: ObjectId }>(
      "attempts",
    );

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("MONGODB_URI")) {
      return NextResponse.json(
        { error: "Database is not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete attempt" },
      { status: 500 },
    );
  }
}
