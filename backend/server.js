// Custom Next.js server that also starts the cron scheduler.
// Used in production: node server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || '3001', 10);

app.prepare().then(async () => {
  // Start cron jobs (compiled TypeScript via Next.js build)
  try {
    // In production the scheduler is compiled to .next/server/jobs/scheduler.js
    const schedulerPath = dev
      ? path.join(__dirname, 'src/jobs/scheduler')
      : path.join(__dirname, '.next/server/chunks/jobs/scheduler');
    const { startScheduler } = require(schedulerPath);
    startScheduler();
  } catch (err) {
    console.warn('[server] Could not start scheduler:', err.message);
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> Backend ready on port ${port}`);
  });
});
