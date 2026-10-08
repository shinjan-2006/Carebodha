import {PrismaClient} from '@prisma/client';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
if(process.env.VERCEL!=='1'||!process.env.DATABASE_URL_UNPOOLED)throw new Error('Hosted migrations require the direct database connection.');
const directUrl=process.env.DATABASE_URL_UNPOOLED;
const db=new PrismaClient({datasourceUrl:directUrl});
let rows=[];
try{rows=await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;}
catch(error){if(error?.meta?.code!=='42P01')throw error;}
finally{await db.$disconnect();}
const directories=(await readdir('prisma/migrations',{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
let pending=false;
for(const name of directories){const bytes=await readFile(`prisma/migrations/${name}/migration.sql`);const checksum=createHash('sha256').update(bytes).digest('hex');const row=rows.find(r=>r.migration_name===name && r.finished_at && !r.rolled_back_at);if(!row){pending=true;continue;}if(row.checksum!==checksum)throw new Error('An applied migration differs from the committed source.');}
if(!pending && directories.length && !rows.some(r=>!r.finished_at && !r.rolled_back_at))console.log('All committed migrations are already applied and verified.');
else{const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:directUrl},stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;}
