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
        console.log('Altering table column types to BIGINT...');
        await db.execute(sql`ALTER TABLE users ALTER COLUMN id TYPE BIGINT;`);
        await db.execute(sql`ALTER TABLE orders ALTER COLUMN user_id TYPE BIGINT;`);
    } catch (e) {
        console.warn('Type alteration might have already been applied:', e);
    }

    execSync('npx drizzle-kit push', { stdio: 'inherit' });
    console.log('Migrations completed.');
}

runMigrations().catch(console.error);
