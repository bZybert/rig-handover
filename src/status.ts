import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { parseRunLine } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightSummary = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// ok / retry / fail = count of valid log lines in the night, by status.
export function nightCounts(runsDir: string, night: string): NightSummary {
  const counts: NightSummary = { night, ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseRunLine(raw);
    if (line) counts[line.status] += 1;
  }
  return counts;
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => nightCounts(config.runsDir, n)),
  };
}
