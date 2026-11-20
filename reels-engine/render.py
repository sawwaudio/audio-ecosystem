"""Render a rights-checked SAE edition. Dependencies: numpy, Pillow, ffmpeg."""
import argparse, hashlib, json, os, subprocess, tempfile, wave
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FPS, RATE = 30, 48000
LIBRARY = {
 'nature': ('NATURE SOUNDS', ['higurashi'], 16),
 'morphology': ('SOUND MORPHOLOGY', ['rocky-beach'], 18),
 'pop': ('POP REACTIVE', ['cicada'], 16),
 'twenty': ('20 SECONDS IN NATURE', ['tide-rocks'], 20),
 'hidden': ('HIDDEN PATTERNS',['japanese-bush-warbler'],18),
 'create': ('CREATE WITH SAE',['rain-field','rocky-beach'],18),
 'make': ('MAKE MUSIC WITH NATURE', ['rain-field','rocky-beach'], 18),
}
def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

@lru_cache()
def font(size,serif=False):
 paths=['/System/Library/Fonts/Supplemental/'+('Georgia Italic.ttf' if serif else 'Arial Bold.ttf'),'/usr/share/fonts/truetype/dejavu/'+('DejaVuSerif-Italic.ttf' if serif else 'DejaVuSans-Bold.ttf')]
 return ImageFont.truetype(next(p for p in paths if Path(p).exists()),size)

OPTIONS = {
 'nature': ['higurashi','niiniizemi','tsukutsukuboshi','brown-eared-bulbul'],
 'morphology': ['rocky-beach','tide-rocks'],
 'hidden': ['japanese-bush-warbler','hototogisu','brown-eared-bulbul'],
 'pop': ['cicada','niiniizemi','tsukutsukuboshi'],
 'twenty': ['tide-rocks','rocky-beach'],
}
NAMES = {'higurashi':('Higurashi','cicada.'),'niiniizemi':('Niinii','cicada.'),'tsukutsukuboshi':('Tsukutsuku','boshi cicada.'),'brown-eared-bulbul':('Brown-eared','bulbul.')}
def render(kind,root,out,stills,seed,recent=()):
 series,ids,seconds=LIBRARY[kind]
 if recent and kind in OPTIONS:
  choices=OPTIONS[kind]
  ids=[max(choices,key=lambda item:recent.index(item) if item in recent else len(recent))]
 ff=os.environ.get('FFMPEG','ffmpeg')
 rows={r['id']:r for r in json.loads((root/'data/recording_licenses.json').read_text())}
 out.mkdir(parents=True,exist_ok=True)
 rng=np.random.default_rng(seed)
 audio=np.zeros(RATE*seconds)
 rights=[]
 for idx,id in enumerate(ids):
  r=rows[id]
  file=next((root/'audio/original').glob(id+'.*'))
  if digest(file)!=r['sha256'] or not (r['license'] in ('CC BY 2.1 JP','CC BY 3.0','CC BY 4.0','CC0','CC0 1.0','Public domain')) or not all(r.get(k) for k in ('author','licenseURL','url')): raise ValueError('Rights or identity unresolved: '+id)
  rights.append({k:r[k] for k in ('id','title','author','license','licenseURL','url','sha256','jp','latin')})
  raw=subprocess.check_output([ff,'-v','error','-i',str(file),'-f','f32le','-ac','1','-ar',str(RATE),'-'])
  signal=np.frombuffer(raw,dtype='<f4')
  # Overlap tail and head at each source wrap.
  n=min(RATE//4,len(signal)//4)
  blend=np.linspace(0,1,n)
  loop=np.r_[signal[-n:]*(1-blend)+signal[:n]*blend,signal[n:-n]]
  start=4*RATE if idx else 0
  offset=int(rng.integers(len(loop)))
  layer=np.take(loop,np.arange(len(audio)-start)+offset,mode='wrap')
  layer*=np.minimum(1,np.arange(len(layer))/(RATE*.18))
  audio[start:]+=layer/(np.max(np.abs(layer))+1e-9)*(.63 if not idx else .42)
 if kind in ('make','create'):
  recorded=json.loads((stills/'performance.json').read_text())
  if recorded['sa'] or any(r['imported'] for r in recorded['entries']) or set(ids)!={r['id'] for r in recorded['entries']}:raise ValueError('Unexpected performance rights')
  raw=subprocess.check_output([ff,'-v','error','-i',str(stills/'performance.media'),'-vn','-ac','1','-ar',str(RATE),'-f','f32le','-'])
  captured=np.frombuffer(raw,dtype='<f4')
  if len(captured)<len(audio)-RATE//3:raise ValueError('Short live recording')
  audio=np.resize(captured,len(audio)).copy()
 audio[-RATE//4:]*=np.linspace(1,0,RATE//4)
 audio*=.87/max(1e-8,abs(audio).max())
 chunks=audio.reshape(-1,RATE//FPS)
 rms=np.sqrt((chunks**2).mean(1)); peak=np.max(abs(chunks),1)
 spec=abs(np.fft.rfft(chunks*np.hanning(chunks.shape[1]),n=2048))
 freq=np.fft.rfftfreq(2048,1/RATE)
 centroid=(spec@freq)/(spec.sum(1)+1e-8)
 flux=np.maximum(0,np.diff(spec,axis=0,prepend=spec[:1])).mean(1)
 bands=np.stack([np.sqrt((spec[:,(freq>=a)&(freq<b)]**2).mean(1)) for a,b in [(40,250),(250,2000),(2000,14000)]],axis=1)
 norm=lambda x: np.clip(x/(np.percentile(x,95,axis=0)+1e-8),0,1.5)
 levels=norm(rms); energies=norm(bands); trans=norm(peak/(rms+.001)); on=flux>np.percentile(flux,85)
 if rms.mean()<.01 or not np.isfinite(audio).all(): raise ValueError('audio QA failed')
 frames=len(rms); theta=np.linspace(0,2*np.pi,240); phase=rng.uniform(0,6.28)
 shots=[Image.open(stills/f'step{i}.png').convert('RGB').resize((430,712)) for i in range(2)] if kind in ('make','create') else []
 with tempfile.TemporaryDirectory() as td:
  wav=Path(td)/'mix.wav'
  with wave.open(str(wav),'wb') as w:
   w.setparams((1,2,RATE,0,'NONE',''));w.writeframes((audio*32767).astype('<i2').tobytes())
  movie=out/(kind+'.mp4')
  enc=subprocess.Popen([ff,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r','30','-i','-','-i',str(wav),'-vf','scale=1080:1920:flags=lanczos','-c:v','libx264','-threads','3','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(movie)],stdin=subprocess.PIPE)
  preview=None
  if kind in ('make','create'):
   preview=subprocess.Popen([ff,'-loglevel','error','-stream_loop','-1','-i',str(stills/'performance.media'),'-vf','fps=30,scale=210:374','-frames:v',str(frames),'-an','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE)
  for i,chunk in enumerate(chunks):
   miniature=Image.frombytes('RGB',(210,374),preview.stdout.read(210*374*3)) if preview else None
   t=i/FPS; a=levels[i];lo,mid,hi=energies[i]
   bg,fg,ink={'nature':('#ece9da','#1e3024','#9d4b24'),'morphology':('#081e29','#c5f9df','#ffa78b'),'make':('#efe5d3','#282533','#6c4293')}.get(kind,('#151227','#fff1ca','#ffa24e'))
   img=Image.new('RGB',(540,960),bg);d=ImageDraw.Draw(img)
   def label(x,y,txt,size=14,color=fg,serif=False):d.text((x,y),txt,font=font(size,serif),fill=color)
   label(37,99,series,19);d.line((37,136,498,136),fill=fg,width=1)
   if kind=='nature':
    reveal=11<t<15.6
    label(37,165,NAMES[ids[0]][0] if reveal else 'Who is',57,fg,True);label(37,231,NAMES[ids[0]][1] if reveal else 'calling?',57,fg,True)
    # Stacked slices of the actual signal history.
    for j in range(55):
     v=chunks[(i-54+j)%frames].reshape(100,16);v=np.sqrt((v*v).mean(1))
     x=np.linspace(42,490,100);y=424+j*4-85*v
     d.line(list(zip(x,y)),fill=ink if j>48 else fg,width=2)
    label(38,735,'FIELD NOTE   /   01');label(38,772,'Listen again.' if reveal else 'Bird, frog or insect?',28)
   elif kind=='morphology':
    label(36,163,'Tidal forms',52,fg,True)
    for k in range(40):
     r=46+3.25*k+np.sin(3*theta+phase+k*.066+t*.48)*(6+12*mid)+np.cos(5*theta-k*.08+t*.27)*(4+10*hi)
     x=264+r*np.cos(theta);y=478+r*(.72+.2*lo)*np.sin(theta)+14*np.sin(theta*2+t*.4)+.19*k
     color=(int(66+3*k),int(140+2*k),int(157+1.6*k))
     d.line(list(zip(x,y)),fill=color,width=2)
    label(38,752,'ROCKY SHORE   /   SPECTRAL CENTROID');label(38,781,f'{centroid[i]/1000:.2f} kHz',28,ink)
   elif kind=='pop':
    label(36,166,'Pulse relay',56)
    for row in range(7):
     for col in range(5):
      x,y=69+100*col,355+54*row
      size=4+int(20*energies[(i-3*row-col)%frames,col%3])
      color=['#ffc857','#ed6686','#66c7c0'][(row+col)%3]
      if (row+col)%2:d.ellipse((x-size,y-size,x+size,y+size),fill=color)
      else:d.polygon([(x,y-size),(x+size,y),(x,y+size),(x-size,y)],fill=color)
   elif kind=='twenty':
    label(38,212,'Beside the',49,fg,True);label(40,267,'water',60,fg,True)
    for j in range(32):
     x=np.linspace(0,540,120);y=540+j*6+np.sin(x/94+j*.13+phase)*31+np.sin(x/36+t*.3)*lo*8
     d.line(list(zip(x,y)),fill=(55+j*2,106+j*2,91+j),width=3)
    label(40,762,f'{max(1,20-int(t)):02d} seconds by the shore',20)
   elif kind=='hidden':
    label(38,175,'Visible song',50,fg,True)
    indices=(np.arange(180)+i-179)%frames
    bins=np.geomspace(2,800,175).astype(int)
    heat=np.log1p(spec[indices][:,bins].T[::-1]);heat=np.clip(heat/3,0,1)
    data=np.stack([35+210*heat,21+155*heat**2,60+70*heat],axis=2).astype('uint8')
    img.paste(Image.fromarray(data).resize((456,370)),(38,327))
    label(38,735,'Time →     /     Frequency ↑',20)
   elif kind=='create':
    label(38,168,'From field',52);label(38,224,'to Reel.',52)
    shot=shots[int(t>=4)]
    img.paste(shot.crop((0,150,430,510)),(53,350))
    label(38,752,'FREE   /   mix two recordings',22)
   else:
    step=int(t>=4);label(34,153,'Rain + shore' if step else 'Start with rain',41)
    # Show the actual app capture with a gradual camera move.
    shot=shots[step];top=int(85+70*min(1,(t-(4 if step else 0))/6))
    img.paste(shot.crop((0,top,430,top+410)),(53,271));d.rectangle((52,270,483,682),outline=fg,width=2)
    label(53,706,'02   ADD THE WAVE' if step else '01   SELECT RAIN',20,ink)
    for j,energy in enumerate([lo,mid,hi]):d.rounded_rectangle((53,759+j*12,55+int(350*min(1,energy)),765+j*12),3,fill=ink)
   if miniature and 9.5<t<seconds-1:
    d.rectangle((33,266,503,734),fill=bg)
    img.paste(miniature,(162,302))
    label(38,706,'REELS CREATOR   /   LIVE OUTPUT',19,ink)
   label(37,841,'saww audio ecosystem',16);d.line((37,827,37+455*(i+1)/frames,827),fill=ink,width=2)
   if i==FPS:img.resize((1080,1920),Image.Resampling.LANCZOS).save(out/(kind+'-cover.jpg'),quality=93)
   enc.stdin.write(img.tobytes())
  if preview and preview.wait(): raise RuntimeError("preview decode failed")
  enc.stdin.close()
  if enc.wait(): raise RuntimeError('encode failed')
 subprocess.run([ff,'-v','error','-xerror','-i',str(movie),'-f','null','-'],check=True)
 hook={'nature':'Bird, frog or insect? 最後に正解。','morphology':'Listen to the shoreline change shape. 波音の周波数から描いた等高線。','make':'Start with rain, then add the shore. SAEの無料版で雨と波を重ねてみよう。','pop':'A cicada drives every pulse. セミの実録音で図形を動かす。','hidden':'Listen with your eyes. 鳥の声をスペクトログラムで読む。','twenty':'Twenty seconds by the water. 岸辺の水音に耳を澄ませて。','create':'Two recordings, one free mix. 無料版で雨と波を重ねよう。'}[kind]
 credits='\n'.join(f"{r['title']} — {r['author']} / {r['license']} {r['licenseURL']} / {r['url']}" for r in rights)
 caption=hook+'\nTry it free via our profile. プロフィールから無料で制作できます。\n\nRecordings edited, looped and mixed:\n'+credits
 (out/(kind+'.txt')).write_text(caption)
 report=dict(series=series,seed=seed,preset=kind,duration=seconds,frames=frames,rights=rights,sha256=digest(movie),rms=float(rms.mean()),peak=float(abs(audio).max()),onsets=int(on.sum()),transient_max=float(trans.max()),spectral_flux=float(flux.mean()),qa='decoded',hook=hook,cta="Try it free via our profile",species=[r["latin"] for r in rights],palette=bg,arrangement="layered" if len(ids)>1 else "loop",caption=caption)
 (out/(kind+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(series,frames,'frames',digest(movie)[:12],flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('series',choices=LIBRARY);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--out',type=Path,required=True);p.add_argument('--stills',type=Path,default=Path('stills'));p.add_argument('--seed',type=int,required=True)
 a=p.parse_args();render(a.series,a.root,a.out,a.stills,a.seed)
