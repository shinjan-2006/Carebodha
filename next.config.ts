import type { NextConfig } from "next";
import {withWorkflow} from "workflow/next";
const config: NextConfig = {
  logging: {incomingRequests:false, browserToTerminal:false, serverFunctions:false},
  webpack(config) {
    config.watchOptions={...config.watchOptions,ignored:["**/node_modules/**","**/.git/**","**/.next/**","**/.local-postgres/**","**/private-storage/**","**/test-results/**","**/playwright-report/**"]};
    return config;
  },
  serverExternalPackages: ["@prisma/client", "pdf-parse", "tesseract.js"],
  async headers() { return [{source: "/:path*", headers: [
    {key:"X-Content-Type-Options",value:"nosniff"}, {key:"X-Frame-Options",value:"DENY"},
    {key:"Referrer-Policy",value:"same-origin"}, {key:"Permissions-Policy",value:"camera=(), microphone=(self), geolocation=()"}
  ]}]; }
};
export default withWorkflow(config);
