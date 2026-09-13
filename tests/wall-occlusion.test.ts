import test from 'node:test';
import assert from 'node:assert/strict';
import { foregroundWalls, pointBehindWall, projectRoom } from '../src/components/canvas/IsometricEngine.ts';

test('opaque exterior walls switch with the viewing direction for a full turn',()=>{
  assert.deepEqual(foregroundWalls(0),[]);
  assert.deepEqual(foregroundWalls(Math.PI/2),['y']);
  assert.deepEqual(new Set(foregroundWalls(Math.PI)),new Set(['x','y']));
  assert.deepEqual(foregroundWalls(3*Math.PI/2),['x']);
  assert.deepEqual(foregroundWalls(2*Math.PI),[]);
});

test('exterior faces block pointer hits while interior faces remain interactive',()=>{
  for(const angle of [Math.PI/2,Math.PI,3*Math.PI/2])for(const wall of foregroundWalls(angle)){
    const center=projectRoom(wall==='x'?-.2:6,wall==='x'?6:-.2,angle);
    assert.equal(pointBehindWall(center.screenX,center.screenY-54,angle),true);
    assert.equal(pointBehindWall(center.screenX,center.screenY-140,angle),false);
  }
  const sink=projectRoom(.6,3.7,0);
  assert.equal(pointBehindWall(sink.screenX,sink.screenY-36,0),false);
  assert.equal(pointBehindWall(-1000,-1000,Math.PI),false);
});
