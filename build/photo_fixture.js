// テスト用：生き物の写真（Wikimedia Commons から表示時に読み込む）を、ネットワークに出ずに手元の試験画像で返す。
// 写真の読み込み・キャンバスへの描画（CORS 付き）の経路を、オフラインの試験環境でも同じように通すため。
// v0.47：Google Fonts（Dela Gothic One・M PLUS Rounded 1c）も外へ出さない。既定は空の CSS（端末の書体で表示）。
//   環境変数 AE_FONT_DIR に @fontsource/dela-gothic-one と @fontsource/m-plus-rounded-1c を展開したフォルダを指定すると、本物の書体で表示する
//   （画面の確認・リールの書き出し用。npm pack で取得し、package/ の下に files/ と *.css がある形）。
const fs=require('fs'),path=require('path');const body=fs.readFileSync(path.join(__dirname,'fixtures','photo_fixture.jpg'));
function fontCss(dir){const pk=[['dela-gothic-one',['400']],['m-plus-rounded-1c',['500','700','800','900']]];let css='';
 for(const [name,ws] of pk){const base=fs.readdirSync(dir).find(d=>d.includes(name));if(!base)continue;const pkg=path.join(dir,base,'package');
  for(const w of ws){const f=path.join(pkg,w+'.css');if(fs.existsSync(f))css+=fs.readFileSync(f,'utf8').replace(/url\(\.\/files\//g,'url(https://fonts.gstatic.com/fontsource/'+base+'/')}}return css}
module.exports=async pg=>{await pg.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\//,r=>r.fulfill({status:200,contentType:'image/jpeg',headers:{'access-control-allow-origin':'*','cache-control':'max-age=3600'},body}));
 const dir=process.env.AE_FONT_DIR,css=dir?fontCss(dir):'';
 await pg.route(/^https:\/\/fonts\.googleapis\.com\//,r=>r.fulfill({status:200,contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:css}));
 await pg.route(/^https:\/\/fonts\.gstatic\.com\//,r=>{const m=/fontsource\/([^/]+)\/(.+)$/.exec(r.request().url());const f=dir&&m?path.join(dir,m[1],'package','files',m[2]):null;
  if(f&&fs.existsSync(f))return r.fulfill({status:200,contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(f)});return r.fulfill({status:200,contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:Buffer.alloc(0)})});return pg};
