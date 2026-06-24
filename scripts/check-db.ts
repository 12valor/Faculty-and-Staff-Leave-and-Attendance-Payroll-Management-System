import { getPrisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

// Helper to load env variables manually from .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  console.log('[DB-CHECK] Verifying environment configuration...');

  // 1. Ensure .env exists
  if (!fs.existsSync(envPath)) {
    console.log('[DB-CHECK] .env file is missing. Creating from .env.example...');
    if (fs.existsSync(envExamplePath)) {
      let envContent = fs.readFileSync(envExamplePath, 'utf8');
      const randomSecret = crypto.randomBytes(32).toString('hex');
      
      // Replace the placeholder SESSION_SECRET
      envContent = envContent.replace(
        /SESSION_SECRET\s*=\s*["']?replace-with-at-least-32-random-characters["']?/g,
        `SESSION_SECRET="${randomSecret}"`
      );
      
      if (!envContent.includes('SESSION_SECRET')) {
        envContent += `\nSESSION_SECRET="${randomSecret}"\n`;
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('[DB-CHECK] Successfully created .env and generated a unique SESSION_SECRET.');
    } else {
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const defaultContent = `DATABASE_URL="file:./dev.db"\nSESSION_SECRET="${randomSecret}"\n`;
      fs.writeFileSync(envPath, defaultContent, 'utf8');
      console.log('[DB-CHECK] Created default .env file with generated SESSION_SECRET.');
    }
  } else {
    // Verify SESSION_SECRET exists and is valid
    let envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/SESSION_SECRET\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (!match || match[1].length < 32 || match[1] === 'replace-with-at-least-32-random-characters') {
      console.log('[DB-CHECK] Invalid or placeholder SESSION_SECRET found. Regenerating...');
      const randomSecret = crypto.randomBytes(32).toString('hex');
      if (match) {
        envContent = envContent.replace(match[0], `SESSION_SECRET="${randomSecret}"`);
      } else {
        envContent += `\nSESSION_SECRET="${randomSecret}"\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('[DB-CHECK] Regenerated SESSION_SECRET in .env.');
    }
  }

  // Load env variables into process.env before initializing Prisma
  loadEnv();

  console.log('[DB-CHECK] Connecting to database...');
  try {
    const prisma = getPrisma();
    
    // Test basic database connection
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('[DB-CHECK] Database Connection: SUCCESS');

    // Check if tables are initialized by querying AdminUser table
    let needMigration = false;
    try {
      await prisma.$queryRawUnsafe('SELECT 1 FROM "AdminUser" LIMIT 1');
      console.log('[DB-CHECK] Database schema: VALID (Tables exist)');
    } catch (e) {
      console.log('[DB-CHECK] Database schema: MISSING TABLES (Migration required)');
      needMigration = true;
    }

    if (needMigration) {
      console.log('[DB-CHECK] Running database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('[DB-CHECK] Database migrated successfully.');

      console.log('[DB-CHECK] Seeding database...');
      execSync('npx prisma db seed', { stdio: 'inherit' });
      console.log('[DB-CHECK] Database seeded successfully.');
    }

    process.exit(0);
  } catch (error) {
    console.error('[DB-CHECK] Database setup/connection failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
