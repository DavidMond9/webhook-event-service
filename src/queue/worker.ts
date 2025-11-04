import redisClient from '../db/redisClient.js';
import fetch from 'node-fetch';

interface Job {
    id: string;
    eventId?: number;
    clientId: string;
    sourceSystem: string;
    payload: any;
    attempt: number;
}

const clientEndpoints: Record<string, string> = {
    clientA: 'http://web:8080/webhooks/mock-receiver',
    clientB: 'http://web:8080/webhooks/mock-receiver'
};

/**
 * Adds a job to the Redis queue.
 */
export async function enqueueJob(job: Job) {
    try {
        await redisClient.lPush('webhook_queue', JSON.stringify(job));
        console.log(`📬 Enqueued job ${job.id}`);
        // Force flush stdout
        process.stdout.write(`📬 Enqueued job ${job.id}\n`);
    } catch (err) {
        console.error('Enqueue error:', err);
        throw err;
    }
}

/**
 * Deliver webhook to client endpoint
 */
async function deliver(job: Job) {
    const url = clientEndpoints[job.clientId];
    if (!url) throw new Error(`No endpoint for client ${job.clientId}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.payload),
    });

    if (!res.ok) {
        throw new Error(`Delivery failed with ${res.status}`);
    }
}

/**
 * Starts the worker to process jobs.
 */
export async function startWorker() {
    try {
        // Check if Redis is already connected, if not, connect
        if (!redisClient.isReady) {
            await redisClient.connect().catch((err) => {
                console.error('Failed to connect Redis in worker:', err);
                throw err;
            });
        }
        console.log('⚙️  Worker started, waiting for jobs...');
    } catch (err) {
        console.error('Failed to start worker:', err);
        throw err;
    }

    while (true) {
        try {
            // brPop returns { key: string, element: string } or null
            const res = await redisClient.brPop(['webhook_queue'], 0);
            if (!res || !res.element) {
                console.log('brPop returned null or empty, continuing...');
                continue;
            }

            const job: Job = JSON.parse(res.element);
            console.log(`🚀 Processing job ${job.id} (attempt ${job.attempt})`);
            process.stdout.write(`🚀 Processing job ${job.id} (attempt ${job.attempt})\n`);

            try {
                await deliver(job);
                console.log(`✅ Job ${job.id} delivered successfully`);
                process.stdout.write(`✅ Job ${job.id} delivered successfully\n`);
            } catch (err: any) {
                console.error(`❌ Delivery error for ${job.id}: ${err.message}`);
                process.stderr.write(`❌ Delivery error for ${job.id}: ${err.message}\n`);
                if (job.attempt < 3) {
                    const delay = 2 ** job.attempt * 1000;
                    console.log(`⏳ Retrying ${job.id} in ${delay / 1000}s`);
                    setTimeout(() => enqueueJob({ ...job, attempt: job.attempt + 1 }), delay);
                } else {
                    console.error(`💀 Job ${job.id} permanently failed after 3 attempts`);
                }
            }
        } catch (err: any) {
            console.error('Error in worker loop:', err);
            process.stderr.write(`Error in worker loop: ${err.message}\n`);
            // Continue the loop even if there's an error
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
