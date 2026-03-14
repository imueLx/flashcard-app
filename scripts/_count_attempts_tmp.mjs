import fs from "node:fs";
import { MongoClient } from "mongodb";

function parseEnv(path) {
  const env = {};
  const content = fs.readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[match[1]] = value;
  }

  return env;
}

async function main() {
  const env = parseEnv(".env.local");
  const client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB || "flashcard_app");
    const total = await db.collection("attempts").countDocuments();
    const mock = await db
      .collection("attempts")
      .countDocuments({ deviceId: /^mock-seed-v1/ });

    console.log("ATTEMPTS_TOTAL", total);
    console.log("ATTEMPTS_MOCK", mock);
  } finally {
    await client.close();
  }
}

void main();
