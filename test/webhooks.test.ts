import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/queue/worker.js', () => ({
  enqueueJob: jest.fn(),
}));

jest.unstable_mockModule('../src/db/pool.js', () => ({
  query: jest.fn(),
}));

const webhookRouter = await import('../src/routes/webhooks.js');
const worker = await import('../src/queue/worker.js');
const db = await import('../src/db/pool.js');

const app = express();
app.use(express.json());
app.use('/webhooks', webhookRouter.default);

describe('Webhook Routes', () => {
  const originalEnv = process.env.WEBHOOK_SECRET;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_SECRET = 'test-secret';
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.WEBHOOK_SECRET = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  describe('POST /webhooks/:clientId/:sourceSystem', () => {
    const payload = {
      unit_id: 'bldg-123-unit-45',
      tenant_name: 'John Smith',
      lease_start: '2024-01-01',
      monthly_rent: 2500,
    };

    const rawBody = JSON.stringify(payload);
    const secret = 'test-secret';
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    it('should accept valid webhook with correct signature', async () => {
      (db.query as any).mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });
      (worker.enqueueJob as any).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/webhooks/clientA/propertysysA')
        .set('X-Webhook-Signature', signature)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('eventId');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining(['clientA', 'propertysysA'])
      );
      expect(worker.enqueueJob).toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(app)
        .post('/webhooks/clientA/propertysysA')
        .set('X-Webhook-Signature', 'invalid-signature')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid signature');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should reject webhook without signature header', async () => {
      const response = await request(app)
        .post('/webhooks/clientA/propertysysA')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid signature');
    });

    it('should handle duplicate events gracefully', async () => {
      (db.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/webhooks/clientA/propertysysA')
        .set('X-Webhook-Signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Duplicate event ignored');
      expect(worker.enqueueJob).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      (db.query as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/webhooks/clientA/propertysysA')
        .set('X-Webhook-Signature', signature)
        .send(payload);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /webhooks/test-queue', () => {
    it('should enqueue a test job', async () => {
      (worker.enqueueJob as any).mockResolvedValueOnce(undefined);

      const response = await request(app).get('/webhooks/test-queue');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Job enqueued');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('clientId', 'clientA');
      expect(worker.enqueueJob).toHaveBeenCalled();
    });
  });

  describe('POST /webhooks/mock-receiver', () => {
    it('should receive and log payload', async () => {
      const payload = { test: 'data' };
      const response = await request(app)
        .post('/webhooks/mock-receiver')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('received', true);
    });
  });
});
