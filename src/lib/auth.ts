import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db, mode } from "./db";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import {usernamePattern,normalizeUsername} from "./usernames";
import {authOrigin} from "./auth-origin";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authOrigin,
  trustedOrigins: [authOrigin],
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
  plugins: [username({displayUsername:false,immutableUsername:true,usernameValidator:value=>usernamePattern.test(value),usernameNormalization:normalizeUsername})],
  user: { additionalFields: {
    role: { type: "string", defaultValue: "PATIENT", input: false },
    dataMode: { type: "string", defaultValue: mode, input: false }
  } },
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 40 },
  advanced: { useSecureCookies: authOrigin.startsWith("https://") },
  databaseHooks: { user: { create: { before: async user => {
    const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});
    if(guard?.mode!==mode) throw new APIError("FORBIDDEN",{message:"This environment is not configured for registration."});
    return {data:{...user,role:"PATIENT",dataMode:mode}};
  }, after: async user => {
    await db.patientProfile.create({ data: { userId: user.id } });
  } } } },
  logger: { disabled: true }
});
