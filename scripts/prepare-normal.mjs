import 'dotenv/config';
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import {PrismaClient} from '@prisma/client';
const target=new URL(process.env.DATABASE_URL);
target.pathname='/carebodha_normal';
if(!['localhost','127.0.0.1'].includes(target.hostname))throw new Error('This local setup only supports the existing local database service.');
const pg=new EmbeddedPostgres({databaseDir:'.local-postgres',user:target.username,password:target.password,port:Number(target.port || 5432),persistent:true});
const client=pg.getPgClient('postgres');await client.connect();
if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',['carebodha_normal'])).rows.length)await client.query('CREATE DATABASE "carebodha_normal" ENCODING \'UTF8\' TEMPLATE template0');
await client.end();
const env={...process.env,DATABASE_URL:target.href,APP_MODE:'normal',AI_PROVIDER:process.env.AI_API_KEY && process.env.AI_MODEL?'openai-compatible':'manual',PRIVATE_STORAGE_PATH:'./private-storage-normal'};
const migrate=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
if(migrate.status!==0)throw new Error('Normal database migration failed. The existing environment was preserved.');
const db=new PrismaClient({datasourceUrl:target.href});
try{const guard=await db.environmentGuard.findUnique({where:{id:'environment'}});if(guard && guard.mode!=='normal')throw new Error('Refusing to change a demo database.');await db.environmentGuard.upsert({where:{id:'environment'},create:{id:'environment',mode:'normal'},update:{}});}finally{await db.$disconnect();}
let original=await readFile('.env','utf8');
try{await access('.env.demo');}catch{if(process.env.APP_MODE==='demo')await copyFile('.env','.env.demo');}
for(const [key,value] of Object.entries({DATABASE_URL:target.href,APP_MODE:'normal',AI_PROVIDER:env.AI_PROVIDER,PRIVATE_STORAGE_PATH:env.PRIVATE_STORAGE_PATH})){const line=`${key}="${value}"`;const pattern=new RegExp(`^${key}=.*$`,'m');original=pattern.test(original)?original.replace(pattern,line):`${original}\n${line}\n`;}
await writeFile('.env',original,{mode:0o600});
console.log('Normal environment ready in a separate database. Existing demo records are preserved. Restart the web server and worker.');
