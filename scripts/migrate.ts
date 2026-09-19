import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

console.log('Running Prisma database migration...');
execSync('npx prisma db push', { stdio: 'inherit' });
console.log('Migrations completed.');
