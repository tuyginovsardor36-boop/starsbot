import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set. Skipping database migrations.');
} else {
  console.log('Running database migrations...');
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
  console.log('Migrations completed.');
}
