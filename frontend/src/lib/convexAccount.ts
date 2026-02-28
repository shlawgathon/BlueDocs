"use client";

import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import type { ConflictCheckResponse } from "@/lib/types";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const ACCOUNT_TOKEN_KEY = "blue_registry_account_token";

export type ProjectShapeType = "circle" | "square" | "hexagon" | "drawn";

export interface StoredProjectConfig {
  projectType: string;
  radiusKm: number;
  name: string;
  shapeType: ProjectShapeType;
}

export interface StoredProjectRecord {
  id: string;
  lat: number;
  lng: number;
  config: StoredProjectConfig;
  analysisResult: ConflictCheckResponse | null;
  customPolygon?: [number, number][];
}

export interface AccountUser {
  id: string;
  email: string;
}

interface AuthResponse {
  token: string;
  user: AccountUser;
}

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  }
  if (!client) {
    client = new ConvexHttpClient(CONVEX_URL, { logger: false });
  }
  return client;
}

async function callQuery<T>(
  functionName: string,
  args: Record<string, unknown>
): Promise<T> {
  return (await getClient().query(
    functionName as unknown as FunctionReference<"query">,
    args
  )) as T;
}

async function callMutation<T>(
  functionName: string,
  args: Record<string, unknown>
): Promise<T> {
  return (await getClient().mutation(
    functionName as unknown as FunctionReference<"mutation">,
    args
  )) as T;
}

export function getStoredAccountToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCOUNT_TOKEN_KEY);
}

export function setStoredAccountToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
}

export function clearStoredAccountToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCOUNT_TOKEN_KEY);
}

export async function signUpAccount(
  email: string,
  password: string
): Promise<AuthResponse> {
  return callMutation<AuthResponse>("accounts:signup", { email, password });
}

export async function signInAccount(
  email: string,
  password: string
): Promise<AuthResponse> {
  return callMutation<AuthResponse>("accounts:login", { email, password });
}

export async function getCurrentAccount(token: string): Promise<AccountUser | null> {
  return callQuery<AccountUser | null>("accounts:me", { token });
}

export async function signOutAccount(token: string): Promise<void> {
  await callMutation("accounts:logout", { token });
}

export async function fetchAccountProjects(
  token: string
): Promise<StoredProjectRecord[]> {
  return callQuery<StoredProjectRecord[]>("projects:list", { token });
}

export async function replaceAccountProjects(
  token: string,
  projects: StoredProjectRecord[]
): Promise<void> {
  await callMutation("projects:replaceAll", { token, projects });
}

async function callAction<T>(
  functionName: string,
  args: Record<string, unknown>
): Promise<T> {
  return (await getClient().action(
    functionName as unknown as FunctionReference<"action">,
    args
  )) as T;
}

export async function sendAnalysisNotification(
  email: string,
  result: ConflictCheckResponse,
  projectName: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    await callAction("notifications:send", {
      email,
      projectName,
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      conflictCount: result.conflicts.length,
      lat,
      lng,
    });
  } catch (error) {
    console.error("Email notification failed:", error);
  }
}
