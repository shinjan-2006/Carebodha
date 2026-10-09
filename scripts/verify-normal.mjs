import 'dotenv/config';
import {spawn,spawnSync} from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import {PrismaClient} from '@prisma/client';
const url=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use the local verification database.');url.pathname='/carebodha_normal_test';
const pg=new EmbeddedPostgres({databaseDir:'.local-postgres',user:url.username,password:url.password,port:Number(url.port || 5432),persistent:true});const client=pg.getPgClient('postgres');await client.connect();if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',['carebodha_normal_test'])).rows.length)await client.query('CREATE DATABASE "carebodha_normal_test" ENCODING \'UTF8\' TEMPLATE template0');await client.end();
const env={...process.env,DATABASE_URL:url.href,APP_MODE:'normal',AI_PROVIDER:'manual',BETTER_AUTH_URL:'http://localhost:3001',PRIVATE_STORAGE_PATH:'./private-storage-normal-test'};
const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});if(migration.status!==0)throw new Error('Verification migration failed.');const db=new PrismaClient({datasourceUrl:url.href});await db.environmentGuard.upsert({where:{id:'environment'},create:{id:'environment',mode:'normal'},update:{}});await db.$disconnect();
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001'],{env,stdio:'ignore'}),worker=spawn(process.execPath,['--import','tsx','scripts/worker.ts'],{env,stdio:'ignore'});
let testExit=1;
try{let ready=false;for(let i=0;i<50;i++){try{if((await fetch('http://localhost:3001/api/auth/ok')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw new Error('Normal verification server did not start.');const check=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','normal-model.spec.ts','expert-patients.spec.ts','source-extraction.spec.ts','review-actions.spec.ts'],{env,stdio:'inherit'});const result=await new Promise(resolve=>check.on('exit',resolve));testExit=typeof result==='number'?result:1;}finally{web.kill();worker.kill();}
process.exit(testExit);

