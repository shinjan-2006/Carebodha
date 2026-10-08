import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { put, get } from "@vercel/blob";
const root = () => {const directory=path.resolve(process.env.PRIVATE_STORAGE_PATH || "./private-storage");const publicDirectory=path.resolve("public");if(directory===publicDirectory || directory.startsWith(publicDirectory+path.sep))throw new Error("UNSAFE_STORAGE_ROOT");return directory;};
function safePath(key: string) { if(!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error("INVALID_STORAGE_KEY"); return path.join(root(),key); }
function s3() { return new S3Client({region:process.env.S3_REGION,endpoint:process.env.S3_ENDPOINT || undefined,forcePathStyle:!!process.env.S3_ENDPOINT,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID || "",secretAccessKey:process.env.S3_SECRET_ACCESS_KEY || ""}}); }
export async function storePrivate(bytes: Uint8Array, mimeType: string) {
  const key = randomUUID();
  if(process.env.STORAGE_DRIVER==="vercel-blob") await put(key,Buffer.from(bytes),{access:"private",addRandomSuffix:false,contentType:mimeType});
  else if(process.env.STORAGE_DRIVER==="s3") await s3().send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:bytes,ContentType:mimeType}));
  else { await fs.mkdir(root(),{recursive:true}); await fs.writeFile(safePath(key),bytes,{mode:0o600}); }
  return key;
}
export async function readPrivate(key: string): Promise<Uint8Array> {
  safePath(key);
  if(process.env.STORAGE_DRIVER==="vercel-blob") {const blob=await get(key,{access:"private",useCache:false});if(!blob || blob.statusCode!==200)throw new Error("FILE_UNAVAILABLE");return new Uint8Array(await new Response(blob.stream).arrayBuffer());}
  if(process.env.STORAGE_DRIVER==="s3") { const r=await s3().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key})); if(!r.Body) throw new Error("FILE_UNAVAILABLE"); return await r.Body.transformToByteArray(); }
  return await fs.readFile(safePath(key));
}
export function validateFile(bytes: Uint8Array, mime: string) {
  if(bytes.length===0 || bytes.length>10*1024*1024) throw new Error("FILE_SIZE_INVALID");
  const head=Buffer.from(bytes.subarray(0,8));
  if(mime==="application/pdf" && head.subarray(0,5).toString()==="%PDF-") return;
  if(mime==="image/png" && head.equals(Buffer.from([137,80,78,71,13,10,26,10]))) return;
  if(mime==="image/jpeg" && head[0]===255 && head[1]===216 && head[2]===255) return;
  throw new Error("FILE_TYPE_INVALID");
}
