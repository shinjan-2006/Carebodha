import {readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
try {await access('.env');console.log('Existing .env preserved.');}
catch {const example=await readFile('.env.example','utf8');await writeFile('.env',example.replace('replace-with-a-random-secret-at-least-32-characters',randomBytes(48).toString('base64url')),{mode:0o600});console.log('Local .env created with a random authentication secret.');}
