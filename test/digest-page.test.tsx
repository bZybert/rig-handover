import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders 2026-10-28 with warn rows', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>digest · 2026-10-28</h1>');
    expect(html).toContain('bad lines: 1');
    expect(html).toContain('<tr class="warn">');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('<p class="warn">no run log for 2026-01-01</p>');
  });
});
