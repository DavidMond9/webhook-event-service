import express from 'express';
import crypto from 'crypto';
import { query } from '../db/pool.js';
import { enqueueJob } from '../queue/worker.js';
import { randomUUID } from 'crypto';
const router = express.Router();
/**
 * Compute HMAC SHA256 signature for body using client secret
 */
function computeSignature(secret, payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
router.post('/:clientId/:sourceSystem', express.json({ limit: '2mb' }), async (req, res) => {
    const { clientId, sourceSystem } = req.params;
    const signatureHeader = req.header('X-Webhook-Signature') || '';
    const rawBody = JSON.stringify(req.body);
    const secret = process.env.WEBHOOK_SECRET || 'test-secret';
    // Validate signature
    const expectedSig = computeSignature(secret, rawBody);
    if (signatureHeader !== expectedSig) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    // Compute idempotency key
    const dedupKey = crypto.createHash('sha256').update(rawBody).digest('hex');
    try {
        const result = await query(`INSERT INTO events (client_id, source_system, signature, raw_body, dedup_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (client_id, source_system, dedup_key) DO NOTHING
       RETURNING id;`, [clientId, sourceSystem, signatureHeader, req.body, dedupKey]);
        if (result.rows.length === 0) {
            return res.status(200).json({ message: 'Duplicate event ignored' });
        }
        const eventId = result.rows[0].id;
        res.status(201).json({ eventId });
    }
    catch (err) {
        console.error('Failed to store event', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/redis/test', async (_req, res) => {
    try {
        const key = 'test:key';
        await (await import('../db/redisClient.js')).default.set(key, 'Webhook Service Active');
        const value = await (await import('../db/redisClient.js')).default.get(key);
        res.json({ key, value });
    }
    catch (err) {
        console.error('Redis test error:', err);
        res.status(500).json({ error: 'Redis test failed' });
    }
});
router.get('/test-queue', async (_req, res) => {
    try {
        const job = {
            id: randomUUID(),
            clientId: 'clientA',
            sourceSystem: 'propertysysA',
            payload: { test: 'Hello Queue!' },
            attempt: 0,
        };
        // don’t wait on Redis response too long
        enqueueJob(job).catch(err => console.error('Enqueue failed:', err));
        res.status(200).json({ message: 'Job enqueued', job });
    }
    catch (err) {
        console.error('Test queue error:', err);
        res.status(500).json({ error: 'Failed to enqueue job' });
    }
});
export default router;
