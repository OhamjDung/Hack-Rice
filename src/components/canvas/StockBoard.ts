type Point = readonly [number, number];

/** Decorative, simulated market display projected onto the room's wall. */
export function drawStockBoard(ctx:CanvasRenderingContext2D,topLeft:Point,topRight:Point,bottomLeft:Point,day:number,powered:boolean){
    ctx.save();
    ctx.transform((topRight[0]-topLeft[0])/280,(topRight[1]-topLeft[1])/280,(bottomLeft[0]-topLeft[0])/150,(bottomLeft[1]-topLeft[1])/150,topLeft[0],topLeft[1]);
    ctx.fillStyle='#182724';ctx.strokeStyle='#586b61';ctx.lineWidth=5;
    ctx.beginPath();ctx.roundRect(-5,-5,290,160,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#091713';ctx.fillRect(0,0,280,150);
    if(powered){
        ctx.font='bold 16px monospace';ctx.fillStyle='#dbefdd';ctx.fillText('MARKET',12,23);
        ctx.font='11px monospace';ctx.fillStyle='#8fa79a';ctx.fillText('SIM / DAY '+day,171,22);
        ctx.strokeStyle='#29473b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,33);ctx.lineTo(268,33);ctx.stroke();
        ['RICE','MAPL','NEST'].forEach((ticker,i)=>{
            const change=Math.sin(day*.7+i*2)*2.8,color=change>=0?'#79edaa':'#f39283',y=57+i*36;
            ctx.font='bold 16px monospace';ctx.fillStyle='#d9e7df';ctx.fillText(ticker,12,y);
            ctx.fillStyle=color;ctx.font='14px monospace';ctx.fillText((change>=0?'+':'')+change.toFixed(2)+'%',77,y);
            ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
            for(let n=0;n<16;n++){
                const x=166+n*6,py=y-6-Math.sin(n*.8+i+day*.4)*5-change*n*.3;
                if(n===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);
            }
            ctx.stroke();
        });
    }
    ctx.restore();
}
