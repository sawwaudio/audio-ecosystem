// v0.24 GEOGRAPHIC / HABITAT FILTER — drives both the visible list and the autonomous species pool.
const wildMeta=JSON.parse($('ae-wildlife-meta').textContent);
const REGION_LABEL={world:'All World',japan:'Japan',asia:'Asia',europe:'Europe',africa:'Africa',north_america:'North America',south_america:'South America',oceania:'Oceania',marine:'Ocean / Marine'};
const HABITAT_LABEL={temperate_forest:'Temperate Forest',tropical_rainforest:'Tropical Rainforest',mountain:'Mountain',grassland:'Grassland',wetland:'Wetland',river:'River',coast:'Coast',ocean:'Ocean',night_forest:'Night Forest'};
const geo={region:'off',basis:'native',habitat:'any',time:'any',role:'any'};
try{Object.assign(geo,JSON.parse(localStorage.getItem('ae-geo')||'{}'))}catch(e){}
let geoSavedFields=null;
function isLandscape(r){return r.kind==='landscape'}
function geoRegionMatch(r,m){
 if(geo.region==='world')return true;
 const recorded=m.recordedRegions||[];
 if(geo.region==='marine')return (m.nativeRegions||[]).includes('marine')||(m.habitats||[]).some(h=>h==='ocean'||h==='coast');
 if(isLandscape(r))return geo.basis!=='endemic'&&recorded.includes(geo.region); // environments have no distribution: recording place only
 if(geo.basis==='recorded')return recorded.includes(geo.region);
 if(geo.region==='japan')return geo.basis==='endemic'?m.japanEndemic===true:m.japanNative===true; // null (未確認) is never Japanese
 if(geo.basis==='endemic')return false;
 return (m.nativeRegions||[]).includes(geo.region);
}
function geoMatch(r){
 const m=wildMeta[r.id];if(!m)return false;
 if(!geoRegionMatch(r,m))return false;
 const hab=m.habitats||[],act=m.activity||[];
 if(geo.habitat==='night_forest'){if(!hab.some(h=>h==='temperate_forest'||h==='tropical_rainforest')||!act.includes('night'))return false}
 else if(geo.habitat!=='any'&&!hab.includes(geo.habitat))return false;
 if(geo.time!=='any'&&!act.includes(geo.time))return false;
 if(geo.role!=='any'&&!(m.soundRoles||[]).includes(geo.role))return false;
 return true;
}
function geoTags(r){const m=wildMeta[r.id]||{},t=[];if((m.recordedRegions||[]).includes('japan'))t.push('日本録音');if(m.japanNative===true)t.push('日本生息');if(m.japanEndemic===true)t.push('日本固有');if(m.japanNative===null&&!isLandscape(r))t.push('日本分布未確認');t.push(m.recordedCountry?('録音:'+m.recordedCountry):'録音地不明');return t}
function geoDescribe(){if(geo.region==='off')return '';const b=geo.region==='japan'?{native:'Japan Native Species',recorded:'Recorded in Japan',endemic:'Japan Endemic'}[geo.basis]:REGION_LABEL[geo.region]+(geo.region==='world'||geo.region==='marine'?'':geo.basis==='recorded'?'（録音地）':'（自然分布）');return [b,geo.habitat!=='any'&&HABITAT_LABEL[geo.habitat],geo.time!=='any'&&{day:'Day',dusk:'Dusk',night:'Night'}[geo.time],geo.role!=='any'&&geo.role].filter(Boolean).join(' × ')}
function renderGeoControls(){for(const k of ['region','basis','habitat','time','role'])$('geo'+k[0].toUpperCase()+k.slice(1)).value=geo[k];const off=geo.region==='off',flat=geo.region==='world'||geo.region==='marine';$('geoBasis').disabled=off||flat;$('geoBasis').options[2].disabled=geo.region!=='japan';
 const lab=geo.region==='japan'?['Japan Native Species — 日本に自然分布','Recorded in Japan — 日本で録音','Japan Endemic — 日本固有種']:['自然分布する種','その地域で録音','固有種のみ（Japanのみ）'];[...$('geoBasis').options].forEach((o,i)=>o.textContent=lab[i]);for(const id of ['geoHabitat','geoTime','geoRole'])$(id).disabled=off}
function geoMatches(){return recordings.filter(geoMatch)}
function applyGeo(){
 if(geo.basis==='endemic'&&geo.region!=='japan')geo.basis='native';
 try{localStorage.setItem('ae-geo',JSON.stringify(geo))}catch(e){}
 renderGeoControls();
 if(geo.region==='off'){$('geoResult').textContent='地域フィルターは未使用です。シーン設定と個別選択で演奏します。';$('geoList').replaceChildren();if(geoSavedFields){Object.assign(fieldConfig.levels,geoSavedFields);geoSavedFields=null;syncFields();updateFieldLevels()}return}
 const hits=geoMatches(),ids=hits.map(r=>r.id),beds=hits.filter(r=>r.fieldBed).map(r=>r.id);
 scenes.geo=ids.filter(id=>speciesSettings[id]&&!recordings.find(r=>r.id===id).fieldBed);
 setScene('geo');
 if(!geoSavedFields)geoSavedFields={...fieldConfig.levels};
 fieldConfig.legacy=false;for(const id of Object.keys(fieldConfig.levels)){if(!beds.includes(id)){fieldConfig.levels[id]=0;stopFieldVoices(id)}else if(fieldConfig.levels[id]===0)fieldConfig.levels[id]=geoSavedFields[id]||fieldDefaults[id]||25}
 syncFields();updateFieldLevels();
 $('fieldStatus').textContent=beds.length?'実録音の環境層：'+beds.map(id=>recordings.find(r=>r.id===id).jp).join(' ＋ '):'環境層：条件に合う実録音がないため停止中';
 const d=geoDescribe();
 $('geoResult').textContent=hits.length?d+'：実録音 '+hits.length+'件（生物・声 '+scenes.geo.length+' / 環境層 '+beds.length+'）':d+'：該当する実録音がありません。他地域の録音や合成音で代用せず、生物音・環境層は鳴らしません。';
 $('realStatus').textContent=hits.length?'地域フィルター：'+d:'地域フィルター：該当なし（無音の生物層）';
 $('geoList').replaceChildren(...hits.map(r=>{const el=document.createElement('div');el.className='geoItem';el.append(Object.assign(document.createElement('strong'),{textContent:r.jp}),' ',Object.assign(document.createElement('span'),{className:'micro',textContent:geoTags(r).join(' · ')}));return el}));
}
for(const k of ['region','basis','habitat','time','role'])$('geo'+k[0].toUpperCase()+k.slice(1)).onchange=e=>{geo[k]=e.target.value;applyGeo()};
renderGeoControls();if(geo.region!=='off')applyGeo();
window.__geoDebug={geo,apply:(o)=>{Object.assign(geo,o);applyGeo();return {ids:geoMatches().map(r=>r.id),pool:scenes.geo||[],fields:{...fieldConfig.levels}}},match:geoMatch,meta:wildMeta};
