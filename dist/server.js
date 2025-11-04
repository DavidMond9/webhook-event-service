import express from 'express';
import webhookRouter from './routes/webhooks.js';
import adminRouter from './routes/admin.js';
import { startWorker } from './queue/worker.js';
// Force unbuffered output for real-time logs in Docker
process.stdout.write = process.stdout.write.bind(process.stdout);
process.stderr.write = process.stderr.write.bind(process.stderr);
if (process.stdout.isTTY) {
    process.stdout.setEncoding('utf8');
}
if (process.stderr.isTTY) {
    process.stderr.setEncoding('utf8');
}
const app = express();
const PORT = process.env.PORT || 8080;
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
