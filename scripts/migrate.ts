import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

console.log('Running database migrations...');
execSync('npx drizzle-kit push', { stdio: 'inherit' });
console.log('Migrations completed.');
