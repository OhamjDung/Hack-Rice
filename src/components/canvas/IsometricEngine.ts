export const TILE_WIDTH = 48, TILE_HEIGHT = 24, GRID_SIZE = 12;
export const OBJECTS = [{ id: 'food', label: 'Refrigerator', x: 2, y: 2, w: 1.2, d: 1.2 }, { id: 'utilities', label: 'Kitchen & utilities', x: 0, y: 3, w: 1.2, d: 2.4 }, { id: 'housing', label: 'Bed & rent', x: 2, y: 8, w: 2.6, d: 3 }, { id: 'leisure', label: 'Sofa & downtime', x: 8, y: 7, w: 2.8, d: 1.4 }, { id: 'savings', label: 'Savings ledger', x: 6, y: 6, w: 1.4, d: 1 }, { id: 'transit', label: 'Car keys', x: 6, y: 11, w: 1, d: .5 }, { id: 'desk', label: 'Work desk', x: 9, y: 1, w: 2, d: 1.4 }] as const;
export function gridToScreen(x: number, y: number, ox = 360, oy = 140) { return { screenX: ox + (x - y) * TILE_WIDTH / 2, screenY: oy + (x + y) * TILE_HEIGHT / 2 }; }
export function rotateGrid(x:number,y:number,angle:number){const c=Math.cos(angle),s=Math.sin(angle);return {x:6+(x-6)*c-(y-6)*s,y:6+(x-6)*s+(y-6)*c};}
export function projectRoom(x:number,y:number,angle:number){const p=rotateGrid(x,y,angle);return gridToScreen(p.x,p.y);}
export function unprojectRoom(x:number,y:number,angle:number){const gx=((x-360)/24+(y-140)/12)/2,gy=((y-140)/12-(x-360)/24)/2;const p=rotateGrid(gx,gy,-angle);return {gridX:Math.floor(p.x),gridY:Math.floor(p.y)};}
export function screenToGrid(x: number, y: number, ox = 360, oy = 140) { return { gridX: Math.floor(((x - ox) / (TILE_WIDTH / 2) + (y - oy) / (TILE_HEIGHT / 2)) / 2), gridY: Math.floor(((y - oy) / (TILE_HEIGHT / 2) - (x - ox) / (TILE_WIDTH / 2)) / 2) }; }
export function blocked(x: number, y: number) { return x < 0 || y < 0 || x >= 12 || y >= 12 || OBJECTS.some(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.d); }
export function findPath(start: {
    x: number;
    y: number;
}, goal: {
    x: number;
    y: number;
}) {
    const origin = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const key = (p: {
        x: number;
        y: number;
    }) => `${p.x},${p.y}`;
    const queue = [origin];
    const visited = new Set([key(origin)]);
    const parents = new Map<string, {
        x: number;
        y: number;
    }>();
    let end = origin;
    let best = Infinity;
    while (queue.length) {
        const p = queue.shift()!;
        const distance = Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
        if (distance < best) {
            best = distance;
            end = p;
        }
        if (distance === 0)
            break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = { x: p.x + dx, y: p.y + dy };
            if (blocked(n.x, n.y) || visited.has(key(n)))
                continue;
            visited.add(key(n));
            parents.set(key(n), p);
            queue.push(n);
        }
    }
    const path = [];
    while (key(end) !== key(origin)) {
        path.unshift(end);
        end = parents.get(key(end))!;
    }
    return path;
}
