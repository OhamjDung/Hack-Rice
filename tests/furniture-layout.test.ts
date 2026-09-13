import test from 'node:test';
import assert from 'node:assert/strict';
import {roomObjects,placementError,findPath,blocked} from '../src/components/canvas/IsometricEngine.ts';
import {createGame} from '../src/engine/RulesEngine.ts';
import {stateSchema} from '../src/engine/Types.ts';
test('furniture layout survives save validation and old saves remain supported',()=>{
 const game=createGame();game.roomLayout={leisure:{x:6.5,y:5}};
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(game)));
 assert.deepEqual(restored.roomLayout,game.roomLayout);
 delete game.roomLayout;assert.equal(stateSchema.safeParse(game).success,true);
});
test('placement rejects overlaps, room boundaries, and the character',()=>{
 const objects=roomObjects(),avatar={x:5,y:5};
 assert.equal(placementError(objects,'leisure',6.5,5,avatar),null);
 assert.ok(placementError(objects,'leisure',9,1,avatar));
 assert.ok(placementError(objects,'leisure',11,6,avatar));
 assert.ok(placementError(objects,'leisure',4,5,avatar));
});
test('walking uses moved furniture footprints instead of original locations',()=>{
 const objects=roomObjects({leisure:{x:3,y:4}});
 assert.equal(blocked(4,4,objects),true);
 assert.equal(blocked(7,6,objects),false);
 const route=findPath({x:2,y:4},{x:7,y:4},objects);
 assert.ok(route.length);assert.deepEqual(route.at(-1),{x:7,y:4});
 assert.ok(route.every(p=>!blocked(p.x,p.y,objects)));
});
