import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  const client = new MongoClient(uri);
  return client.connect();
}

export function getMongoClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = createMongoClientPromise();
    }

    return global._mongoClientPromise;
  }

  return createMongoClientPromise();
}

export async function getMongoDb() {
  const client = await getMongoClientPromise();
  const dbName = process.env.MONGODB_DB ?? "flashcard_app";
  return client.db(dbName);
}
