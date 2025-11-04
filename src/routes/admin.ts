import express, { Request, Response } from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

router.get('/clients/:clientId/events', async (req: Request, res: Response) => {
  const { clientId } = req.params;

  try {
    const result = await query(
      `SELECT 
        id,
        received_at,
        client_id,
        source_system,
        status,
        attempts,
        last_error,
        raw_body,
        transformed_body
      FROM events
      WHERE client_id = $1
      ORDER BY received_at DESC
      LIMIT 100`,
      [clientId]
    );

    const events = result.rows.map(row => ({
      id: row.id,
      receivedAt: row.received_at,
      clientId: row.client_id,
      sourceSystem: row.source_system,
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error,
      rawBody: row.raw_body,
      transformedBody: row.transformed_body,
    }));

    res.json({ events });
  } catch (err) {
    console.error('Failed to fetch events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

