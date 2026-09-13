'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameState, CategoryKey, BankTransaction, PlayerCharacter } from '@/engine/Types';
import { transactionScene } from '@/engine/Life';
import { drawAvatar } from './AvatarRenderer';
import { drawStockBoard } from './StockBoard';
import { OBJECTS, ROOM_VIEW, projectRoom, unprojectRoom, findPath as routePath, foregroundWalls, roomObjects, placementError, type RoomLayout, type FurnitureId, type RoomObject } from './IsometricEngine';
export default function RoomCanvas({ game, onInspect, onScene, onEndingComplete, onLayoutChange, onSwipeCharacter, paused=false, investWalk=false, onArriveInvest, guests, readOnly=false }: {
    game: GameState;
    onLayoutChange: (layout:RoomLayout)=>void;
    onInspect: (c: CategoryKey | 'desk') => void;
    onScene?: (line:string)=>void;
    onEndingComplete?:()=>void;
    /** Swipe (drag) the character sprite itself past a distance threshold — used to trigger visiting another room. */
    onSwipeCharacter?: () => void;
    paused?:boolean;
    investWalk?:boolean;
    onArriveInvest?:()=>void;
    /** Other accounts currently present in this room — rendered as simple static labeled markers, not fully animated characters. */
    guests?: { label: string; color?: string }[];
    /** True when viewing someone else's saved room (the "visit" feature) — disables walk/inspect/arrange clicks, keeping only camera rotate/zoom. */
    readOnly?: boolean;
}) {
    const [arranging,setArranging]=useState(false);
    const [selected,setSelected]=useState<FurnitureId>('leisure');
    const [layoutMessage,setLayoutMessage]=useState('Choose furniture, then click a floor tile or use the move buttons.');
    const arrangeRef=useRef(arranging);arrangeRef.current=arranging;
    const selectionRef=useRef(selected);selectionRef.current=selected;
    const objectsRef=useRef(roomObjects(game.roomLayout));objectsRef.current=roomObjects(game.roomLayout);
    function findPath(start:{x:number;y:number},goal:{x:number;y:number}){
        let target=goal;
        if(!objectsRef.current.includes(goal as RoomObject)){
            const id=goal.x===8&&goal.y===2?'housing':goal.x===2&&goal.y===2?'food':goal.x===6&&goal.y===9?'leisure':undefined;
            if(id)target=objectsRef.current.find(o=>o.id===id)!;
        }
        return routePath(start,target,objectsRef.current);
    }
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
    const [zoom, setZoom] = useState(1.1);
    const [rotation,setRotation]=useState(0);
    const camera=useRef({angle:0,zoom:1.1});
    const requestedCamera=useRef({rotation,zoom});requestedCamera.current={rotation,zoom};
    const drag=useRef<{id:number;x:number;y:number;rotation:number;moved:boolean}|null>(null);
    const charDrag=useRef<{id:number;x:number}|null>(null);
    const launch=useRef<{t:number}|null>(null);
    const onSwipeCharacterRef=useRef(onSwipeCharacter);onSwipeCharacterRef.current=onSwipeCharacter;
    const inspectCallback=useRef(onInspect);inspectCallback.current=onInspect;
    const pendingInspect=useRef<CategoryKey|'desk'|null>(null);
    const hover=useRef<RoomObject|undefined>(undefined);
    const investWalkRef=useRef(investWalk);investWalkRef.current=investWalk;
    const arriveCallback=useRef(onArriveInvest);arriveCallback.current=onArriveInvest;
    const investArrived=useRef(false);
    const investFireAt=useRef<number|null>(null);
    const guestsRef=useRef(guests);guestsRef.current=guests;
    const readOnlyRef=useRef(readOnly);readOnlyRef.current=readOnly;
    const guestAvatar=useRef({x:1,y:10.3});
    const guestPath=useRef<{x:number;y:number}[]>([]);
    current.current = game;
    useEffect(() => { avatar.current = { x: 5, y: 5, z: 300, v: 0 }; path.current = []; }, []);
    useEffect(()=>{const fresh=game.transactions.filter(t=>!seen.current.has(t.id)).reverse();for(const t of fresh)seen.current.add(t.id);queue.current.push(...fresh);},[game.transactions]);
    useEffect(()=>{
        if(!investWalk||game.isGameOver)return;
        investArrived.current=false;investFireAt.current=null;
        path.current=findPath(avatar.current,{x:0,y:9});activity.current='working';
    },[investWalk]);
    useEffect(()=>{
        if(game.ending.phase!=='playing')return;
        endingElapsed.current=0;endingNotified.current=false;queue.current=[];
        path.current=findPath(avatar.current,game.ending.kind==='food_shortage'?{x:2,y:2}:game.ending.kind==='power_cut'||game.ending.kind==='eviction'?{x:2,y:5}:{x:7,y:5});activity.current='worried';
    },[game.ending.phase,game.ending.kind]);
    useEffect(()=>{
        if(game.isGameOver||game.command.severity==='info')return;
        const target=game.command.behavior==='tired'?{x:8,y:2}:{x:8,y:2};
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
        const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0, last = 0;
        const draw = (time: number) => {
            const reduced = motionQuery.matches;
            const dt = Math.min((time - last) / 1000, .04);
            last = time;
            const g = current.current;
            camera.current.angle+=(requestedCamera.current.rotation*Math.PI/180-camera.current.angle)*(reduced?1:Math.min(1,dt*9));
            camera.current.zoom+=(requestedCamera.current.zoom-camera.current.zoom)*(reduced?1:Math.min(1,dt*10));
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
            if(launch.current){
                launch.current.t+=dt;
                if(launch.current.t>.6){const cb=onSwipeCharacterRef.current;launch.current=null;cb?.();}
            }
            if(pendingInspect.current&&!path.current.length&&!g.isGameOver){const item=pendingInspect.current;pendingInspect.current=null;inspectCallback.current(item);}
            if(!arrangeRef.current&&!pendingInspect.current&&!path.current.length&&time>sceneUntil.current&&!g.isGameOver&&!launch.current){
                const event=queue.current.shift();
                if(event){const scene=transactionScene(event);path.current=findPath(a,objectsRef.current.find(o=>o.id===event.category)||scene.target);activity.current=scene.activity;sceneUntil.current=time+7000;sceneCallback.current?.(scene.line);nextWander.current=time+10000;}
                else if(time>nextWander.current){const warning=g.command.severity!=='info';const target=warning?(g.command.behavior==='tired'?{x:8,y:2}:Math.floor(time/5000)%2?{x:8,y:2}:{x:5,y:4}):g.life.foodStock<25?{x:2,y:2}:g.life.energy<30?{x:8,y:2}:g.life.stress>=35?{x:8,y:2}:[{x:5,y:4},{x:6,y:9},{x:8,y:2}][Math.floor(time/10000)%3];path.current=findPath(a,target);activity.current=warning?(g.command.behavior==='tired'?'sleeping':'worried'):g.life.energy<30?'sleeping':'idle';nextWander.current=time+(warning?10000:18000);}
            }
            const target = path.current[0];
            if (target && a.z === 0) {
                const dx = target.x - a.x, dy = target.y - a.y, d = Math.hypot(dx, dy);
                // Reduced motion removes decorative effects, never walking time.
                if (d < .08) {
                    a.x = target.x;
                    a.y = target.y;
                    path.current.shift();
                }
                else {
                    const speed=g.life.energy<30?3.6:7.2;
                    a.x += dx / d * Math.min(d, dt * speed);
                    a.y += dy / d * Math.min(d, dt * speed);
                }
            }
            if(readOnlyRef.current){
                const gt=guestPath.current[0];
                if(gt){
                    const gdx=gt.x-guestAvatar.current.x,gdy=gt.y-guestAvatar.current.y,gd=Math.hypot(gdx,gdy);
                    if(gd<.08){guestAvatar.current.x=gt.x;guestAvatar.current.y=gt.y;guestPath.current.shift();}
                    else{guestAvatar.current.x+=gdx/gd*Math.min(gd,dt*7.2);guestAvatar.current.y+=gdy/gd*Math.min(gd,dt*7.2);}
                }
            }
            if(investWalkRef.current&&!investArrived.current&&!path.current.length){investArrived.current=true;investFireAt.current=time+500;}
            if(investFireAt.current!==null&&time>=investFireAt.current){investFireAt.current=null;arriveCallback.current?.();}
            if (a.z > 0) {
                a.v += dt * 850;
                a.z = Math.max(0, a.z - a.v * dt);
            }
            // Render the original smooth room at the display resolution.
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(ROOM_VIEW.width * dpr)) {
                canvas.width = Math.round(ROOM_VIEW.width * dpr);
                canvas.height = Math.round(ROOM_VIEW.height * dpr);
            }
            ctx.imageSmoothingEnabled=false;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, ROOM_VIEW.width, ROOM_VIEW.height);
            ctx.translate(ROOM_VIEW.width/2, ROOM_VIEW.height/2);
            ctx.scale(camera.current.zoom, camera.current.zoom);
            ctx.translate(-360, -285);
            const p = (x: number, y: number, z = 0) => { const t = projectRoom(x,y,angle); return [Math.round(t.screenX),Math.round(t.screenY-z)] as const; };
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
                faces.sort((a,b)=>a.depth-b.depth).forEach(f=>poly(f.points,f.fill,'#705346'));
                poly([p(x,y,h+base),p(x+w,y,h+base),p(x+w,y+d,h+base),p(x,y+d,h+base)],top,'#705346');
            };
            ctx.save();
            ctx.filter='blur(6px)';ctx.globalAlpha=.4;
            poly([p(0, 0, -25), p(12, 0, -25), p(12, 12, -25), p(0, 12, -25)], '#53644f');
            ctx.restore();
            box(0, 0, 12, 12, 12, '#dbc3a2', '#b48c75', '#96715e', -12);
            for (let x = 0; x < 12; x++)
                for (let y = 0; y < 12; y++)
                    poly([p(x, y), p(x + 1, y), p(x + 1, y + 1), p(x, y + 1)], (x + y) % 2 ? '#d9c3a4' : '#e6d1b3', '#b99b80');
            // Foreground walls become a faint upper strip, leaving furniture visible.
            const nearWalls=foregroundWalls(angle);
            const drawWall=(wall:'x'|'y',base=0)=>wall==='x'
                ?box(-.2,0,.2,12,108-base,'#ffcf9f','#eaa071','#dd956f',base)
                :box(0,-.2,12,.2,108-base,'#ffdab0',g.progression.owned.includes('house')?'#ffc798':'#ffb985','#dd956f',base);
            if(!nearWalls.includes('x'))drawWall('x');
            if(!nearWalls.includes('y'))drawWall('y');
            if(!nearWalls.includes('y')){
                poly([p(3,0,83),p(6,0,83),p(6,0,30),p(3,0,30)],'#f5f1df','#999e8f');
                poly([p(3.15,0,80),p(5.85,0,80),p(5.85,0,33),p(3.15,0,33)],'#b4d3d0');
                poly([p(4.43,0,80),p(4.57,0,80),p(4.57,0,33),p(4.43,0,33)],'#faf7e9');
                poly([p(3.15,0,57),p(5.85,0,57),p(5.85,0,54),p(3.15,0,54)],'#faf7e9');
                for(const wx of [3.3,4.7])for(const wz of [38,62])poly([p(wx,0,wz+14),p(wx+.16,0,wz+14),p(wx+.6,0,wz),p(wx+.44,0,wz)],'#dceceb');
                poly([p(8.2,0,86),p(9.9,0,86),p(9.9,0,48),p(8.2,0,48)],'#995e3c','#614534');
                poly([p(8.32,0,83),p(9.78,0,83),p(9.78,0,51),p(8.32,0,51)],'#d59663','#e8ae7b');
                poly([p(8.4,0,81),p(9.7,0,81),p(9.7,0,53),p(8.4,0,53)],'#b8cfbd');
                poly([p(8.4,0,64),p(8.8,0,71),p(9.2,0,63),p(9.5,0,69),p(9.7,0,62),p(9.7,0,53),p(8.4,0,53)],'#718266');
                for(const [wx,wz] of [[8.7,64],[9.1,68],[9.35,62]])poly([p(wx,0,wz),p(wx+.18,0,wz),p(wx+.18,0,55),p(wx,0,55)],'#ad8054');
            }
            if(!nearWalls.includes('x'))drawStockBoard(ctx,p(0.02,11,103),p(0.02,5,103),p(0.02,11,56),g.metrics.turn,g.life.powerOn);
            // Rug and furniture, in back-to-front order.
            poly([p(5.9, 5.3), p(10, 5.3), p(10, 11), p(5.9, 11)], '#607e66');
            poly([p(6.15, 5.55), p(9.75, 5.55), p(9.75, 10.75), p(6.15, 10.75)], g.progression.owned.includes('rug')?'#c58665':'#a3b183');
            const furniture=(id:FurnitureId,draw:()=>void)=>{
                const moved=objectsRef.current.find(o=>o.id===id)!;
                const original=OBJECTS.find(o=>o.id===id)!;
                const from=projectRoom(original.x,original.y,angle),to=projectRoom(moved.x,moved.y,angle);
                renderQueue.push({depth:depth(moved.x+moved.w/2,moved.y+moved.d/2),draw:()=>{ctx.save();ctx.translate(to.screenX-from.screenX,to.screenY-from.screenY);draw();ctx.restore();}});
            };
            furnitureMode=true;
            furniture('food',()=>{
            box(0, 1.4, 1.2, 1.2, 68, '#eceaf0', '#cecad5', '#aaa6b5');
            box(1.21, 1.9, .04, .12, 17, '#7d8879', '#7d8879', '#7d8879', 20);
            poly([p(1.21,1.4,44),p(1.21,2.6,44),p(1.21,2.6,42),p(1.21,1.4,42)],'#8b8179');
            poly([p(0,2.61,44),p(1.2,2.61,44),p(1.2,2.61,42),p(0,2.61,42)],'#8b8179');
            });
            furniture('utilities',()=>{
            box(0, 3, 1.2, 2.4, 34, '#ece9dc', '#c5b496', '#b19b7e');
            box(0.2, 3.3, .7, .8, 2, '#929f9a', '#929f9a', '#929f9a', 34);
            box(0.2, 4.45, .7, .7, 2, '#444e46', '#444e46', '#444e46', 34);
            // Oven door and hob details on the kitchen block.
            box(1.21,4.5,.03,.65,18,'#60544d','#453f40','#453f40',8);
            box(1.24,4.57,.04,.5,2,'#d2c7b1','#d2c7b1','#d2c7b1',26);
            for(const x of [.3,.65])for(const y of [4.55,4.85])box(x,y,.22,.2,1,'#77747d','#4b474e','#4b474e',36);
            });
            furniture('desk',()=>{
            for(const x of [1.08,2.72])for(const y of [7.08,8.12])box(x,y,.16,.16,34,'#bb946b','#9a7757','#86674d');
            box(1, 7, 2, 1.4, 4, '#bb946b', '#9a7757', '#86674d',34);

            box(1.15,7.7,.5,.55,23,'#d6d0c6','#b6b0a8','#96928d',38);
            box(1.8,7.18,.95,.52,26,'#c4bebd','#9c959b','#827e89',43);
            box(1.94,7.72,.68,.025,18,'#44414e','#36343f','#36343f',47);
            box(2.13,7.35,.23,.22,5,'#b7aaa0','#9c8d80','#827970',38);
            box(1.8,7.93,.75,.32,2,'#ded9d2','#a9a4a1','#969094',38);
            for(let row=0;row<3;row++)for(let col=0;col<7;col++)box(1.83+col*.095,7.95+row*.09,.06,.055,.4,'#aaa6a7','#aaa6a7','#aaa6a7',40);
            box(2.66,7.9,.18,.25,3,'#aba6a5','#918b8a','#797477',38);
            });
            furniture('housing',()=>{
            box(9, 1, 2.6, 3, 17, '#b7784d', '#955b3e', '#794832');
            box(9, 1, 2.6, .25, 46, '#b5784c', '#995d3c', '#774731');
            box(9.1, 1.3, 2.4, 2.6, 11, '#f7f0df', '#e2d9c5', '#c9c2ae', 17);
            box(9.1, 2.2, 2.4, 1.7, 5, '#ca7853', '#b86346', '#9b4e3c', 28);
            for(const px of [9.3,10.4])box(px,1.45,.85,.6,6,'#f5d7af','#dbb68f','#bd9878',28);
            box(9.12,1.04,2.36,.08,3,'#dd9b66','#dd9b66','#dd9b66',39);
            });
            furniture('leisure',()=>{
                // Solid base, then depth-sorted upholstery: the back/arms hide
                // cushions correctly from every side of the rotating camera.
                for(const x of [6.65,8.95])for(const y of [6.12,7.17])
                    box(x,y,.18,.18,5,'#98775a','#785a42','#684c39');
                box(6.5,6,2.8,1.4,17,'#9cbea7','#7fa48c','#698d77',5);
                const pieces=[
                    {x:6.5,y:6,w:2.8,d:.3,h:36,base:5,top:'#b0d0b8',left:'#89ae95',right:'#709580'},
                    {x:6.5,y:6.3,w:.32,d:1.1,h:27,base:5,top:'#b0cfb9',left:'#8db299',right:'#719680'},
                    {x:8.98,y:6.3,w:.32,d:1.1,h:27,base:5,top:'#b0cfb9',left:'#8db299',right:'#719680'},
                    {x:6.84,y:6.34,w:1.04,d:1.02,h:5,base:22,top:'#b7d5bb',left:'#90b49a',right:'#7b9f88'},
                    {x:7.92,y:6.34,w:1.02,d:1.02,h:5,base:22,top:'#b7d5bb',left:'#90b49a',right:'#7b9f88'},
                ];
                pieces.sort((a,b)=>depth(a.x+a.w/2,a.y+a.d/2)-depth(b.x+b.w/2,b.y+b.d/2));
                for(const s of pieces)box(s.x,s.y,s.w,s.d,s.h,s.top,s.left,s.right,s.base);
            });
            furniture('savings',()=>{
            for(const tx of [7.28,8.38])for(const ty of [8.18,8.92])box(tx,ty,.14,.14,18,'#bd8052','#945a38','#794830');
            box(7.2,8.1,1.4,1,4,'#c68a57','#a86a41','#875033',18);
            box(7.45, 8.3, .55, .4, 3, '#e7e1c6', '#c7c5ac', '#b7b59c', 22);
            });
            furniture('transit',()=>{
                box(6, 11, 1, .5, 25, '#b59776', '#987a5a', '#86694e');
                const [kx,ky]=p(6.45,11.25,29);
                ctx.save();ctx.strokeStyle='#72501d';ctx.lineWidth=7;ctx.lineCap='round';
                const key=()=>{ctx.beginPath();ctx.arc(kx-7,ky-3,6,0,Math.PI*2);ctx.moveTo(kx-1,ky-3);ctx.lineTo(kx+15,ky-3);ctx.moveTo(kx+10,ky-3);ctx.lineTo(kx+10,ky+3);ctx.moveTo(kx+15,ky-3);ctx.lineTo(kx+15,ky+2);ctx.stroke();};
                key();ctx.strokeStyle='#f3d56e';ctx.lineWidth=3;key();ctx.restore();
            });
            const plant=(x:number,y:number)=>{
                if(!drawing){renderQueue.push({depth:depth(x+.32,y+.32),draw:()=>plant(x,y)});return;}
                const [px,py]=p(x+.32,y+.32);
                poly([[px-10,py-15],[px+10,py-15],[px+7,py],[px-6,py]],'#b16e51','#714934');
                poly([[px-12,py-18],[px,py-22],[px+12,py-18],[px+11,py-13],[px,py-10],[px-11,py-14]],'#ce8a64','#714934');
                poly([[px-8,py-18],[px,py-20],[px+8,py-18],[px,py-15]],'#634d35');
                for(let i=0;i<7;i++){
                    const side=i%2?1:-1,tipX=px+side*(12+(i%3)*3),tipY=py-27-i*4;
                    poly([[px-2,py-18],[px+side*4,py-32],[tipX,tipY-7],[tipX+side*5,tipY-6],[tipX,tipY+2],[px+side*5,py-28],[px+2,py-18]],i%2?'#77945d':'#4f754d','#405b3c');
                }
            };
            plant(11,4.4);
            plant(.7,10.5);
            box(7.9,1,.9,.85,24,'#b18a63','#926c4e','#78563e');
            if (g.progression.owned.includes('plant'))
                plant(7, .8);
            if(g.progression.owned.includes('lamp')){box(8,3,.7,.7,20,'#b59c73','#947c59','#7e694b');box(8.3,3.3,.12,.12,30,'#c9b277','#ad995f','#ad995f',20);box(8.1,3.1,.5,.5,9,'#f4dba1','#d4ba83','#baa16c',48);}
            if(g.progression.owned.includes('bookshelf')){box(7,0,1.6,.55,62,'#b58d64','#94704f','#7b5c41');for(let i=0;i<6;i++)box(7.1+i*.2,.5,.13,.12,16,i%2?'#839479':'#c89470','#a28463','#a28463',14);}
            const pos = p(a.x + .5, a.y + .5);
            const flyT=launch.current?.t??0;
            const displayZ=launch.current?a.z+(reduced?260:flyT*640):a.z;
            const flyAlpha=launch.current?Math.max(0,1-flyT/.6):1;
            renderQueue.push({depth:depth(a.x+.5,a.y+.5)+(launch.current?9999:0),draw:()=>{
                ctx.save();
                if(g.ending.phase!=='none'&&activity.current==='dead'){const fall=reduced?1:Math.min(1,Math.max(0,endingElapsed.current-3)*1.8);ctx.translate(pos[0],pos[1]);ctx.rotate(-Math.PI/2*fall);ctx.translate(-pos[0],-pos[1]);}
                ctx.globalAlpha=flyAlpha;
                drawAvatar(ctx,pos[0],pos[1],displayZ,{...g.player,state:activity.current},reduced?0:time,!!target);ctx.restore();
            }});
            (guestsRef.current??[]).forEach((guest,i)=>{
                const selfControlled=readOnlyRef.current&&i===0;
                const gx=selfControlled?guestAvatar.current.x+.5:10.5-i*1.3,gy=selfControlled?guestAvatar.current.y+.5:10.3;
                const [gpx,gpy]=p(gx,gy);
                renderQueue.push({depth:depth(gx,gy),draw:()=>{
                    ctx.save();
                    ctx.beginPath();ctx.arc(gpx,gpy-11,11,0,Math.PI*2);ctx.fillStyle=guest.color||'#d4dfc7';ctx.fill();ctx.strokeStyle='#283622';ctx.lineWidth=1.5;ctx.stroke();
                    ctx.font='bold 10px sans-serif';ctx.fillStyle='#283622';ctx.textAlign='center';ctx.fillText(guest.label.slice(0,1).toUpperCase(),gpx,gpy-7);
                    ctx.font='9px sans-serif';ctx.fillStyle='#f5f1e7';ctx.fillText(guest.label,gpx,gpy+15);
                    ctx.textAlign='left';
                    ctx.restore();
                }});
            });
            for(let i=0;i<g.life.clutter;i++){const x=7+(i%3)*.7,y=9+Math.floor(i/3)*.5;box(x,y,.45,.4,9,'#cda777','#aa835c','#946c48');}
            drawing=true;renderQueue.sort((a,b)=>a.depth-b.depth).forEach(item=>item.draw());furnitureMode=false;
            if(arrangeRef.current){const o=objectsRef.current.find(o=>o.id===selectionRef.current)!;poly([p(o.x,o.y),p(o.x+o.w,o.y),p(o.x+o.w,o.y+o.d),p(o.x,o.y+o.d)],'rgba(231,220,160,.35)','#ffe7a2');}
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
                const bed=objectsRef.current.find(o=>o.id==='housing')!;const [x, y] = p(bed.x, bed.y, 56);
                ctx.fillStyle = '#fff0da';
                ctx.fillRect(x - 22, y - 12, 44, 22);
                ctx.fillStyle = '#ab493c';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText('RENT DUE', x - 19, y + 2);
            }
            if(g.life.stress>=15){const desk=objectsRef.current.find(o=>o.id==='desk')!;for(let i=0;i<3;i++)box(desk.x+i*.3,desk.y+.8,.4,.35,1,'#f7e5d4','#d9b7a1','#d9b7a1',39+i);}
            if (g.life.foodStock < 25||g.ending.kind==='food_shortage') {
                const fridge=objectsRef.current.find(o=>o.id==='food')!;const [x, y] = p(fridge.x+1, fridge.y, 74);
                ctx.fillStyle = '#77573c';
                ctx.font = '11px sans-serif';
                ctx.fillText('Empty', x - 12, y);
            }
            // Show only the wall above the tallest furniture (the 68px fridge).
            ctx.save();
            ctx.globalAlpha=.1;
            for(const wall of nearWalls)drawWall(wall,72);
            ctx.restore();
            if (!g.life.powerOn||(g.ending.kind==='power_cut'||g.ending.kind==='eviction')&&endingElapsed.current>1.5) {
                ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='rgba(12,20,38,.72)';ctx.fillRect(0,0,ROOM_VIEW.width,ROOM_VIEW.height);ctx.restore();
            }
            if(g.ending.phase==='playing'&&endingElapsed.current>3){ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=`rgba(25,31,29,${reduced?.55:Math.min(.55,(endingElapsed.current-3)*.18)})`;ctx.fillRect(0,0,ROOM_VIEW.width,ROOM_VIEW.height);ctx.restore();}
            frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, []);
    function pointer(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect(),z=camera.current.zoom;return {x:((e.clientX-r.left)/r.width*ROOM_VIEW.width-ROOM_VIEW.width/2)/z+360,y:((e.clientY-r.top)/r.height*ROOM_VIEW.height-ROOM_VIEW.height/2)/z+285};}
    function hitAt(x:number,y:number){return [...objectsRef.current].sort((a,b)=>projectRoom(b.x,b.y,camera.current.angle).screenY-projectRoom(a.x,a.y,camera.current.angle).screenY).find(o=>{const p=projectRoom(o.x+o.w/2,o.y+o.d/2,camera.current.angle);return Math.abs(x-p.screenX)<34&&y>p.screenY-65&&y<p.screenY+12;});}
    function avatarHit(x:number,y:number){const a=avatar.current;const p=projectRoom(a.x+.5,a.y+.5,camera.current.angle);return Math.abs(x-p.screenX)<34&&y>p.screenY-70&&y<p.screenY+15;}
    function inspect(e:React.PointerEvent<HTMLCanvasElement>){if(current.current.isGameOver)return;const {x,y}=pointer(e);const hit=hitAt(x,y);pendingInspect.current=hit?.id??null;const p=unprojectRoom(x,y,camera.current.angle);path.current=findPath(avatar.current,hit||{x:p.gridX,y:p.gridY});nextWander.current=performance.now()+10000;}
    function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){
        if(e.button!==0||!e.isPrimary)return;
        e.currentTarget.focus({preventScroll:true});
        const point=pointer(e);
        if(!arrangeRef.current&&!pauseRef.current&&!investWalkRef.current&&onSwipeCharacterRef.current&&avatarHit(point.x,point.y)){charDrag.current={id:e.pointerId,x:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);return;}
        drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,rotation:requestedCamera.current.rotation,moved:false};e.currentTarget.setPointerCapture(e.pointerId);
    }
    function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){
        const cd=charDrag.current;if(cd&&cd.id===e.pointerId){e.currentTarget.style.cursor='grabbing';return;}
        const d=drag.current;if(d&&d.id===e.pointerId){const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>6)d.moved=true;if(d.moved){setRotation(d.rotation+dx/e.currentTarget.getBoundingClientRect().width*360);hover.current=undefined;e.currentTarget.style.cursor='grabbing';}return;}const p=pointer(e);hover.current=hitAt(p.x,p.y);e.currentTarget.style.cursor=hover.current?'pointer':'grab';}
    function pointerUp(e:React.PointerEvent<HTMLCanvasElement>){
        const cd=charDrag.current;
        if(cd&&cd.id===e.pointerId){charDrag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);e.currentTarget.style.cursor='grab';if(Math.abs(e.clientX-cd.x)>56&&!launch.current&&!pauseRef.current&&!investWalkRef.current){path.current=[];pendingInspect.current=null;launch.current={t:0};}return;}
        const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);e.currentTarget.style.cursor='grab';
        if(!d.moved){
            if(readOnly){const point=pointer(e),tile=unprojectRoom(point.x,point.y,camera.current.angle);guestPath.current=findPath(guestAvatar.current,{x:tile.gridX,y:tile.gridY});}
            else if(arranging){const point=pointer(e),hit=hitAt(point.x,point.y);if(hit)setSelected(hit.id);else{const tile=unprojectRoom(point.x,point.y,camera.current.angle);moveSelected(tile.gridX,tile.gridY);}}
            else inspect(e);
        }
    }
    function moveSelected(x:number,y:number){
        const error=placementError(objectsRef.current,selected,x,y,avatar.current);
        if(error){setLayoutMessage(error);return;}
        path.current=[];pendingInspect.current=null;hover.current=undefined;
        onLayoutChange({...game.roomLayout,[selected]:{x,y}});
        setLayoutMessage('Layout saved. Choose another item or select Done.');
    }
    function nudge(dx:number,dy:number){const o=objectsRef.current.find(o=>o.id===selected)!;moveSelected(Math.round((o.x+dx)*10)/10,Math.round((o.y+dy)*10)/10);}
    function cancelDrag(){drag.current=null;charDrag.current=null;}
    return <div className="room-scene"><canvas ref={ref} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onPointerLeave={()=>{hover.current=undefined;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setRotation(r=>r+(e.key==='ArrowLeft'?-15:15));}if(e.key==='Home'){e.preventDefault();setRotation(0);}}} tabIndex={0} aria-label={readOnly?"Another player's apartment. Hold and drag to rotate. Arrow keys rotate; Home resets.":"Apartment with a simulated stock board on the wall. Hold and drag to rotate; click furniture to interact; drag your character to visit a friend's room. Arrow keys rotate; Home resets."} aria-keyshortcuts="ArrowLeft ArrowRight Home" role="img"/><div className="scene-controls" aria-label="Room camera">{!readOnly&&<button className="camera-action" aria-pressed={arranging} disabled={game.isGameOver} onClick={()=>{setArranging(v=>!v);path.current=[];pendingInspect.current=null;}}> {arranging?'Done':'Arrange furniture'}</button>}<output aria-label="Room angle">{Math.round(((rotation%360)+360)%360)}°</output><button className="camera-action" aria-label="Reset room view" onClick={()=>{setRotation(0);setZoom(1.1);}}>Reset</button><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.8,Math.round((z-.1)*10)/10))} disabled={zoom<=.8}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(ROOM_VIEW.maxZoom,Math.round((z+.1)*10)/10))} disabled={zoom>=ROOM_VIEW.maxZoom}>+</button></div>{arranging&&<div className="furniture-controls" aria-label="Arrange furniture"><label>Furniture <select value={selected} onChange={e=>setSelected(e.target.value as FurnitureId)}>{objectsRef.current.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label><div><button onClick={()=>nudge(-1,0)}>Move left</button><button onClick={()=>nudge(1,0)}>Move right</button><button onClick={()=>nudge(0,-1)}>Move back</button><button onClick={()=>nudge(0,1)}>Move forward</button><button onClick={()=>{onLayoutChange({});avatar.current={x:5,y:5,z:0,v:0};path.current=[];pendingInspect.current=null;hover.current=undefined;setLayoutMessage('Original layout restored.');}}>Reset layout</button></div><p role="status">{layoutMessage}</p></div>}</div>;
}
