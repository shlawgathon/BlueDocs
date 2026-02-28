"use client";

import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

interface AuthModalProps {
  onClose: () => void;
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<void>;
}

export function AuthModal({ onClose, onSubmit }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit(mode, trimmedEmail, password);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute top-1/2 left-1/2 z-50 w-[360px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#0A1628]/95 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 transition-colors hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "login"
                ? "bg-[#14B8A6]/20 text-[#14B8A6]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "signup"
                ? "bg-[#14B8A6]/20 text-[#14B8A6]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[#14B8A6]"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[#14B8A6]"
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[#14B8A6]"
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14B8A6] py-2.5 text-sm font-semibold text-[#0A1628] shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all hover:shadow-[0_0_25px_rgba(20,184,166,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>
      </div>
    </>
  );
}
