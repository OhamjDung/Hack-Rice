// Deterministic crops/masks of the supplied artwork. No generated artwork.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'public/sprites';
await mkdir(output, { recursive: true });
const sheet = await sharp('public/image_3.jpg').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const room = await sharp('public/image_4.jpg').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const keySource = await sharp('public/image_5.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function inside(x, y, points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a,b] = points[i], [c,d] = points[j];
    if ((b > y) !== (d > y) && x < (c-a)*(y-b)/(d-b)+a) hit = !hit;
  }
  return hit;
}
const manifest = {};
async function sprite(name, rect, options = {}) {
  const { data, info } = options.source || sheet;
  const [left, top, width, height] = rect;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const sx=left+x, sy=top+y, i=(sy*info.width+sx)*4, o=(y*width+x)*4;
    const r=data[i],g=data[i+1],b=data[i+2];
    // Remove the sage sheet background, including the green-gray cast shadows.
    const background = g > 165 && g-r >= 3 && g-r < 25 && g-b >= 0 && g-b < 26 && Math.abs(r-b)<19;
    const outside = options.outline && !inside(sx+.5,sy+.5,options.outline) || options.parts && !options.parts.some(p=>inside(sx+.5,sy+.5,p));
    const hole = options.holes?.some(p=>inside(sx+.5,sy+.5,p));
    data.copy(pixels,o,i,i+4);
    pixels[o+3] = outside || hole || (!options.keepBackground && background) ? 0 : 255;
  }
  // Discard tiny JPEG specks while preserving disconnected sprite parts.
  const seen = new Uint8Array(width*height);
  for(let p=0;p<seen.length;p++) {
    if(seen[p]||!pixels[p*4+3])continue;
    const component=[p];seen[p]=1;
    for(let q=0;q<component.length;q++) {
      const at=component[q],x=at%width,y=Math.floor(at/width);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy,n=ny*width+nx;
        if(nx<0||nx>=width||ny<0||ny>=height||seen[n]||!pixels[n*4+3])continue;
        seen[n]=1;component.push(n);
      }
    }
    if(component.length<5)for(const p of component)pixels[p*4+3]=0;
  }
  const native = `${output}/${name}.png`;
  await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(native);
  await sharp(pixels,{raw:{width,height,channels:4}}).resize(width*4,height*4,{kernel:'nearest'}).png().toFile(`${output}/${name}@4x.png`);
  manifest[name]={file:`/sprites/${name}.png`,highResolution:`/sprites/${name}@4x.png`,width,height,source:options.source===keySource?'image_5.png':'image_3.jpg',crop:rect};
}
await sprite('sofa',[60,24,139,120]);
await sprite('coffee-table',[287,50,102,79]);
await sprite('rug',[466,24,237,122],{keepBackground:true,outline:[[468,86],[586,26],[699,85],[584,142]]});
await sprite('bed',[54,175,155,134]);
await sprite('nightstand',[292,216,69,79]);
await sprite('plant-right',[454,198,69,104]);
await sprite('plant-left',[58,516,67,94]);
await sprite('plant-left-variant',[322,517,63,93]);
await sprite('painting',[619,202,69,96]);
await sprite('window-frame',[767,194,87,116],{holes:[[[777,208],[807,223],[807,248],[777,234]],[[816,228],[841,241],[841,265],[816,252]],[[777,244],[807,259],[807,282],[777,268]],[[816,264],[841,277],[841,295],[816,282]]]});
await sprite('window-glass',[894,191,85,117]);
await sprite('glass-pane',[902,202,68,94],{keepBackground:true,outline:[[903,204],[968,238],[968,291],[903,257]]});
await sprite('kitchen',[53,350,175,134]);
await sprite('refrigerator',[302,348,86,140]);
await sprite('desk',[461,367,123,112],{keepBackground:true,parts:[[[464,409],[543,370],[580,389],[580,402],[504,441],[464,421]],[[465,419],[476,425],[476,454],[467,459],[465,455]],[[495,436],[506,439],[506,474],[498,478],[495,474]],[[568,405],[579,401],[579,444],[570,449],[568,445]]]});
await sprite('computer-desk',[654,353,112,128],{keepBackground:true,parts:[[[656,409],[664,405],[664,382],[683,372],[683,363],[699,357],[721,354],[728,357],[728,391],[763,405],[764,418],[707,448],[656,423]],[[657,420],[668,426],[668,461],[661,466],[657,462]],[[696,440],[708,444],[708,476],[701,481],[696,477]],[[753,422],[764,417],[763,447],[756,453],[753,449]],[[674,424],[680,427],[680,444],[687,450],[687,458],[679,464],[669,460],[666,454],[671,448],[673,446]]]});
await sprite('monitor',[680,353,51,67],{outline:[[696,356],[722,354],[728,360],[727,393],[710,405],[711,414],[694,419],[685,413],[694,406],[682,395],[680,375],[688,369],[688,361]]});
await sprite('pc-tower',[662,378,43,51],{outline:[[665,380],[684,386],[702,401],[702,419],[686,428],[664,415]]});
await sprite('keyboard-mouse',[178,536,84,60]);
await sprite('keyboard',[178,555,65,40],{outline:[[178,581],[219,556],[242,569],[204,592],[190,592]]});
await sprite('mouse',[233,545,29,24]);
await sprite('character-front-left',[480,514,46,97]);
await sprite('character-front-right',[575,514,44,97]);
await sprite('character-walk-1',[666,514,48,97]);
await sprite('character-walk-2',[753,514,50,97]);
await sprite('character-walk-3',[842,514,49,97]);
await sprite('character-seated',[934,514,49,97]);
await sprite('keys-pedestal',[168,283,34,56],{source:keySource,keepBackground:true,outline:[[173,290],[179,285],[185,287],[189,290],[200,290],[200,297],[196,299],[196,323],[182,335],[171,329],[171,300],[168,298],[168,292]]});

// Reconstruct an empty room from image_4's own wall strips and a clean floor tile.
// Original perimeter and the soft exterior cast shadow are retained.
const width=1024,height=651,base=Buffer.alloc(width*height*4),src=room.data;
const sample=(x,y)=> (Math.max(0,Math.min(650,Math.round(y)))*width+Math.max(0,Math.min(1023,Math.round(x))))*4;
const leftWall=[[154,247],[529,61],[529,208],[154,394]];
const rightWall=[[529,61],[904,247],[904,394],[529,208]];
const floor=[[158,391],[529,207],[900,391],[529,577]];
const edge=[[156,390],[529,575],[901,390],[901,407],[529,590],[156,406]];
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const o=(y*width+x)*4;
  let i=-1;
  if(inside(x,y,leftWall)){
    const ceiling=247-(x-154)*186/375;
    i=sample(x,y-ceiling<8?y:ceiling+12+(Math.floor(y-ceiling)%19));
  }else if(inside(x,y,rightWall)){
    const ceiling=61+(x-529)*186/375;
    i=sample(x,y-ceiling<8?y:ceiling+19+(Math.floor(y-ceiling)%4));
  }else if(inside(x,y,floor)){
    const gx=((x-529)/30.92+(y-207)/15.42)/2;
    const gy=((y-207)/15.42-(x-529)/30.92)/2;
    const u=gx-Math.floor(gx),v=gy-Math.floor(gy);
    // A complete, unobscured diamond in the center of the supplied floor.
    i=sample(529+(u-v)*30.92,268+(u+v)*15.42);
  }else if(inside(x,y,edge))i=o;
  if(i>=0){src.copy(base,o,i,i+4);base[o+3]=255;}
  else if(y>390&&x>100&&x<920){
    const [r,g,b]=src.subarray(o,o+3);
    const darkness=Math.max(0,Math.min(.45,(200-g)/120));
    if(g>r&&g>b&&darkness>0){base[o]=47;base[o+1]=58;base[o+2]=42;base[o+3]=Math.round(darkness*255);}
  }
}
await sharp(base,{raw:{width,height,channels:4}}).png().toFile(`${output}/room-base.png`);
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
await writeFile(`${output}/README.md`,'# CashBound source sprites\n\nExtracted from the user-supplied image_3.jpg with deterministic cropping and transparency masks. Native PNGs preserve the source resolution; @4x PNGs use nearest-neighbor enlargement and add no invented detail. The room base reuses image_4.jpg wall strips, floor texture, perimeter and ambient shadow. keys-pedestal uses image_5.png.\n\nRun `node scripts/extract-room-sprites.mjs` to reproduce. Crop coordinates and provenance are recorded in manifest.json. Single-view artwork supports a fixed isometric camera with pan and zoom. Hidden surfaces and occluded pixels are not synthesized.\n');
console.log(`Extracted ${Object.keys(manifest).length} sprites, native + 4x, and room-base.png`);
