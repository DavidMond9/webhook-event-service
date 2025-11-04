import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/db/pool.js', () => ({
  query: jest.fn(),
}));

const adminRouter = await import('../src/routes/admin.js');
const db = await import('../src/db/pool.js');

const app = express();
app.use('/admin', adminRouter.default);

describe('Admin Routes', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /admin/clients/:clientId/events', () => {
    it('should return last 100 events for a client', async () => {
      const mockEvents = [
        {
          id: 1,
          received_at: new Date('2024-01-01'),
          client_id: 'clientA',
          source_system: 'propertysysA',
          status: 'SUCCESS',
          attempts: 1,
          last_error: null,
          raw_body: { test: 'data' },
          transformed_body: { transformed: 'data' },
        },
        {
          id: 2,
          received_at: new Date('2024-01-02'),
          client_id: 'clientA',
          source_system: 'propertysysA',
          status: 'FAILED',
          attempts: 2,
          last_error: 'Delivery failed',
          raw_body: { test: 'data2' },
          transformed_body: null,
        },
      ];

      (db.query as any).mockResolvedValueOnce({
        rows: mockEvents,
      });

      const response = await request(app).get('/admin/clients/clientA/events');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0]).toMatchObject({
        id: 1,
        clientId: 'clientA',
        sourceSystem: 'propertysysA',
        status: 'SUCCESS',
        attempts: 1,
        lastError: null,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['clientA']
      );
    });

    it('should return empty array for client with no events', async () => {
      (db.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app).get('/admin/clients/clientB/events');

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      (db.query as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/admin/clients/clientA/events');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should limit results to 100 events', async () => {
      (db.query as any).mockResolvedValueOnce({
        rows: [],
      });

      await request(app).get('/admin/clients/clientA/events');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100'),
        expect.any(Array)
      );
    });
  });
});
