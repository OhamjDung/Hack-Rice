// Best-effort, read-only bridge to the main game's save (localStorage key `room-economy-v1`,
// written by src/lib/storage.ts). Never imports the main app's engine/types — this feature
// must stay isolated and keep working even if that schema changes; a bad/missing read just
// means the profile form falls back to its own default.
const MAIN_GAME_STORAGE_KEY = 'room-economy-v1';

export function readMainGameAnnualIncome(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAIN_GAME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const monthlyIncome = parsed?.profile?.income;
    if (typeof monthlyIncome !== 'number' || !Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return null;
    return Math.round(monthlyIncome * 12);
  } catch {
    return null;
  }
}
