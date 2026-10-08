export const authOrigin=process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:"http://localhost:3000");
