import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDemo} from './audio-qa.mjs';
function fixture(value){
 const data=Buffer.alloc(48000*7*6+44);
 data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);
 data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(2,22);
 data.writeUInt32LE(48000,24);data.writeUInt32LE(288000,28);data.writeUInt16LE(6,32);
 data.writeUInt16LE(24,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);
 for(let i=44;i<data.length;i+=3)data.writeIntLE(value,i,3);
 return data;
}
test('reject silent, clipped and truncated renders',()=>{
 assert.throws(()=>inspectDemo(fixture(0)),/silent/i);
 assert.throws(()=>inspectDemo(fixture(-8388608)),/headroom/);
 assert.throws(()=>inspectDemo(fixture(10000).subarray(0,100)),/Truncated/);
});
test('measure stereo demo duration and peak',()=>{
 const qa=inspectDemo(fixture(4194304));
 assert.equal(qa.durationSeconds,7);assert.ok(Math.abs(qa.peakDbFS+6.0206)<.001);
});
