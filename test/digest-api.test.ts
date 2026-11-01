import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON', () => {
  it('returns the reader rows in reader order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = await res.json();
    const digest = readNight('runs', '2026-10-28');
    expect(res.status).toBe(200);
    if (!digest.found) throw new Error('fixture missing');
    expect(body).toEqual({ night: '2026-10-28', rows: digest.rows, badLines: digest.badLines });
  });

  it('404s for a night with no run log', async () => {
    const res = await createApp(config).request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2020-01-01' });
  });
});
