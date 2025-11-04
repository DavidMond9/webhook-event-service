import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/db/redisClient.js', () => ({
  default: {
    isReady: true,
    lPush: jest.fn(),
  },
}));

const { enqueueJob } = await import('../src/queue/worker.js');
const redisClient = await import('../src/db/redisClient.js');

describe('Worker', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.default as any).isReady = true;
    (redisClient.default.lPush as any).mockResolvedValue(1);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('enqueueJob', () => {
    it('should enqueue job to Redis', async () => {
      const job = {
        id: 'test-job-id',
        clientId: 'clientA',
        sourceSystem: 'propertysysA',
        payload: { test: 'data' },
        attempt: 0,
      };

      await enqueueJob(job);

      expect(redisClient.default.lPush).toHaveBeenCalledWith(
        'webhook_queue',
        JSON.stringify(job)
      );
    });

    it('should handle Redis errors', async () => {
      const job = {
        id: 'test-job-id',
        clientId: 'clientA',
        sourceSystem: 'propertysysA',
        payload: { test: 'data' },
        attempt: 0,
      };

      (redisClient.default.lPush as any).mockRejectedValueOnce(new Error('Redis error'));

      await expect(enqueueJob(job)).rejects.toThrow('Redis error');
    });
  });
});
