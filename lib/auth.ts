import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "./types";
import { readData, updateData } from "./store";

const cookieName = "ff_session";
const localSecret = "future-fridge-local-secret";

function authSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return localSecret;
}

function signature(value: string) {
  return crypto.createHmac("sha256", authSecret()).update(value).digest("hex");
}

export function createSessionToken(userId: number) {
  const value = String(userId);
  return `${value}.${signature(value)}`;
}

export function parseSessionToken(token?: string) {
  if (!token) {
    return null;
  }
  const [value, signed] = token.split(".");
  if (!value || !signed || signature(value) !== signed) {
    return null;
  }
  const userId = Number(value);
  return Number.isInteger(userId) ? userId : null;
}

export function sessionCookieName() {
  return cookieName;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  const userId = parseSessionToken(token);
  if (!userId) {
    return null;
  }
  return readData().users.find((user) => user.id === userId) || null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(allowedRoles: Role[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}

export function canAccess(user: User | null, allowedRoles: Role[]) {
  return Boolean(user && allowedRoles.includes(user.role));
}

export function logAccess(userId: number, accessType: string) {
  updateData((data) => {
    data.accessLogs.push({
      id: data.accessLogs.length ? Math.max(...data.accessLogs.map((log) => log.id)) + 1 : 1,
      userId,
      accessType,
      accessTime: new Date().toISOString()
    });
  });
}
