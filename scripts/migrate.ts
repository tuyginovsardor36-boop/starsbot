import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

console.log('Running Prisma database migration...');
// Production'da 'migrate deploy' xavfsiz va to'g'ri buyruq
execSync('npx prisma migrate deploy', { stdio: 'inherit' });
console.log('Migrations completed.');
