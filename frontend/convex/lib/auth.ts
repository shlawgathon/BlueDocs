import { ConvexError } from "convex/values";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

interface IndexRange {
  eq: (field: string, value: unknown) => unknown;
}

interface QueryWithIndex {
  withIndex: (name: string, builder: (q: IndexRange) => unknown) => {
    unique: () => Promise<unknown>;
  };
}

interface AuthDb {
  query: (table: string) => QueryWithIndex;
  delete: (id: unknown) => Promise<void>;
  get: (id: unknown) => Promise<unknown>;
  insert: (table: string, value: Record<string, unknown>) => Promise<unknown>;
}

interface AuthCtx {
  db: unknown;
}

interface SessionDoc {
  _id: unknown;
  userId: unknown;
  expiresAt: number;
}

interface UserDoc {
  _id: unknown;
  email: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function createSessionToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function resolveSession(ctx: AuthCtx, token: string) {
  const db = ctx.db as AuthDb;
  const tokenHash = await hashSecret(token, "session");
  const session = (await db
    .query("sessions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique()) as SessionDoc | null;
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    await db.delete(session._id);
    return null;
  }

  const user = (await db.get(session.userId)) as UserDoc | null;
  if (!user) {
    await db.delete(session._id);
    return null;
  }

  return { session, user };
}

export async function requireSession(ctx: AuthCtx, token: string) {
  const resolved = await resolveSession(ctx, token);
  if (!resolved) {
    throw new ConvexError("Unauthorized");
  }
  return resolved;
}

export async function issueSession(ctx: AuthCtx, userId: unknown): Promise<string> {
  const db = ctx.db as AuthDb;
  const token = createSessionToken();
  const tokenHash = await hashSecret(token, "session");
  const now = Date.now();

  await db.insert("sessions", {
    userId,
    tokenHash,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  return token;
}
