import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const mongoUri =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/mindmap";

const client = new MongoClient(mongoUri);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(client.db()),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.CLIENT_ORIGIN ?? "http://localhost:5173"],
});

export type Auth = typeof auth;
