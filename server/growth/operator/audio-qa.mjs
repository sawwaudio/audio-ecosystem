// Inspect the 48 kHz stereo PCM24 intermediate written by the demo renderer.
export function inspectDemo(wav){
 if(wav.length<12||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Invalid WAV');
 let format,data;
 for(let offset=12;offset+8<=wav.length;){
  const size=wav.readUInt32LE(offset+4),start=offset+8,end=start+size;
  if(end>wav.length)throw Error('Truncated WAV chunk');
  const kind=wav.toString('ascii',offset,offset+4);
  if(kind==='fmt ')format=wav.subarray(start,end);
  if(kind==='data')data=wav.subarray(start,end);
  offset=end+(size%2);
 }
 if(!format||format.length<16||!data?.length||data.length%6)throw Error('Missing stereo PCM samples');
 const tag=format.readUInt16LE(0);
 const pcm=tag===1||(tag===65534&&format.length>=40&&format.subarray(24,40).toString('hex')==='0100000000001000800000aa00389b71');
 if(!pcm||format.readUInt16LE(2)!==2||format.readUInt32LE(4)!==48000||format.readUInt16LE(14)!==24)throw Error('Expected stereo PCM24 at 48 kHz');
 const duration=data.length/(6*48000);
 if(duration<6||duration>9)throw Error('Unexpected duration for seven-second preset');
 let peak=0,energy=0;
 for(let i=0;i<data.length;i+=3){
  const sample=data.readIntLE(i,3)/8388608;
  peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;
 }
 const rms=Math.sqrt(energy/(data.length/3));
 if(rms<0.0001)throw Error('Silent or near-silent demo');
 if(peak>=0.9999)throw Error('Demo lacks peak headroom');
 return {durationSeconds:duration,peakDbFS:20*Math.log10(peak),rmsDbFS:20*Math.log10(rms)};
}
