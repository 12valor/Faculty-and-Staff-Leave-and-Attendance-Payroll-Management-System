import http from 'http';

const port = process.argv[2] || '3000';
const url = `http://localhost:${port}`;
const maxAttempts = 45;
const intervalMs = 1000;

function checkServer(): Promise<boolean> {
  return new Promise((resolve) => {
    // For Prisma Studio or Next.js, making an HTTP GET request to check availability
    const req = http.get(url, () => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const connected = await checkServer();
    if (connected) {
      console.log(`\nConnection to port ${port}: CONNECTED`);
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log(`\nConnection to port ${port}: FAILED (Timeout)`);
  process.exit(1);
}

main();
