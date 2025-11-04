import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TransformationRule {
  source: string;
  target: string;
  transform?: (value: any) => any;
}

export interface Destination {
  type: 'http' | 'postgres';
  url?: string;
  table?: string;
  schema?: string;
}

export interface ClientConfig {
  id: string;
  transformations?: TransformationRule[];
  destinations: Destination[];
}

interface ConfigFile {
  clients: ClientConfig[];
}

let configCache: ClientConfig[] | null = null;

export function loadConfig(): ClientConfig[] {
  if (configCache) {
    return configCache;
  }

  try {
    const configPath = join(__dirname, '../../config/clients.yaml');
    const fileContent = readFileSync(configPath, 'utf-8');
    const parsed = parse(fileContent) as ConfigFile;
    configCache = parsed.clients || [];
    return configCache;
  } catch (err) {
    console.error('Failed to load client config:', err);
    return [];
  }
}

export function getClientConfig(clientId: string): ClientConfig | null {
  const configs = loadConfig();
  return configs.find(c => c.id === clientId) || null;
}

