import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

async function runMigrations() {
    if (!process.env.DATABASE_URL) {
        console.warn('DATABASE_URL not set. Skipping database migrations.');
        return;
    }

    console.log('Running database migrations...');
    const db = drizzle(neon(process.env.DATABASE_URL));
    try {
        console.log('Dropping old tables to fix ID type issues...');
        await db.execute(sql`DROP TABLE IF EXISTS orders;`);
        await db.execute(sql`DROP TABLE IF EXISTS users;`);
    } catch (e) {
        console.warn('Error dropping tables:', e);
    }

    execSync('npx drizzle-kit push', { stdio: 'inherit' });
    console.log('Migrations completed.');
}

runMigrations().catch(console.error);
