import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { DigestRow } from '../src/digest/types.js';

function rows(night = '2026-10-28', dir = 'runs'): DigestRow[] {
  const d = readNight(dir, night);
  if (!d.found) throw new Error(`${night} not found`);
  return d.rows;
}

const row = (job: string) => rows().find((r) => r.job === job);

describe('readNight on runs/2026-10-28.jsonl', () => {
  it('reads 5 jobs, sorted by job, and counts 1 bad line', () => {
    const d = readNight('runs', '2026-10-28');
    expect(d.found).toBe(true);
    if (!d.found) return;
    expect(d.badLines).toBe(1);
    expect(d.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('fixtures/refresh: 3 retries, last status ok', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup: last status fail with its error', () => {
    expect(row('notes/backup')).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('digest/render: owner null keeps the row', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('lane/sync: keeps the offset of first and last time as in the log', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('empty file: found, no rows, no bad lines', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', found: true, rows: [], badLines: 0 });
  });

  it('missing file: not found, no throw', () => {
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', found: false });
  });

  it('missing runs dir: not found, no throw', () => {
    expect(readNight(join(dir, 'nope'), '2026-01-02')).toEqual({ night: '2026-01-02', found: false });
  });

  it('a night that is not YYYY-MM-DD: not found, never read', () => {
    expect(readNight(dir, '../2026-01-01')).toEqual({ night: '../2026-01-01', found: false });
  });

  it('lines that parse but do not validate are counted, never thrown', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"done","owner":"x"}',
      '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"ok"}',
      '{"at":"2026-01-03T01:00:00+02:00","job":"","status":"ok","owner":"x"}',
      '{"at":1,"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"ok","owner":"x","error":42}',
      '[1,2]',
      'null',
      '',
      '   ',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n'));
    const d = readNight(dir, '2026-01-03');
    expect(d).toMatchObject({ found: true, badLines: 7 });
    expect(rows('2026-01-03', dir)).toHaveLength(1);
  });
});
