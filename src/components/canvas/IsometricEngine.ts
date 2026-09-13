export const TILE_WIDTH = 48, TILE_HEIGHT = 24, GRID_SIZE = 12;
// Extra drawing space accommodates the rotating room and camera zoom.
export const ROOM_VIEW={width:1280,height:960,maxZoom:2} as const;
export const OBJECTS = [{ id: 'food', label: 'Refrigerator', x: 0, y: 1.4, w: 1.2, d: 1.2 }, { id: 'utilities', label: 'Kitchen & utilities', x: 0, y: 3, w: 1.2, d: 2.4 }, { id: 'housing', label: 'Bed & rent', x: 9, y: 1, w: 2.6, d: 3 }, { id: 'leisure', label: 'Sofa & downtime', x: 6.5, y: 6, w: 2.8, d: 1.4 }, { id: 'savings', label: 'Savings ledger', x: 7.2, y: 8.1, w: 1.4, d: 1 }, { id: 'transit', label: 'Car keys', x: 6, y: 11, w: 1, d: .5 }, { id: 'desk', label: 'Work desk', x: 1, y: 7, w: 2, d: 1.4 }] as const;
export type FurnitureId = typeof OBJECTS[number]['id'];
export type RoomObject = { id: FurnitureId; label: string; x: number; y: number; w: number; d: number };
export type RoomLayout = Partial<Record<FurnitureId, {x:number;y:number}>>;
export function roomObjects(layout:RoomLayout={}):RoomObject[]{return OBJECTS.map(o=>({...o,...layout[o.id]}));}
const overlaps=(a:{x:number;y:number;w:number;d:number},b:{x:number;y:number;w:number;d:number})=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.d&&a.y+a.d>b.y;
export function placementError(objects:readonly RoomObject[],id:FurnitureId,x:number,y:number,avatar:{x:number;y:number}):string|null{
    const item=objects.find(o=>o.id===id)!;
    const next={...item,x,y};
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x+next.w>12||y+next.d>12)return 'Keep furniture inside the room.';
    const decorations=[{x:11,y:4.4,w:.64,d:.64},{x:.7,y:10.5,w:.64,d:.64},{x:7.9,y:1,w:.9,d:.85},{x:7,y:.8,w:.64,d:.64},{x:8,y:3,w:.7,d:.7},{x:7,y:0,w:1.6,d:.62}];
    if(objects.some(o=>o.id!==id&&overlaps(next,o))||decorations.some(o=>overlaps(next,o)))return 'That space is occupied.';
    if(overlaps(next,{x:Math.floor(avatar.x),y:Math.floor(avatar.y),w:1,d:1}))return 'Leave space for your character.';
    const updated=objects.map(o=>o.id===id?next:o);
    for(const o of updated){
        const route=findPath(avatar,o,updated);
        const end=route.at(-1)||avatar;
        if(Math.hypot(Math.max(o.x-end.x,0,end.x-(o.x+o.w)),Math.max(o.y-end.y,0,end.y-(o.y+o.d)))>1.5)return 'Leave a walking path to every item.';
    }
    return null;
}
export function gridToScreen(x: number, y: number, ox = 360, oy = 140) { return { screenX: ox + (x - y) * TILE_WIDTH / 2, screenY: oy + (x + y) * TILE_HEIGHT / 2 }; }
export function rotateGrid(x:number,y:number,angle:number){const c=Math.cos(angle),s=Math.sin(angle);return {x:6+(x-6)*c-(y-6)*s,y:6+(x-6)*s+(y-6)*c};}
export function projectRoom(x:number,y:number,angle:number){const p=rotateGrid(x,y,angle);return gridToScreen(p.x,p.y);}
/** Exterior walls, ordered back-to-front where both face the camera. */
export function foregroundWalls(angle:number):('x'|'y')[]{
    const walls:('x'|'y')[]=[];
    if(Math.cos(angle)+Math.sin(angle)<-1e-8)walls.push('x');
    if(Math.cos(angle)-Math.sin(angle)<-1e-8)walls.push('y');
    return walls.sort((a,b)=>{
        const center=(wall:'x'|'y')=>projectRoom(wall==='x'?-.1:6,wall==='x'?6:-.1,angle).screenY;
        return center(a)-center(b);
    });
}
/** Geometric footprint of full exterior walls; cutaway walls do not block interaction. */
export function pointBehindWall(x:number,y:number,angle:number){
    return foregroundWalls(angle).some(wall=>{
        const start=projectRoom(wall==='x'?-.2:0,wall==='x'?0:-.2,angle);
        const end=projectRoom(wall==='x'?-.2:12,wall==='x'?12:-.2,angle);
        const points=[[start.screenX,start.screenY],[end.screenX,end.screenY],[end.screenX,end.screenY-108],[start.screenX,start.screenY-108]];
        let inside=false;
        for(let i=0,j=3;i<4;j=i++){
            const [ax,ay]=points[i],[bx,by]=points[j];
            if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
        }
        return inside;
    });
}
export function unprojectRoom(x:number,y:number,angle:number){const gx=((x-360)/24+(y-140)/12)/2,gy=((y-140)/12-(x-360)/24)/2;const p=rotateGrid(gx,gy,-angle);return {gridX:Math.floor(p.x),gridY:Math.floor(p.y)};}
export function screenToGrid(x: number, y: number, ox = 360, oy = 140) { return { gridX: Math.floor(((x - ox) / (TILE_WIDTH / 2) + (y - oy) / (TILE_HEIGHT / 2)) / 2), gridY: Math.floor(((y - oy) / (TILE_HEIGHT / 2) - (x - ox) / (TILE_WIDTH / 2)) / 2) }; }
export function blocked(x: number, y: number, objects:readonly RoomObject[]=OBJECTS) { return x < 0 || y < 0 || x >= 12 || y >= 12 || objects.some(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.d); }
export function findPath(start: {
    x: number;
    y: number;
}, goal: {
    x: number;
    y: number;
}, objects:readonly RoomObject[]=OBJECTS) {
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
            if (blocked(n.x, n.y,objects) || visited.has(key(n)))
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
