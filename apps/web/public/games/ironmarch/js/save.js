// Persistence — versioned localStorage save (save-systems pattern: versioned
// schema, defensive load with defaults on any parse/shape error, plain data
// only — never live entity references). localStorage writes are atomic per
// key, which stands in for the temp-file-then-rename rule.
const KEY = 'ironmarch.save';
const VERSION = 1;

function defaults() {
  return {
    version: VERSION,
    settings: { muted: false },
    records: { wins: 0, losses: 0, fastestWinMs: null },
  };
}

let cache = null;

export function loadSave() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // Defensive: validate shape; unknown/future versions fall back to
      // defaults rather than crashing. (Migrations slot in here at v2+.)
      if (d && d.version === VERSION && d.settings && d.records) {
        cache = {
          version: VERSION,
          settings: { muted: !!d.settings.muted },
          records: {
            wins: Number.isFinite(d.records.wins) ? d.records.wins : 0,
            losses: Number.isFinite(d.records.losses) ? d.records.losses : 0,
            fastestWinMs: Number.isFinite(d.records.fastestWinMs) ? d.records.fastestWinMs : null,
          },
        };
        return cache;
      }
    }
  } catch {
    /* malformed JSON or storage unavailable — fall through to defaults */
  }
  cache = defaults();
  return cache;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full/unavailable — persistence is best-effort */
  }
}

export function updateSettings(patch) {
  const d = loadSave();
  Object.assign(d.settings, patch);
  write();
}

/** Record a finished match (autosave boundary: game end). */
export function recordResult(won, elapsedMs) {
  const d = loadSave();
  if (won) {
    d.records.wins += 1;
    if (d.records.fastestWinMs === null || elapsedMs < d.records.fastestWinMs) {
      d.records.fastestWinMs = elapsedMs;
    }
  } else {
    d.records.losses += 1;
  }
  write();
  return d.records;
}

export function getRecords() {
  return loadSave().records;
}
