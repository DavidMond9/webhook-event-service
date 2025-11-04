import { loadConfig, getClientConfig } from '../src/config/loader.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Config Loader', () => {
  describe('loadConfig', () => {
    it('should load client configurations from YAML', () => {
      const configs = loadConfig();

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
    });

    it('should return clientA config', () => {
      const config = getClientConfig('clientA');

      expect(config).not.toBeNull();
      expect(config?.id).toBe('clientA');
      expect(config?.destinations).toBeDefined();
      expect(Array.isArray(config?.destinations)).toBe(true);
    });

    it('should return clientB config', () => {
      const config = getClientConfig('clientB');

      expect(config).not.toBeNull();
      expect(config?.id).toBe('clientB');
    });

    it('should return null for non-existent client', () => {
      const config = getClientConfig('nonExistentClient');

      expect(config).toBeNull();
    });

    it('should cache config after first load', () => {
      const config1 = loadConfig();
      const config2 = loadConfig();

      expect(config1).toBe(config2);
    });

    it('should have HTTP destination for clientA', () => {
      const config = getClientConfig('clientA');

      expect(config?.destinations).toContainEqual(
        expect.objectContaining({
          type: 'http',
          url: expect.any(String),
        })
      );
    });

    it('should have PostgreSQL destination for clientA', () => {
      const config = getClientConfig('clientA');

      expect(config?.destinations).toContainEqual(
        expect.objectContaining({
          type: 'postgres',
          table: expect.any(String),
          schema: expect.any(String),
        })
      );
    });
  });
});

