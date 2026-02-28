import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  hashSecret,
  issueSession,
  normalizeEmail,
  requireSession,
  resolveSession,
  validateEmail,
} from "./lib/auth";

function assertPassword(password: string) {
  if (password.length < 8) {
    throw new ConvexError("Password must be at least 8 characters.");
  }
}

export const signup = mutationGeneric({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    token: v.string(),
    user: v.object({
      id: v.string(),
      email: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const password = args.password;
    assertPassword(password);

    if (!validateEmail(email)) {
      throw new ConvexError("Enter a valid email address.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      throw new ConvexError("Account already exists for this email.");
    }

    const salt = crypto.randomUUID().replace(/-/g, "");
    const passwordHash = await hashSecret(password, salt);
    const userId = await ctx.db.insert("users", {
      email,
      passwordHash,
      passwordSalt: salt,
      createdAt: Date.now(),
    });

    const token = await issueSession(ctx, userId);
    return {
      token,
      user: {
        id: String(userId),
        email,
      },
    };
  },
});

export const login = mutationGeneric({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    token: v.string(),
    user: v.object({
      id: v.string(),
      email: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const password = args.password;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      throw new ConvexError("Invalid email or password.");
    }

    const passwordHash = await hashSecret(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      throw new ConvexError("Invalid email or password.");
    }

    const token = await issueSession(ctx, user._id);
    return {
      token,
      user: {
        id: String(user._id),
        email: user.email,
      },
    };
  },
});

export const logout = mutationGeneric({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveSession(ctx, args.token);
    if (resolved) {
      await ctx.db.delete(resolved.session._id as never);
    }
    return null;
  },
});

export const me = queryGeneric({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveSession(ctx, args.token);
    if (!resolved) return null;
    return {
      id: String(resolved.user._id),
      email: resolved.user.email,
    };
  },
});

export const revokeAllSessions = mutationGeneric({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));
    return null;
  },
});
