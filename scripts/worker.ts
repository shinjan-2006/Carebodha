import "dotenv/config";
import { tick } from "../src/lib/worker";
import { db } from "../src/lib/db";
let stopping=false;
process.on("SIGINT",()=>{stopping=true;});process.on("SIGTERM",()=>{stopping=true;});
console.log("CareBodha worker started. Job bodies and clinical text are not logged.");
async function main() {
  while(!stopping) { try { const busy=await tick(); if(!busy) await new Promise(r=>setTimeout(r,1500)); } catch {console.error("Worker unavailable. Check database and environment configuration.");await new Promise(r=>setTimeout(r,5000));} }
  await db.$disconnect();
}
void main();
