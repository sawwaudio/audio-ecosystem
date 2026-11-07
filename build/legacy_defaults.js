// v0.58 で初期設定（ディジュリドゥ・パイプオルガンのペダル・鳥4種、環境音なし）に変えたため、
// 以前の初期設定に頼っていたテストが、自分で必要な音を入れるための補助。値は v0.57 までの初期値。
// 使い方：await require('./legacy_defaults')(pg,{layers:true,field:true,species:['cicada','tsukutsukuboshi']})（再生の前に呼ぶ）
const LAYERS={sub:31,organDrone:46,bowed:26,organPedal:20,gong:12,natureLow:16,organ:38,bowl:53,piano:36,bells:22,harp:28,heart:22,kick:15,stones:13,frameDrum:12,slitDrum:10};
const FIELD={'forest-leaves':26,'takayama-river':38};
module.exports=async(pg,o={})=>pg.evaluate(([o,L,F])=>{
 const set=(id,v)=>{const i=document.getElementById(id);if(!i)return;i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))};
 if(o.layers)for(const [k,v] of Object.entries(L))set('param-'+k,v);
 if(o.field)for(const [k,v] of Object.entries(F))set('field-'+k,v);
 if(o.species){const s=__bioDebug.settings;for(const id of Object.keys(s))s[id].enabled=o.species.includes(id)}
},[o,LAYERS,FIELD]);
