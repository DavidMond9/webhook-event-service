import { createClient, RedisClientType } from 'redis';
import redisClient from '../db/redisClient.js';
import fetch from 'node-fetch';
import { query } from '../db/pool.js';
import { getClientConfig } from '../config/loader.js';
import { transformData, createPropertySystemTransformation } from '../transforms/transformer.js';

interface Job {
  id: string;
  eventId?: number;
  clientId: string;
  sourceSystem: string;
  payload: any;
  attempt: number;
}

let consumer: RedisClientType | null = null; // dedicated BRPOP client

async function transformEvent(job: Job): Promise<any> {
  const clientConfig = getClientConfig(job.clientId);
  if (!clientConfig || !clientConfig.transformations || clientConfig.transformations.length === 0) {
    if (job.sourceSystem === 'propertysysA') {
      const rules = createPropertySystemTransformation();
      return transformData(job.payload, rules);
    }
    return job.payload;
  }
  return transformData(job.payload, clientConfig.transformations);
}

/** Producer API: use the shared (non-blocking) client for LPUSH */
export async function enqueueJob(job: Job) {
  try {
    await redisClient.lPush('webhook_queue', JSON.stringify(job));
    console.log(`📬 Enqueued job ${job.id}`);
  } catch (err) {
    console.error('Enqueue error:', err);
    throw err;
  }
}

async function deliver(job: Job, transformedPayload: any) {
  const clientConfig = getClientConfig(job.clientId);
  if (!clientConfig || !clientConfig.destinations || clientConfig.destinations.length === 0) {
    throw new Error(`No destinations configured for client ${job.clientId}`);
  }

  for (const destination of clientConfig.destinations) {
    let deliverySuccess = false;
    try {
      if (destination.type === 'http' && destination.url) {
        const res = await fetch(destination.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transformedPayload),
        });
        if (!res.ok) throw new Error(`HTTP delivery failed with ${res.status}`);
        deliverySuccess = true;
      } else if (destination.type === 'postgres') {
        const schema = destination.schema || 'public';
        const table = destination.table || 'property_updates';
        if (schema !== 'public') await query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
        await query(
          `CREATE TABLE IF NOT EXISTS ${schema}.${table} (
            id BIGSERIAL PRIMARY KEY,
            event_id BIGINT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(event_id)
          )`
        );
        await query(
          `INSERT INTO ${schema}.${table} (payload, event_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (event_id) DO NOTHING`,
          [transformedPayload, job.eventId]
        );
        deliverySuccess = true;
      }

      if (job.eventId && deliverySuccess) {
        await query(
          `INSERT INTO event_deliveries (event_id, destination_type, destination, status, attempts)
           VALUES ($1, $2, $3, 'SUCCESS', 1)
           ON CONFLICT DO NOTHING`,
          [job.eventId, 'http', destination.url || `${destination.schema || 'public'}.${destination.table || 'property_updates'}`]
        );
      }
    } catch (err: any) {
      if (job.eventId) {
        await query(
          `INSERT INTO event_deliveries (event_id, destination_type, destination, status, attempts, last_error)
           VALUES ($1, $2, $3, 'FAILED', 1, $4)
           ON CONFLICT DO NOTHING`,
          [job.eventId, destination.type, destination.url || `${destination.schema || 'public'}.${destination.table || 'property_updates'}`, err.message]
        );
      }
      throw err;
    }
  }
}

/** Consumer: dedicated BRPOP connection */
export async function startWorker() {
  try {
    if (!redisClient.isReady) {
      await redisClient.connect(); // shared producer client
    }
    // Create a dedicated consumer connection for BRPOP
    consumer = redisClient.duplicate();
    await consumer.connect();
    console.log('⚙️  Worker started, waiting for jobs...');
  } catch (err) {
    console.error('Failed to start worker:', err);
    throw err;
  }

  while (true) {
    try {
      const res = await consumer.brPop('webhook_queue', 0); // blocking on dedicated client
      if (!res || !res.element) continue;

      const job: Job = JSON.parse(res.element);
      console.log(`🚀 Processing job ${job.id} (attempt ${job.attempt})`);

      try {
        if (job.eventId) {
          await query(`UPDATE events SET status = 'PROCESSING' WHERE id = $1`, [job.eventId]);
        }

        const transformedPayload = await transformEvent(job);
        if (job.eventId) {
          await query(
            `UPDATE events SET transformed_body = $1, status = 'TRANSFORMED' WHERE id = $2`,
            [transformedPayload, job.eventId]
          );
        }

        await deliver(job, transformedPayload);

        if (job.eventId) {
          await query(`UPDATE events SET status = 'SUCCESS' WHERE id = $1`, [job.eventId]);
        }

        console.log(`✅ Job ${job.id} delivered successfully`);
      } catch (err: any) {
        console.error(`❌ Delivery error for ${job.id}: ${err.message}`);
        if (job.eventId) {
          await query(
            `UPDATE events SET status = 'FAILED', last_error = $1, attempts = attempts + 1 WHERE id = $2`,
            [err.message, job.eventId]
          );
        }
        if (job.attempt < 5) {
          const delay = 2 ** job.attempt * 1000;
          console.log(`⏳ Retrying ${job.id} in ${delay / 1000}s`);
          setTimeout(() => enqueueJob({ ...job, attempt: job.attempt + 1 }), delay);
        } else {
          if (job.eventId) {
            await query(`UPDATE events SET status = 'PERMANENTLY_FAILED' WHERE id = $1`, [job.eventId]);
          }
          console.error(`💀 Job ${job.id} permanently failed after 5 attempts`);
        }
      }
    } catch (err: any) {
      console.error('Error in worker loop:', err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
