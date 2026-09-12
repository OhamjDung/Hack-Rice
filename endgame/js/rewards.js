/* Personal-record persistence + diminishing-returns reward scaling. */
const RECORD_STORAGE_KEY = 'endgame-investing-record-v1';

function loadRecord() {
  try {
    const raw = localStorage.getItem(RECORD_STORAGE_KEY);
    if (!raw) return { bestGain: 0, bestValue: 0, runs: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestGain: Number(parsed.bestGain) || 0,
      bestValue: Number(parsed.bestValue) || 0,
      runs: Number(parsed.runs) || 0,
    };
  } catch {
    return { bestGain: 0, bestValue: 0, runs: 0 };
  }
}

function saveRecord(record) {
  try { localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(record)); } catch { /* storage unavailable */ }
}

/**
 * reward = baseReward * clamp(floor, cap, log(1 + improvementRatio) * scalingFactor)
 * improvementRatio = max(0, currentGain) / priorBest (or a safe default on the first run).
 * A below-record run still nets a small non-zero reward (the floor) so
 * experimentation isn't punished. A new (profitable) record adds a flat bonus.
 */
function calcReward(currentGain, record, opts = {}) {
  const baseReward = opts.baseReward ?? 100;
  const scalingFactor = opts.scalingFactor ?? 1.6;
  const cap = opts.cap ?? 3;
  const floor = opts.floor ?? 0.2;
  const recordBonus = opts.recordBonus ?? 0.5;

  const priorBest = record.bestGain ?? 0;
  const isFirstRun = (record.runs ?? 0) === 0;
  const safePrior = priorBest > 0 ? priorBest : Math.max(1, Math.abs(currentGain) || 1);
  const improvementRatio = Math.max(0, currentGain) / safePrior;

  let multiplier = Math.log(1 + improvementRatio) * scalingFactor;
  multiplier = Math.max(floor, Math.min(cap, multiplier));

  // A record needs a real profit — a losing first run doesn't earn the badge/bonus.
  const isNewRecord = currentGain > 0 && (isFirstRun || currentGain > priorBest);
  let reward = Math.round(baseReward * multiplier);
  if (isNewRecord) reward += Math.round(baseReward * recordBonus);

  return {
    reward,
    multiplier: Math.round(multiplier * 100) / 100,
    isNewRecord,
    priorBest,
    improvementRatio: Math.round(improvementRatio * 100) / 100,
  };
}
