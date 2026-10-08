import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
export const mode = process.env.APP_MODE === "demo" ? "demo" : "normal";
