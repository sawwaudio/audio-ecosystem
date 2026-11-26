# ペダルの定義（build/pedals_def.json）とモジュール（build/src_pedals.js）を index.html に組み込み、英語の辞書（EXACT）を足す。
import json,re,sys
P='index.html';h=open(P,encoding='utf-8').read()
D=json.load(open('build/pedals_def.json',encoding='utf-8'))
src=open('build/src_pedals.js',encoding='utf-8').read().replace('/*PEDALS_DEF*/null',json.dumps(D,ensure_ascii=False,separators=(',',':'))).rstrip()+'\n'
a=h.index('/*<ae-pedals>*/\n')+len('/*<ae-pedals>*/\n');b=h.index('/*</ae-pedals>*/');h=h[:a]+src+h[b:]
U=D['ui'];J=lambda x:x[0]
sec=('<details id="pedalSection" data-tier="pro"><summary><span>ペダル / PEDALS</span><span class="micro">30種類から、使うものだけ</span></summary>'
 '<div class="pdTop"><label class="micro" for="pdTarget">'+J(U['target'])+'</label><select id="pdTarget"></select>'
 '<button type="button" id="pdAdd" aria-expanded="false" aria-controls="pdCatalog">'+J(U['add'])+'</button><button type="button" id="pdAllOff">'+J(U['alloff'])+'</button><span class="micro pdCount" id="pdCount" data-i18n-skip></span></div>'
 '<div id="pdCatalog" class="pdCatalog" hidden></div>'
 '<p class="micro pdStatus" id="pdStatus" role="status"></p><div id="pdBoard" class="pdBoard"></div>'
 '<details class="help"><summary>ⓘ 詳しく</summary><p class="micro">'+J(U['intro'])+'</p><p class="micro">'+J(U['help1'])+'</p><p class="micro">'+J(U['help2'])+'</p><p class="micro">'+J(U['help3'])+'</p></details></details>')
i=h.index('<details id="pedalSection"');j=h.index('<details id="tracksSection"');h=h[:i]+sec+h[j:]
css=('.pdTop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.pdTop select{font-size:16px;min-height:44px}.pdTop button{min-height:44px}.pdCount{margin-left:auto;font-variant-numeric:tabular-nums}.pdStatus{min-height:1.4em}'
 '.pdBoard{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:8px 0}'
 '.pdCard{--pd:#ccc;color:#ecebe4;background:linear-gradient(180deg,color-mix(in srgb,var(--pd) 14%,#171b1c),#0f1213 85%);border:1px solid color-mix(in srgb,var(--pd) 35%,#0000);border-radius:16px;padding:12px 12px 10px;display:flex;flex-direction:column;gap:10px;box-shadow:inset 0 3px 0 color-mix(in srgb,var(--pd) 70%,#0000),0 6px 18px #0004}'
 '.pdCard.on{box-shadow:inset 0 3px 0 var(--pd),0 0 0 1px color-mix(in srgb,var(--pd) 60%,#0000),0 8px 22px #0006}'
 '.pdHead{display:flex;align-items:center;justify-content:space-between;gap:6px}.pdName{font-size:15px;letter-spacing:.06em;color:var(--pd)}.pdTools{display:flex;gap:4px}'
 '.pdTools button{min-width:44px;min-height:44px;padding:0;border-radius:10px;background:#ffffff0d;color:#ecebe4;border:1px solid #ffffff1f}.pdTools button:disabled{opacity:.3}.pdDesc{color:#b9b8ae;margin-top:-6px}'
 '.pdKnobs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 6px;justify-items:center}.pdKnob{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;text-align:center}'
 '.pdDial{--p:.5;position:relative;width:54px;height:54px;border-radius:50%;cursor:ns-resize;touch-action:none;background:radial-gradient(circle at 50% 32%,#454b4d,#1c2021 68%);box-shadow:0 2px 6px #000a,inset 0 1px 0 #ffffff26}'
 '.pdDial::before{content:"";position:absolute;inset:-5px;border-radius:50%;background:conic-gradient(from 225deg,var(--pd) calc(var(--p)*270deg),#ffffff1f 0 270deg,#0000 0);-webkit-mask:radial-gradient(circle,#0000 60%,#000 61%);mask:radial-gradient(circle,#0000 60%,#000 61%)}'
 '.pdCap{position:absolute;inset:0;border-radius:50%;transform:rotate(calc(-135deg + var(--p)*270deg))}.pdCap::after{content:"";position:absolute;left:50%;top:6px;width:3px;height:15px;margin-left:-1.5px;border-radius:2px;background:#f2f0e6}'
 '.pdDial:focus-visible{outline:2px solid var(--pd);outline-offset:6px}.pdKLabel{font-size:11px;line-height:1.25;color:#cfcdc2;max-width:74px}.pdKVal{font-size:11px;color:var(--pd);font-variant-numeric:tabular-nums}'
 '.pdSteps{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.pdSteps .micro{width:100%;color:#b9b8ae}.pdSteps button{min-width:44px;min-height:36px;padding:2px 8px;border-radius:999px;background:#ffffff0d;color:#ecebe4;border:1px solid #ffffff26;font-size:12px}.pdSteps button[aria-pressed=true]{background:var(--pd);color:#111;border-color:var(--pd)}'
 '.pdActions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pdAct{min-height:44px;border-radius:12px;background:#ffffff10;color:#ecebe4;border:1px solid #ffffff2a}.pdAct.lit{background:var(--pd);color:#111}.pdLoopState{color:var(--pd)}'
 '.pdSwitch{min-height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,#3a3f40,#1d2122);color:#ecebe4;border:1px solid #ffffff22;box-shadow:inset 0 1px 0 #ffffff1f,0 2px 4px #0008}'
 '.pdLed{width:12px;height:12px;border-radius:50%;background:#3b2a2a;box-shadow:inset 0 0 0 1px #0008}.pdCard.on .pdLed{background:var(--pd);box-shadow:0 0 10px var(--pd),0 0 2px var(--pd)}'
 '.pdEmpty{grid-column:1/-1;border:1px dashed currentColor;border-radius:14px;padding:12px;opacity:.9}.pdSuggest{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pdChip{min-height:40px;border-radius:999px;border:1px solid var(--pd);background:color-mix(in srgb,var(--pd) 14%,#0000)}'
 '.pdCatalog{border:1px solid currentColor;border-radius:14px;padding:10px 12px;margin:6px 0 12px;max-height:min(70vh,640px);overflow:auto}.pdCatH{margin:10px 0 6px;font-size:12px;letter-spacing:.08em;opacity:.8}'
 '.pdCatList{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}.pdCatItem{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;min-height:56px;padding:8px 10px;border-radius:10px;border:1px solid #ffffff1f;border-left:4px solid var(--pd)}.pdCatItem:disabled{opacity:.45}.pdCatItem strong{font-size:13px}.pdFull{color:#e6a86a}')
k=h.index('.pdTop{');l=h.index('.shareOut{');h=h[:k]+css+h[l:]
# 試聴をペダルに通す
a2="  previewMessage('読み込み中：'+r.jp+' · '+label);\n  return playPart();"
NEW="  previewMessage('読み込み中：'+r.jp+' · '+label);\n  // v0.87 ペダルがオンなら、試聴も Web Audio を通してペダルに掛ける（play() はクリックの中ですぐ呼ぶ）\n  if(window.__pedals)__pedals.routePreview(nativePreview);\n  return playPart();"
if NEW not in h:
    assert h.count(a2)==1,h.count(a2);h=h.replace(a2,NEW)
# 辞書
E={}
for c in D['cats']:E[c[1]]=c[2]
for p in D['pedals'].values():
    E[p['name'][0]]=p['name'][1];E[p['desc'][0]]=p['desc'][1]
    for k_ in p['knobs']:E[k_['l'][0]]=k_['l'][1]
    if 'steps' in p:
        E[p['steps']['l'][0]]=p['steps']['l'][1]
        for lb in p['steps'].get('labels',[]):E[lb[0]]=lb[1]
    for a_ in p.get('actions',[]):E[a_['l'][0]]=a_['l'][1]
for v in U.values():E[v[0]]=v[1]
E['30種類から、使うものだけ']='30 effects — show only the ones you use'
E['歪み']='Drive';E['明るさ']='Brightness';E['元の音']='Dry';E['音量']='Volume';E['ビット数']='Bit depth'
def q(s):return s.replace('\\','\\\\').replace("'","\\'")
tag='<script id="ae-i18n">';A=h.index(tag);seg=h[A:]
import re as _re
add=[]
for k in E:
    key="'"+q(k)+"':'"
    if key in seg:
        m=_re.search(_re.escape(key)+r"((?:[^'\\]|\\.)*)'",seg)
        if m and m.group(1)!=q(E[k]):print('override',k,m.group(1),'->',E[k]);seg=seg.replace(key+m.group(1)+"'",key+q(E[k])+"'",1)
    else:add.append(k)
h=h[:A]+seg
i=h.index('const EXACT={',A)+len('const EXACT={')
if add:h=h[:i]+'\n// v0.87 ペダル 第2版\n'+','.join("'"+q(k)+"':'"+q(E[k])+"'" for k in add)+',\n'+h[i:]
A=h.index(tag)+len(tag);B=h.index('</script>',A);open('build/src_i18n.js','w',encoding='utf-8').write(h[A:B])
open(P,'w',encoding='utf-8').write(h);print('added',len(add))

# ── v0.88：AudioWorklet の文字列・6ch ルーパー（サンプラーの欄）・master._limTrim ──
h=open(P,encoding='utf-8').read()
WK=open('build/src_pedal_worklet.js',encoding='utf-8').read()
h=h.replace("const WK_SRC=/*PEDAL_WORKLET*/'';","const WK_SRC="+json.dumps(WK,ensure_ascii=False).replace('</','<\\/')+";")
if 'master._limTrim=limTrim' not in h:
    a3="master._limNode=lim;";assert h.count(a3)==1;h=h.replace(a3,"master._limNode=lim;master._limTrim=limTrim;")
LP=open('build/src_looper.js',encoding='utf-8').read().rstrip()+'\n'
if '/*<ae-looper>*/' in h:
    a=h.index('/*<ae-looper>*/\n')+len('/*<ae-looper>*/\n');b=h.index('/*</ae-looper>*/');h=h[:a]+LP+h[b:]
else:
    h=h.replace("/*</ae-share>*/\n","/*</ae-share>*/\n/*<ae-looper>*/\n"+LP+"/*</ae-looper>*/\n",1)
h=h.replace('<span>サンプラー / SAMPLER</span><span class="micro">8パッド · 切り取り · ループ</span>','<span>サンプラー / ルーパー</span><span class="micro">8パッド · 6chルーパー · 保存</span>')
h=h.replace('<span class="micro">30種類から、使うものだけ</span>','<span class="micro">34種類から、使うものだけ</span>')
LUI=('<div id="looperBlock" class="looperBlock"><h3 class="lpTitle">ルーパー（6ch）</h3>'
 '<p class="micro">いま聞こえている音（ペダルを通った音）を録って、6つのチャンネルでループさせます。●で録り始め、もう一度●でループになります。再生中に●を押すと重ねて録ります。</p>'
 '<div id="lpChannels" class="lpChannels"></div><p class="micro" id="lpMsg" role="status"></p>'
 '<h4 class="lpTitle2">保存したループ（この端末）</h4><div id="lpLib" class="lpLib"></div>'
 '<details class="help"><summary>ⓘ 詳しく</summary><p class="micro">ルーパーは自分の音を録らないので、重ねても二重になりません。録音の書き出しとリールには、ルーパーの音も入ります。↶ で最後の重ね録りを取り消せます。速さ（½・1・2）と ⇄（逆再生）は、鳴らし方だけを変えます（保存する音はそのまま）。1チャンネルは最大60秒です。</p>'
 '<p class="micro">「保存」はこの端末のブラウザの中に保存します（ほかの端末とは共有されません）。「WAV」はファイルとして書き出します。</p></details></div>')
if 'id="looperBlock"' not in h:
    i=h.index('<details id="samplerSection"');j=h.index('<details id="pedalSection"');seg=h[i:j];k=seg.rindex('</details>')
    h=h[:i]+seg[:k]+LUI+seg[k:]+h[j:]
CSS2=('.looperBlock{margin-top:18px;border-top:1px solid #ffffff1a;padding-top:12px}.lpTitle{margin:0 0 4px;font-size:15px}.lpTitle2{margin:14px 0 6px;font-size:13px;opacity:.85}'
 '.lpChannels{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:8px 0}'
 '.lpCh{border:1px solid #ffffff22;border-radius:14px;padding:10px;background:linear-gradient(180deg,#1b2021,#111415);color:#ecebe4;display:flex;flex-direction:column;gap:8px}'
 '.lpCh[data-state=rec],.lpCh[data-state=dub]{border-color:#e8705a;box-shadow:0 0 0 1px #e8705a inset}.lpCh[data-state=play]{border-color:#8fd39b}'
 '.lpHead{display:flex;gap:8px;align-items:baseline}.lpNum{letter-spacing:.08em}.lpState{color:#e6c27a}.lpLen{margin-left:auto;font-variant-numeric:tabular-nums}'
 '.lpBar{height:4px;border-radius:2px;background:#ffffff14;overflow:hidden}.lpFill{display:block;height:100%;width:0;background:#8fd39b}'
 '.lpRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.lpRow button{min-width:44px;min-height:44px;border-radius:10px;background:#ffffff10;color:#ecebe4;border:1px solid #ffffff26}.lpRow button:disabled{opacity:.35}'
 '.lpRec{color:#ff8a70!important;font-size:18px}.lpRec[aria-pressed=true]{background:#e8705a!important;color:#111!important}.lpSpd[aria-pressed=true],.lpRev[aria-pressed=true]{background:#e6c27a!important;color:#111!important}.lpVol{flex:1;min-width:90px;accent-color:#8fd39b;min-height:28px}'
 '.lpLibRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid #ffffff12}.lpLibName{flex:1;min-width:150px;font-variant-numeric:tabular-nums}.lpLibRow select{font-size:16px;min-height:40px}.lpLibRow button{min-height:40px}')
if '.looperBlock{' not in h:h=h.replace('.shareOut{',CSS2+'.shareOut{',1)
E2={'サンプラー / ルーパー':'SAMPLER / LOOPER','8パッド · 6chルーパー · 保存':'8 pads · 6-ch looper · save','34種類から、使うものだけ':'34 effects — show only the ones you use','ルーパー（6ch）':'Looper (6 ch)',
 'いま聞こえている音（ペダルを通った音）を録って、6つのチャンネルでループさせます。●で録り始め、もう一度●でループになります。再生中に●を押すと重ねて録ります。':'Records what you hear (after the pedals) and loops it on six channels. Press ● to start, ● again to loop it. Press ● while it plays to overdub.',
 '保存したループ（この端末）':'Saved loops (this device)','ルーパーは自分の音を録らないので、重ねても二重になりません。録音の書き出しとリールには、ルーパーの音も入ります。↶ で最後の重ね録りを取り消せます。速さ（½・1・2）と ⇄（逆再生）は、鳴らし方だけを変えます（保存する音はそのまま）。1チャンネルは最大60秒です。':'The looper never records itself, so overdubs don’t double up. Recordings and reels include the loops. ↶ undoes the last overdub. Speed (½, 1, 2) and ⇄ (reverse) only change playback; the saved audio stays the same. Up to 60 seconds per channel.',
 '「保存」はこの端末のブラウザの中に保存します（ほかの端末とは共有されません）。「WAV」はファイルとして書き出します。':'“Save” stores the loop in this browser on this device (not shared with other devices). “WAV” exports it as a file.',
 '空':'Empty','録音中':'Recording','再生中':'Playing','止めた':'Stopped','重ね録り中':'Overdubbing','録る・重ねる':'Record / overdub','再生・止める':'Play / stop','ひとつ戻す':'Undo','消す':'Clear','逆再生':'Reverse','音量':'Volume','保存':'Save','WAV で書き出す':'Export WAV',
 '読み込むチャンネル':'Channel to load into','読み込む':'Load','削除':'Delete','本当に削除':'Really delete','保存したループはまだありません。':'No saved loops yet.',
 '先に ▶ 自律演奏を始めてください（いま鳴っている音を録ります）。':'Start ▶ autoplay first (the looper records what is playing).','ほかのチャンネルが録音中です。':'Another channel is recording.','短すぎるので録り直してください。':'Too short — please record again.',
 'この端末に保存しました。':'Saved on this device.','保存できませんでした（端末の空き容量を確かめてください）。':'Could not save (check the free space on this device).','先に ▶ 自律演奏を始めてください。':'Start ▶ autoplay first.','読み込めませんでした。':'Could not load.'}
tag='<script id="ae-i18n">';A=h.index(tag);seg=h[A:];add2=[k for k in E2 if ("'"+q(k)+"':") not in seg]
i=h.index('const EXACT={',A)+len('const EXACT={')
if add2:h=h[:i]+'\n// v0.88 ルーパー\n'+','.join("'"+q(k)+"':'"+q(E2[k])+"'" for k in add2)+',\n'+h[i:]
A=h.index(tag)+len(tag);B=h.index('</script>',A);open('build/src_i18n.js','w',encoding='utf-8').write(h[A:B])
PA="const t=ctx.currentTime;master._output.gain.cancelScheduledValues(t);master._output.gain.setTargetAtTime(.00001,t,.055);\ntry{await new Promise(resolve=>setTimeout(resolve,260));await ctx.suspend();"
PB="const t=ctx.currentTime;const keepLoops=!!(window.__looper&&__looper.active());// v0.88 ルーパーが鳴っている間は、音の出口と ctx を止めない\nif(!keepLoops){master._output.gain.cancelScheduledValues(t);master._output.gain.setTargetAtTime(.00001,t,.055)}\ntry{await new Promise(resolve=>setTimeout(resolve,260));if(!keepLoops)await ctx.suspend();"
if PB not in h:
    assert h.count(PA)==1,h.count(PA);h=h.replace(PA,PB)
open(P,'w',encoding='utf-8').write(h);print('looper i18n added',len(add2))

# ── v0.89：アカウントのライブラリ（☁）。BILL・PRO_KEY と同じ場所（録音の買い取りの直後）に入れる ──
h=open(P,encoding='utf-8').read()
CL=open('build/src_cloud.js',encoding='utf-8').read().rstrip()+'\n'
if '/*<ae-cloud>*/' in h:
    a=h.index('/*<ae-cloud>*/\n')+len('/*<ae-cloud>*/\n');b=h.index('/*</ae-cloud>*/');h=h[:a]+CL+h[b:]
else:
    mk='// v0.81 管理者モードの画面：ほかのプランの見え方・いまの状態・運用のリンク';assert h.count(mk)==1
    h=h.replace(mk,'/*<ae-cloud>*/\n'+CL+'/*</ae-cloud>*/\n'+mk)
CP=('<div id="cloudPresets" class="cloudBox" hidden><h4 class="cloudH">☁ アカウントのプリセット</h4><p class="micro">アカウントに保存すると、ほかの端末からも読み込めます。</p>'
 '<div class="cloudSave"><input id="cloudPresetName" type="text" maxlength="80" placeholder="名前（空なら日時）" aria-label="プリセットの名前"><button type="button" id="cloudPresetSave">☁ アカウントに保存</button></div>'
 '<div id="cloudPresetList" class="cloudList"></div><p class="micro" id="cloudPresetMsg" role="status"></p></div>')
if 'id="cloudPresets"' not in h:
    i=h.index('id="presetSection"');k=h.index('<div id="shareOut"',i);h=h[:k]+CP+h[k:]
CLP=('<div id="cloudLoops" class="cloudBox" hidden><h4 class="cloudH">☁ アカウントのループ（ほかの端末でも使える）</h4><p class="micro">各チャンネルの ☁ で保存します（PRO・20本・合計80MBまで）。読み込むと、空いているチャンネルに入ります。</p>'
 '<div id="cloudLoopList" class="cloudList"></div><p class="micro" id="cloudLoopMsg" role="status"></p></div>')
if 'id="cloudLoops"' not in h:
    k=h.index('<details class="help"',h.index('id="lpLib"'));h=h[:k]+CLP+h[k:]
CSS3='.cloudBox{border:1px solid #9fd8c855;border-radius:12px;padding:10px 12px;margin:10px 0;background:#9fd8c80d}.cloudH{margin:0 0 4px;font-size:13px}.cloudSave{display:flex;gap:6px;flex-wrap:wrap}.cloudSave input{flex:1;min-width:160px;font-size:16px;min-height:44px}.cloudSave button,.cloudRow button{min-height:44px}.cloudRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid #ffffff12}.cloudName{flex:1;min-width:140px;font-variant-numeric:tabular-nums}'
if '.cloudBox{' not in h:h=h.replace('.shareOut{',CSS3+'.shareOut{',1)
E3={'☁ アカウントのプリセット':'☁ Presets in your account','アカウントに保存すると、ほかの端末からも読み込めます。':'Saved to your account, they can be loaded on your other devices.','名前（空なら日時）':'Name (blank = date and time)','プリセットの名前':'Preset name','☁ アカウントに保存':'☁ Save to account',
 '☁ アカウントのループ（ほかの端末でも使える）':'☁ Loops in your account (use them on any device)','各チャンネルの ☁ で保存します（PRO・20本・合計80MBまで）。読み込むと、空いているチャンネルに入ります。':'Save with each channel’s ☁ (PRO; up to 20 loops, 80 MB in total). Loading puts the loop in a free channel.',
 'アカウントに保存':'Save to account','まだありません。':'None yet.','ご契約中の方だけが保存できます。':'Only active subscribers can save.','ループの保存は PRO だけです。':'Saving loops is PRO only.','保存できる数の上限です。古いものを消してください。':'You have reached the limit. Delete an older one.',
 'ループの保存容量（80MB）を超えます。古いものを消してください。':'This would exceed the 80 MB loop storage. Delete an older one.','大きすぎて保存できません。':'Too large to save.','保存しています…':'Saving…','アカウントに保存しました。ほかの端末でも読み込めます。':'Saved to your account. You can load it on your other devices.',
 '保存できませんでした。':'Could not save.','保存できませんでした。電波を確かめてください。':'Could not save. Check your connection.','読み込んでいます…':'Loading…','読み込みました。':'Loaded.','アカウントに保存しています…':'Saving to your account…'}
tag='<script id="ae-i18n">';A=h.index(tag);seg=h[A:];add3=[k for k in E3 if ("'"+q(k)+"':") not in seg]
i=h.index('const EXACT={',A)+len('const EXACT={')
if add3:h=h[:i]+'\n// v0.89 アカウントのライブラリ\n'+','.join("'"+q(k)+"':'"+q(E3[k])+"'" for k in add3)+',\n'+h[i:]
A=h.index(tag)+len(tag);B=h.index('</script>',A);open('build/src_i18n.js','w',encoding='utf-8').write(h[A:B])
open(P,'w',encoding='utf-8').write(h);print('cloud i18n added',len(add3))
