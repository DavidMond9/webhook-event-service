import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => console.error('Redis connection error:', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis'));

await redisClient.connect();

export default redisClient;
