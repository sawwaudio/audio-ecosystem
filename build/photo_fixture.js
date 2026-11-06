// テスト用：生き物の写真（Wikimedia Commons から表示時に読み込む）を、ネットワークに出ずに手元の試験画像で返す。
// 写真の読み込み・キャンバスへの描画（CORS 付き）の経路を、オフラインの試験環境でも同じように通すため。
const fs=require('fs'),path=require('path');const body=fs.readFileSync(path.join(__dirname,'fixtures','photo_fixture.jpg'));
module.exports=async pg=>{await pg.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\//,r=>r.fulfill({status:200,contentType:'image/jpeg',headers:{'access-control-allow-origin':'*','cache-control':'max-age=3600'},body}));return pg};
