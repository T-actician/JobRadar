import path from 'node:path';

try { process.loadEnvFile(); } catch { /* .env is optional */ }

export const PORT = Number(process.env.JOBRADAR_PORT ?? 4317);
export const DATA_DIR = process.env.JOBRADAR_DATA_DIR ?? path.resolve(process.cwd(), 'data');
export const USER_AGENT = 'JobRadar/0.2 (personal job-search tool; honours robots.txt)';
/** Max NEW detail pages fetched per source per run, keeps every run polite. */
export const MAX_NEW_PER_RUN = Number(process.env.JOBRADAR_MAX_NEW ?? 40);
export const AUTO_COLLECT = process.env.JOBRADAR_AUTOCOLLECT !== '0';
export const STALE_MINUTES = Number(process.env.JOBRADAR_STALE_MINUTES ?? 60);
