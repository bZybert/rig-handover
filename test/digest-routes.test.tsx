import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixtures live in a temp dir written in beforeAll. runs/ is read-only and never touched.
const NORMAL = '2026-10-28';
const EMPTY = '2026-10-29';
const BAD = '2026-10-30';
const MISSING = '2026-10-31';

const JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  // Unsorted on purpose: the reader must sort by job.
  writeFileSync(
    join(dir, `${NORMAL}.jsonl`),
    [
      '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      '{"at":"2026-10-28T23:10:00+01:00","job":"notes/backup","status":"fail","owner":"rook","error":"quota exceeded"}',
      '{"at":"2026-10-28T23:20:00+01:00","job":"digest/render","status":"ok","owner":null}',
      '{"at":"2026-10-28T23:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-10-28T23:31:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-10-28T23:32:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-10-28T23:40:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
      '{"at":"2026-10-28T23:50:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      '',
    ].join('\n'),
  );
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(dir, `${BAD}.jsonl`),
    [
      '{"at":"2026-10-30T23:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      '{this is not json',
      '{"at":"2026-10-30T23:10:00+01:00","job":"notes/backup","status":"ok","owner":"rook"}',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const appFor = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });

/** All `<tr ...>...</tr>` blocks in the page, opening tag included. */
function trBlocks(html: string): string[] {
  return html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? [];
}

/** Job of each body row, in page order. The header row has no job and is skipped. */
function htmlJobOrder(html: string): string[] {
  return trBlocks(html)
    .map((r) => JOBS.find((j) => r.includes(j)))
    .filter((j): j is string => j !== undefined);
}

function rowFor(html: string, job: string): string {
  const row = trBlocks(html).find((r) => r.includes(job));
  if (!row) throw new Error(`no row for ${job}`);
  return row;
}

describe('GET /digest/:night (HTML)', () => {
  it('found: 200, title, table, every job, rows sorted by job', async () => {
    const res = await appFor().request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest · ${NORMAL}`);
    expect(html).toContain('<table');
    for (const job of JOBS) expect(html).toContain(job);
    expect(htmlJobOrder(html)).toEqual(JOBS);
  });

  it('found: a row with 3 retries or a last fail gets the warn class', async () => {
    const html = await (await appFor().request(`/digest/${NORMAL}`)).text();
    expect(rowFor(html, 'fixtures/refresh')).toMatch(/^<tr class="warn"/);
    expect(rowFor(html, 'notes/backup')).toMatch(/^<tr class="warn"/);
    expect(rowFor(html, 'lane/sync')).not.toMatch(/^<tr class="warn"/);
    expect(rowFor(html, 'digest/render')).not.toMatch(/^<tr class="warn"/);
  });

  it('found: null owner renders as —', async () => {
    const html = await (await appFor().request(`/digest/${NORMAL}`)).text();
    expect(rowFor(html, 'digest/render')).toContain('—');
  });

  it('found: lane banner is present', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await appFor().request(`/digest/${NORMAL}`);
    expect(await res.text()).toContain('TEST-MARKER');
  });

  it('no file: 404 with "no run log for <night>"', async () => {
    const res = await appFor().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });

  it('empty file: 200 with "nothing ran"', async () => {
    const res = await appFor().request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line: 200, valid jobs still render, "bad lines: 1"', async () => {
    const res = await appFor().request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('bad lines: 1');
    expect(htmlJobOrder(html)).toEqual(['lane/sync', 'notes/backup']);
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('found: 200, body { night, rows, badLines }, job order matches the HTML page', async () => {
    const app = appFor();
    const apiRes = await app.request(`/api/digest/${NORMAL}`);
    expect(apiRes.status).toBe(200);
    const body = await apiRes.json();
    expect(Object.keys(body).sort()).toEqual(['badLines', 'night', 'rows']);
    expect(body.night).toBe(NORMAL);
    expect(body.badLines).toBe(0);

    const html = await (await app.request(`/digest/${NORMAL}`)).text();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(htmlJobOrder(html));
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(JOBS);
  });

  it('found: row values are the reader values (retries, last status, null owner)', async () => {
    const body = await (await appFor().request(`/api/digest/${NORMAL}`)).json();
    const byJob = (job: string) => body.rows.find((r: { job: string }) => r.job === job);
    expect(byJob('fixtures/refresh')).toMatchObject({ retries: 3, lastStatus: 'ok', runs: 4 });
    expect(byJob('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob('digest/render')).toMatchObject({ owner: null });
  });

  it('no file: 404 with body { error: "no run log", night }', async () => {
    const res = await appFor().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });

  it('empty file: 200, rows [], badLines 0', async () => {
    const res = await appFor().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('bad line: badLines 1, valid rows present', async () => {
    const res = await appFor().request(`/api/digest/${BAD}`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['lane/sync', 'notes/backup']);
  });
});
