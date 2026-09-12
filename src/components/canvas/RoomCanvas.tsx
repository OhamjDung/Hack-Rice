'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameState, CategoryKey, BankTransaction, PlayerCharacter } from '@/engine/Types';
import { transactionScene } from '@/engine/Life';
import { drawAvatar } from './AvatarRenderer';
import { OBJECTS, projectRoom, unprojectRoom, findPath } from './IsometricEngine';
export default function RoomCanvas({ game, onInspect, onScene, onEndingComplete, paused=false }: {
    game: GameState;
    onInspect: (c: CategoryKey | 'desk') => void;
    onScene?: (line:string)=>void;
    onEndingComplete?:()=>void;
    paused?:boolean;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const current = useRef(game);
    const pauseRef=useRef(paused);pauseRef.current=paused;
    const sceneCallback=useRef(onScene);sceneCallback.current=onScene;
    const endingCallback=useRef(onEndingComplete);endingCallback.current=onEndingComplete;
    const endingElapsed=useRef(0),endingNotified=useRef(false);
    const queue=useRef<BankTransaction[]>([]);
    const seen=useRef(new Set(game.transactions.map(t=>t.id)));
    const activity=useRef<PlayerCharacter['state']>('idle');
    const sceneUntil=useRef(0);
    const nextWander=useRef(0);
    const avatar = useRef({ x: 5, y: 5, z: 300, v: 0 });
    const path = useRef<{
        x: number;
        y: number;
    }[]>([]);
    const [zoom, setZoom] = useState(1);
    const [rotation,setRotation]=useState(0);
    const camera=useRef({angle:0,zoom:1});
    const inspectCallback=useRef(onInspect);inspectCallback.current=onInspect;
    const pendingInspect=useRef<CategoryKey|'desk'|null>(null);
    const hover=useRef<typeof OBJECTS[number]|undefined>(undefined);
    current.current = game;
    useEffect(() => { avatar.current = { x: 5, y: 5, z: 300, v: 0 }; path.current = []; }, []);
    useEffect(()=>{const fresh=game.transactions.filter(t=>!seen.current.has(t.id)).reverse();for(const t of fresh)seen.current.add(t.id);queue.current.push(...fresh);},[game.transactions]);
    useEffect(()=>{
        if(game.ending.phase!=='playing')return;
        endingElapsed.current=0;endingNotified.current=false;queue.current=[];
        path.current=findPath(avatar.current,game.ending.kind==='food_shortage'?{x:3,y:3}:game.ending.kind==='power_cut'||game.ending.kind==='eviction'?{x:2,y:5}:{x:7,y:5});activity.current='worried';
    },[game.ending.phase,game.ending.kind]);
    useEffect(()=>{
        if(game.isGameOver||game.command.severity==='info')return;
        const target=game.command.behavior==='tired'?{x:3,y:7}:{x:8,y:2};
        path.current=findPath(avatar.current,target);activity.current=game.command.behavior==='tired'?'sleeping':'worried';
        sceneUntil.current=performance.now()+3500;nextWander.current=performance.now()+5000;
    },[game.command.message,game.command.behavior,game.command.day,game.isGameOver]);
    useEffect(()=>{if(game.isGameOver)return;if((game.life.lastRestTurn||game.life.lastTidyTurn)&&game.player.targetPosition){path.current=findPath(avatar.current,game.player.targetPosition);activity.current=game.player.state;sceneUntil.current=performance.now()+7000;nextWander.current=performance.now()+12000;sceneCallback.current?.(game.life.lastEvent);}},[game.life.lastRestTurn,game.life.lastTidyTurn]);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let frame = 0, last = 0;
        const draw = (time: number) => {
            const dt = Math.min((time - last) / 1000, .04);
            last = time;
            const g = current.current;
            camera.current.angle+=(rotation*Math.PI/180-camera.current.angle)*(reduced?1:Math.min(1,dt*9));
            camera.current.zoom+=(zoom-camera.current.zoom)*(reduced?1:Math.min(1,dt*10));
            const angle=camera.current.angle;
            const a = avatar.current;
            if(pauseRef.current&&g.ending.phase!=='playing'){last=time;frame=requestAnimationFrame(draw);return;}
            if(g.isGameOver&&g.ending.phase!=='playing'){path.current=[];queue.current=[];activity.current='dead';}
            if(g.ending.phase==='playing'){
                endingElapsed.current+=dt;
                if(endingElapsed.current>3){activity.current=g.ending.kind==='power_cut'||g.ending.kind==='eviction'?'worried':'dead';path.current=[];}else if(g.ending.kind==='exhaustion'&&!path.current.length){path.current=findPath(a,{x:Math.floor(endingElapsed.current)%2?5:8,y:5});}
                if(!endingNotified.current&&endingElapsed.current>6){
                    endingNotified.current=true;endingCallback.current?.();
                }
            }
            if(pendingInspect.current&&!path.current.length&&!g.isGameOver){const item=pendingInspect.current;pendingInspect.current=null;inspectCallback.current(item);}
            if(!pendingInspect.current&&!path.current.length&&time>sceneUntil.current&&!g.isGameOver){
                const event=queue.current.shift();
                if(event){const scene=transactionScene(event);path.current=findPath(a,scene.target);activity.current=scene.activity;sceneUntil.current=time+7000;sceneCallback.current?.(scene.line);nextWander.current=time+10000;}
                else if(time>nextWander.current){const warning=g.command.severity!=='info';const target=warning?(g.command.behavior==='tired'?{x:3,y:7}:Math.floor(time/5000)%2?{x:8,y:2}:{x:5,y:4}):g.life.foodStock<25?{x:3,y:3}:g.life.energy<30?{x:3,y:7}:g.life.stress>=35?{x:8,y:2}:[{x:5,y:4},{x:9,y:9},{x:3,y:7}][Math.floor(time/10000)%3];path.current=findPath(a,target);activity.current=warning?(g.command.behavior==='tired'?'sleeping':'worried'):g.life.energy<30?'sleeping':'idle';nextWander.current=time+(warning?5000:12000);}
            }
            const target = path.current[0];
            if (target) {
                const dx = target.x - a.x, dy = target.y - a.y, d = Math.hypot(dx, dy);
                if (reduced || d < .08) {
                    a.x = target.x;
                    a.y = target.y;
                    path.current.shift();
                }
                else {
                    const speed=g.life.energy<30?1.2:3;
                    a.x += dx / d * dt * speed;
                    a.y += dy / d * dt * speed;
                }
            }
            if (a.z > 0) {
                a.v += dt * 850;
                a.z = reduced ? 0 : Math.max(0, a.z - a.v * dt);
            }
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (canvas.width !== 720 * dpr) {
                canvas.width = 720 * dpr;
                canvas.height = 520 * dpr;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, 720, 520);
            ctx.translate(360, 285);
            ctx.scale(camera.current.zoom, camera.current.zoom);
            ctx.translate(-360, -285);
            const p = (x: number, y: number, z = 0) => { const t = projectRoom(x, y, angle); return [t.screenX, t.screenY - z] as const; };
            const poly = (points: readonly (readonly number[])[], fill: string, stroke?: string) => { ctx.beginPath(); points.forEach((v, i) => i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = .7;
                ctx.stroke();
            } };
            let furnitureMode=false,drawing=false;
            const renderQueue:{depth:number;draw:()=>void}[]=[];
            const depth=(x:number,y:number)=>projectRoom(x,y,angle).screenY;
            const box = (x:number,y:number,w:number,d:number,h:number,top:string,left:string,right:string,base=0) => {
                if(furnitureMode&&!drawing){renderQueue.push({depth:depth(x+w/2,y+d/2)+base*.001,draw:()=>box(x,y,w,d,h,top,left,right,base)});return;}
                const yf=Math.cos(angle)-Math.sin(angle)>=0?y+d:y,xf=Math.cos(angle)+Math.sin(angle)>=0?x+w:x;
                const faces=[{depth:depth(x+w/2,yf),points:[p(x,yf,base),p(x+w,yf,base),p(x+w,yf,h+base),p(x,yf,h+base)],fill:left},{depth:depth(xf,y+d/2),points:[p(xf,y,base),p(xf,y+d,base),p(xf,y+d,h+base),p(xf,y,h+base)],fill:right}];
                faces.sort((a,b)=>a.depth-b.depth).forEach(f=>poly(f.points,f.fill));
                poly([p(x,y,h+base),p(x+w,y,h+base),p(x+w,y+d,h+base),p(x,y+d,h+base)],top);
            };
            ctx.save();
            ctx.filter = 'blur(16px)';
            poly([p(0, 0, -25), p(12, 0, -25), p(12, 12, -25), p(0, 12, -25)], '#cbc7b8');
            ctx.restore();
            box(0, 0, 12, 12, 12, '#cabc9f', '#b1a386', '#978e77', -12);
            for (let x = 0; x < 12; x++)
                for (let y = 0; y < 12; y++)
                    poly([p(x, y), p(x + 1, y), p(x + 1, y + 1), p(x, y + 1)], (x + y) % 2 ? '#ddceb0' : '#e5d6ba', '#c9b995');
            ctx.save();ctx.globalAlpha=Math.cos(angle)+Math.sin(angle)<0?.18:1;
            box(-.2, 0, .2, 12, 108, '#e4dfd0', '#d6d6c4', '#c5c5b3');
            ctx.restore();ctx.save();ctx.globalAlpha=Math.cos(angle)-Math.sin(angle)<0?.18:1;
            box(0, -.2, 12, .2, 108, '#e4dfd0', g.progression.owned.includes('house')?'#aec3bf':'#dce0cd', '#c5c5b3');
            ctx.restore();ctx.save();ctx.globalAlpha=Math.cos(angle)-Math.sin(angle)<0?.18:1;
            // Window, art and wall details are projected into the wall planes.
            poly([p(3, 0, 83), p(6, 0, 83), p(6, 0, 30), p(3, 0, 30)], '#f5f1df', '#999e8f');
            poly([p(3.15, 0, 80), p(5.85, 0, 80), p(5.85, 0, 33), p(3.15, 0, 33)], '#b4d3d0');
            poly([p(4.43, -.01, 80), p(4.57, -.01, 80), p(4.57, -.01, 33), p(4.43, -.01, 33)], '#faf7e9');
            poly([p(3.15, 0, 57), p(5.85, 0, 57), p(5.85, 0, 54), p(3.15, 0, 54)], '#faf7e9');
            poly([p(0, 6, 82), p(0, 7.5, 82), p(0, 7.5, 43), p(0, 6, 43)], '#b99c73');
            poly([p(0, 6.15, 78), p(0, 7.35, 78), p(0, 7.35, 47), p(0, 6.15, 47)], '#f4e9cd');
            ctx.restore();
            // Rug and furniture, in back-to-front order.
            poly([p(5, 4.5), p(10.5, 4.5), p(10.5, 9.8), p(5, 9.8)], '#9ba994');
            poly([p(5.25, 4.75), p(10.25, 4.75), p(10.25, 9.55), p(5.25, 9.55)], g.progression.owned.includes('rug')?'#c58665':'#b4bea5');
            furnitureMode=true;
            box(2, 2, 1.2, 1.2, 68, '#f7f4e7', '#e9e6d9', '#c4c7b9');
            box(3.21, 2.5, .04, .12, 17, '#7d8879', '#7d8879', '#7d8879', 20);
            box(2, 2, 1.21, 1.21, 1, '#b7b9aa', '#b7b9aa', '#b7b9aa', 44);
            box(0, 3, 1.2, 2.4, 34, '#ece9dc', '#c5b496', '#b19b7e');
            box(.2, 3.3, .7, .8, 2, '#929f9a', '#929f9a', '#929f9a', 34);
            box(.2, 4.45, .7, .7, 2, '#444e46', '#444e46', '#444e46', 34);
            box(9, 1, 2, 1.4, 38, '#bb946b', '#9a7757', '#86674d');
            box(9.4, 1.35, .9, .12, 27, '#414c47', '#34453f', '#53645a', 38);
            box(9.48, 1.48, .74, .03, 18, '#a0b5a0', '#a0b5a0', '#a0b5a0', 43);
            box(9.6, 3, 1, 1, 19, '#74836d', '#596d57', '#4b5c49');
            box(2, 8, 2.6, 3, 17, '#b99b79', '#a78b6c', '#927759');
            box(2, 8, 2.6, .25, 46, '#ba9871', '#b28f69', '#927759');
            box(2.1, 8.3, 2.4, 2.6, 11, '#f7f0df', '#e2d9c5', '#c9c2ae', 17);
            box(2.1, 9.2, 2.4, 1.7, 5, '#d2956f', '#c17f58', '#ad704f', 28);
            box(2.35, 8.4, 1.8, .6, 6, '#fff9e9', '#e4ddca', '#d6ccba', 28);
            box(8, 7, 2.8, 1.4, 21, '#a8b298', '#89967d', '#78866f');
            box(8, 7, 2.8, .3, 40, '#a0ad90', '#8d9b7e', '#7a896e');
            box(8, 7, .35, 1.4, 31, '#aeb99d', '#8e9d80', '#78866f');
            box(10.45, 7, .35, 1.4, 31, '#aeb99d', '#8e9d80', '#78866f');
            box(8.55, 7.45, .7, .6, 8, '#e4d4b4', '#c5b597', '#c5b597', 22);
            box(6, 6, 1.4, 1, 19, '#c4a17c', '#a58460', '#92704f');
            box(6.25, 6.2, .55, .4, 3, '#e7e1c6', '#c7c5ac', '#b7b59c', 19);
            box(6, 11, 1, .5, 25, '#b59776', '#987a5a', '#86694e');
            box(6.3, 11.1, .25, .15, 3, '#dbc15e', '#a49144', '#a49144', 25);
            const plant = (x: number, y: number) => { if(!drawing){renderQueue.push({depth:depth(x+.32,y+.32),draw:()=>plant(x,y)});return;} box(x, y, .65, .65, 15, '#d1b09a', '#c28f73', '#a97356'); const [px, py] = p(x + .32, y + .32, 17); ctx.strokeStyle = '#617650'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 32); ctx.stroke(); for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 ? '#7f9667' : '#5e7954';
                ctx.beginPath();
                ctx.ellipse(px + (i % 2 ? 7 : -7), py - 8 - i * 5, 10, 5, i % 2 ? -.6 : .6, 0, Math.PI * 2);
                ctx.fill();
            } };
            plant(10.7, 4.2);
            plant(.7, 10.5);
            if (g.progression.owned.includes('plant'))
                plant(7, .8);
            if(g.progression.owned.includes('lamp')){box(1,7,.7,.7,20,'#b59c73','#947c59','#7e694b');box(1.3,7.3,.12,.12,30,'#c9b277','#ad995f','#ad995f',20);box(1.1,7.1,.5,.5,9,'#f4dba1','#d4ba83','#baa16c',48);}
            if(g.progression.owned.includes('bookshelf')){box(7,0,1.6,.55,62,'#b58d64','#94704f','#7b5c41');for(let i=0;i<6;i++)box(7.1+i*.2,.5,.13,.12,16,i%2?'#839479':'#c89470','#a28463','#a28463',14);}
            const pos = p(a.x + .5, a.y + .5);
            renderQueue.push({depth:depth(a.x+.5,a.y+.5),draw:()=>{
                ctx.save();
                if(g.ending.phase!=='none'&&activity.current==='dead'){const fall=reduced?1:Math.min(1,Math.max(0,endingElapsed.current-3)*1.8);ctx.translate(pos[0],pos[1]);ctx.rotate(-Math.PI/2*fall);ctx.translate(-pos[0],-pos[1]);}
                drawAvatar(ctx,pos[0],pos[1],a.z,{...g.player,state:activity.current},reduced?0:time,!!target);ctx.restore();
            }});
            for(let i=0;i<g.life.clutter;i++){const x=7+(i%3)*.7,y=9+Math.floor(i/3)*.5;box(x,y,.45,.4,9,'#cda777','#aa835c','#946c48');}
            drawing=true;renderQueue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());furnitureMode=false;
            if(hover.current&&!g.isGameOver){const o=hover.current;poly([p(o.x,o.y),p(o.x+o.w,o.y),p(o.x+o.w,o.y+o.d),p(o.x,o.y+o.d)],'rgba(231,220,160,.2)','#ead69c');}
            if (!target && activity.current !== 'idle' && a.z === 0) {
                ctx.font = '10px sans-serif';
                const caption = g.isGameOver?(g.ending.kind==='food_shortage'?'No food left…':g.ending.kind==='power_cut'||g.ending.kind==='eviction'?'The lights are gone…':'I cannot keep this pace…'):g.life.foodStock<25?'Nothing for dinner...':g.life.stress>=35?'How will I pay the bills?':activity.current === 'eating' ? 'Making a meal' : activity.current === 'working' ? 'Taking care of things' : activity.current === 'sleeping' ? 'Z z z' : activity.current === 'partying' ? 'Just one more episode' : 'Heading out';
                const width = ctx.measureText(caption).width;
                ctx.fillStyle = g.command.severity!=='info'?'#ffe1a3':'#fffff5';
                ctx.beginPath();
                ctx.roundRect(pos[0] - width / 2 - 7, pos[1] - 82, width + 14, 18, 5);
                ctx.fill();
                ctx.fillStyle = '#596947';
                ctx.fillText(caption, pos[0] - width / 2, pos[1] - 69);
            }
            if (g.housingDeficits||g.ending.kind==='eviction') {
                const [x, y] = p(2, 8, 56);
                ctx.fillStyle = '#fff0da';
                ctx.fillRect(x - 22, y - 12, 44, 22);
                ctx.fillStyle = '#ab493c';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText('RENT DUE', x - 19, y + 2);
            }
            if (!g.life.powerOn||(g.ending.kind==='power_cut'||g.ending.kind==='eviction')&&endingElapsed.current>1.5) {
                ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='rgba(12,20,38,.72)';ctx.fillRect(0,0,720,520);ctx.restore();
            }
            if(g.life.stress>=15){for(let i=0;i<3;i++)box(9+i*.3,1.8,.4,.35,1,'#f7e5d4','#d9b7a1','#d9b7a1',39+i);}
            if (g.life.foodStock < 25||g.ending.kind==='food_shortage') {
                const [x, y] = p(3, 2, 74);
                ctx.fillStyle = '#77573c';
                ctx.font = '11px sans-serif';
                ctx.fillText('Empty', x - 12, y);
            }
            if(g.ending.phase==='playing'&&endingElapsed.current>3){ctx.fillStyle=`rgba(25,31,29,${reduced?.55:Math.min(.55,(endingElapsed.current-3)*.18)})`;ctx.fillRect(0,0,720,520);}
            frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [zoom,rotation]);
    function pointer(e:React.MouseEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect(),z=camera.current.zoom;return {x:((e.clientX-r.left)/r.width*720-360)/z+360,y:((e.clientY-r.top)/r.height*520-285)/z+285};}
    function hitAt(x:number,y:number){return [...OBJECTS].sort((a,b)=>projectRoom(b.x,b.y,camera.current.angle).screenY-projectRoom(a.x,a.y,camera.current.angle).screenY).find(o=>{const p=projectRoom(o.x+o.w/2,o.y+o.d/2,camera.current.angle);return Math.abs(x-p.screenX)<34&&y>p.screenY-65&&y<p.screenY+12;});}
    function click(e:React.MouseEvent<HTMLCanvasElement>){if(current.current.isGameOver)return;const {x,y}=pointer(e),hit=hitAt(x,y);pendingInspect.current=hit?.id??null;const p=unprojectRoom(x,y,camera.current.angle);path.current=findPath(avatar.current,hit||{x:p.gridX,y:p.gridY});nextWander.current=performance.now()+10000;}
    return <div className="room-scene"><canvas ref={ref} onClick={click} onMouseMove={e=>{const p=pointer(e);hover.current=hitAt(p.x,p.y);e.currentTarget.style.cursor=hover.current?'pointer':'crosshair';}} onMouseLeave={()=>{hover.current=undefined;}} aria-label="Your rotatable apartment. Click furniture to walk over and interact." role="img"/><div className="scene-controls" aria-label="Room camera"><button aria-label="Rotate room left" onClick={()=>setRotation(r=>r-45)}>↶</button><span>{((rotation%360)+360)%360}°</span><button aria-label="Rotate room right" onClick={()=>setRotation(r=>r+45)}>↷</button><button aria-label="Reset room view" onClick={()=>{setRotation(0);setZoom(1);}}>Reset</button><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.8,z-.1))} disabled={zoom<=.8}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(1.3,z+.1))} disabled={zoom>=1.3}>+</button></div></div>;
}
