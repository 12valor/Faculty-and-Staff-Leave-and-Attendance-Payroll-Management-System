import { getPrisma } from '../src/lib/prisma';

async function main() {
  console.log('Connecting to database...');
  try {
    const prisma = getPrisma();
    // Test the connection by running a simple query
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('Database Connection: CONNECTED');
    process.exit(0);
  } catch (error) {
    console.error('Database Connection: FAILED');
    console.error(error);
    process.exit(1);
  }
}

main();
