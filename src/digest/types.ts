// Plan morning-digest § 1. The contract every part of § 2 builds against; keep it stable.
// The reader itself is `readNight` in `./read.ts` (import from './read.js').

/** Status of one line in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One row per job for a night. */
export type DigestRow = {
  job: string;
  /** Owner on the job's last line. `null` stays `null`; the view shows it as `—`. */
  owner: string | null;
  /** Number of valid lines for the job. */
  runs: number;
  /** Number of valid lines for the job with status `retry`. */
  retries: number;
  /** Status of the job's last line (file order). */
  lastStatus: RunStatus;
  /** Most recent `error` seen for the job (any status), or `null` if it never had one. */
  lastError: string | null;
  /** `at` of the job's first line, exactly as in the log (offset kept, never converted to UTC). */
  firstAt: string;
  /** `at` of the job's last line, exactly as in the log. */
  lastAt: string;
};

/**
 * Result of reading one night.
 * - `found: false`: there is no `runs/<night>.jsonl` (or `night` is not `YYYY-MM-DD`). § 2a: 404.
 * - `found: true` with `rows: []`: the file exists but nothing ran. § 2a: "nothing ran".
 */
export type NightDigest =
  | { night: string; found: false }
  | {
      night: string;
      found: true;
      /** Sorted by job. */
      rows: DigestRow[];
      /** Non-blank lines that didn't parse as JSON or didn't validate. Counted, never thrown. */
      badLines: number;
    };

/** Reads `<runsDir>/<night>.jsonl`. Never throws for a missing file or a bad line. */
export type ReadNight = (runsDir: string, night: string) => NightDigest;
