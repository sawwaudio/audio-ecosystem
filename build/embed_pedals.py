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
h=h[:i]+'\n// v0.87 ペダル 第2版\n'+','.join("'"+q(k)+"':'"+q(E[k])+"'" for k in add)+',\n'+h[i:]
A=h.index(tag)+len(tag);B=h.index('</script>',A);open('build/src_i18n.js','w',encoding='utf-8').write(h[A:B])
open(P,'w',encoding='utf-8').write(h);print('added',len(add))
