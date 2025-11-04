import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let configCache = null;
export function loadConfig() {
    if (configCache) {
        return configCache;
    }
    try {
        const configPath = join(__dirname, '../../config/clients.yaml');
        const fileContent = readFileSync(configPath, 'utf-8');
        const parsed = parse(fileContent);
        configCache = parsed.clients || [];
        return configCache;
    }
    catch (err) {
        console.error('Failed to load client config:', err);
        return [];
    }
}
export function getClientConfig(clientId) {
    const configs = loadConfig();
    return configs.find(c => c.id === clientId) || null;
}
