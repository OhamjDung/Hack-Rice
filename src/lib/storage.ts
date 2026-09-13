import { stateSchema, type GameState } from '@/engine/Types';
const KEY = 'room-economy-v1';
export function loadGame(): GameState | null { const raw = localStorage.getItem(KEY); if (!raw)
    return null; const parsed = stateSchema.safeParse(JSON.parse(raw)); if (!parsed.success)
    throw new Error('Your saved game could not be read. Start a new run or import a valid save.'); return parsed.data; }
export function saveGame(state: GameState) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function exportGame(state: GameState) { const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'cashbound-save.json'; a.click(); URL.revokeObjectURL(url); }
