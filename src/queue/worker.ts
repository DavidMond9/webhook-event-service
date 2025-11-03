import redisClient from '../core/redisSingleton.js';

interface Job {
    id: string;
    clientId: string;
    sourceSystem: string;
    payload: any;
    attempt: number;
}

/**
 * Adds a job to the Redis queue.
 */
export async function enqueueJob(job: Job) {
    await redisClient.lPush('webhook_queue', JSON.stringify(job));
    console.log(`📬 Enqueued job ${job.id}`);
}

/**
 * Starts a simple worker that processes jobs from the queue.
 */
export async function startWorker() {
    await redisClient.connect().catch(() => { });
    console.log('⚙️  Worker started, waiting for jobs...');

    while (true) {
        const res = await redisClient.brPop('webhook_queue', 0); // block until job

        if (!res || !('element' in res)) continue; // type safety
        const data = res.element;

        const job: Job = JSON.parse(data);
        console.log(`🚀 Processing job ${job.id} (attempt ${job.attempt})`);

        try {
            // Simulate success/failure
            const success = Math.random() > 0.3;
            if (!success) throw new Error('Simulated delivery failure');

            console.log(`✅ Job ${job.id} processed successfully`);
        } catch (err) {
            if (job.attempt < 3) {
                const delay = 2 ** job.attempt * 1000; // exponential backoff
                console.log(`⏳ Retry ${job.id} in ${delay / 1000}s`);
                setTimeout(() => enqueueJob({ ...job, attempt: job.attempt + 1 }), delay);
            } else {
                console.error(`❌ Job ${job.id} failed after 3 attempts`);
            }
        }
    }
}
