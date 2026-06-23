import http from 'http';

const url = 'http://localhost:3000';
const maxAttempts = 45; // 45 seconds timeout
const intervalMs = 1000;

function checkServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, () => {
      // If we get a response, the server is listening
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
      console.log('\nWeb Server Connection: CONNECTED');
      process.exit(0);
    }
    // Print progress dot
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log('\nWeb Server Connection: FAILED (Timeout)');
  process.exit(1);
}

main();
