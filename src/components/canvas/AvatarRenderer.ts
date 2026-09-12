import type { PlayerCharacter } from '@/engine/Types';
export function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, player: PlayerCharacter, time: number, walking: boolean) {
    ctx.fillStyle = 'rgba(49,48,39,.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    y -= z;
    const resting=!walking&&(player.state==='sleeping'||player.state==='dead');
    if(resting)y+=15;
    if(!walking&&player.state==='partying')y-=Math.abs(Math.sin(time/220))*4;
    const step = walking ? Math.sin(time / 320) * 3 : 0;
    ctx.fillStyle = player.pantsColor;
    ctx.fillRect(x - 8, y - 17, 7, 17 + step);
    ctx.fillRect(x + 1, y - 17, 7, 17 - step);
    ctx.fillStyle = '#eee7d9';
    ctx.fillRect(x - 9, y - 3 + step, 9, 5);
    ctx.fillRect(x + 1, y - 3 - step, 9, 5);
    ctx.fillStyle = player.shirtColor;
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 38, 22, 24, 5);
    ctx.fill();
    ctx.fillStyle = player.skinTone;
    ctx.fillRect(x - 14, y - 34, 5, 18);
    ctx.fillRect(x + 9, y - 34, 5, 18);
    if(!walking&&player.state==='eating'){ctx.fillStyle='#d9a17a';ctx.fillRect(x+7,y-39,9,5);ctx.fillStyle='#dcaf61';ctx.fillRect(x+5,y-43,7,7);}
    if(!walking&&player.state==='working'){ctx.fillStyle=player.skinTone;ctx.fillRect(x+9,y-31+Math.sin(time/140)*2,10,4);}
    if(!walking&&player.state==='worried'){ctx.fillStyle=player.skinTone;ctx.fillRect(x+9,y-46,5,18);ctx.fillRect(x+5,y-49,9,5);ctx.fillStyle='#d48a42';ctx.font='bold 15px sans-serif';ctx.fillText('!',x+18,y-55);}
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 57, 18, 21, 6);
    ctx.fill();
    ctx.fillStyle = player.hairColor;
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 60, 20, 10, 5);
    ctx.fill();
    ctx.fillRect(x - 10, y - 54, 5, 10);
    ctx.fillStyle = '#39352f';
    ctx.fillRect(x + 2, y - 47, 2, 3);
}
