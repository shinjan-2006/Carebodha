import "dotenv/config";
import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e",timeout:60000,expect:{timeout:15000},workers:1,fullyParallel:false,retries:0,reporter:[["list"],["html",{open:"never"}]],use:{baseURL:process.env.BETTER_AUTH_URL || "http://localhost:3000",headless:true,channel:"chrome",screenshot:"only-on-failure",trace:"off"}});
