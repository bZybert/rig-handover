import type { DigestRow } from '../digest/types.js';

const dash = '—';

function isWarn(r: DigestRow): boolean {
  return r.retries >= 3 || r.lastStatus === 'fail';
}

function BadLines({ n }: { n: number }) {
  return n > 0 ? <p class="mute">bad lines: {n}</p> : <></>;
}

export function DigestMissing({ night }: { night: string }) {
  return <p class="warn">no run log for {night}</p>;
}

export function DigestPage({ night, rows, badLines }: { night: string; rows: DigestRow[]; badLines: number }) {
  if (rows.length === 0) {
    return (
      <>
        <p class="mute">nothing ran</p>
        <BadLines n={badLines} />
      </>
    );
  }
  return (
    <>
      <h1>digest · {night}</h1>
      <table>
        <thead>
          <tr>
            <th>job</th>
            <th>owner</th>
            <th>runs</th>
            <th>retries</th>
            <th>last status</th>
            <th>last error</th>
            <th>first</th>
            <th>last</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr class={isWarn(r) ? 'warn' : undefined}>
              <td>{r.job}</td>
              <td>{r.owner ?? dash}</td>
              <td>{r.runs}</td>
              <td>{r.retries}</td>
              <td>{r.lastStatus}</td>
              <td>{r.lastError ?? dash}</td>
              <td>{r.firstAt}</td>
              <td>{r.lastAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <BadLines n={badLines} />
    </>
  );
}
