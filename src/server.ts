process.stdin.resume();
try {
  // Ensure logs are flushed immediately (no buffering)
  (process.stdout as any)._handle?.setBlocking?.(true);
  (process.stderr as any)._handle?.setBlocking?.(true);
} catch {
  // fallback if not supported
}

import express from 'express';
import webhookRouter from './routes/webhooks.js';
import adminRouter from './routes/admin.js';
import { startWorker } from './queue/worker.js';

// --- Capture raw body for HMAC verification ---
const rawBodySaver = (_req: any, _res: any, buf: Buffer) => {
  (_req as any).rawBody = buf; // store exact bytes for signature check
};

const app = express();
const PORT = process.env.PORT || 8080;

// Use express for raw body saver
app.use(express.json({ limit: '2mb', verify: rawBodySaver }));

app.get('/', (_, res) => {
  res.send('Webhook Event Processing Service running');
});

app.use('/webhooks', webhookRouter);
app.use('/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startWorker().catch((err) => {
    console.error('Failed to start worker:', err);
    process.exit(1);
  });
});
