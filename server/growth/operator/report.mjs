// Operator-only static dashboard for a trusted local analytics database.
import {summary} from './subscriptions.mjs';
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
const [file,output]=process.argv.slice(2);
if(!file||!output)throw Error('Pass an analytics database and output HTML file');
const db=new DatabaseSync(file,{readOnly:true});
const usage=db.prepare("SELECT * FROM daily_usage WHERE utc_day=date('now')").get();
const billing=db.prepare("SELECT kind,event_count FROM daily_billing WHERE live=1 AND utc_day=date('now')").all();
const totals=new Map(billing.map(x=>[x.kind,x.event_count]));
const counts=db.prepare("SELECT source,count(distinct browser) n FROM usage_event WHERE name='app_open' AND date(received_at)=date('now') GROUP BY source").all();
const sources=new Map(counts.map(r=>[r.source,r.n]));
const paid=db.prepare("SELECT count(DISTINCT browser) n FROM attributed_checkout WHERE live=1 AND date(event_time,'unixepoch')=date('now')").get();
const subscriptions=summary(db);
const rows=[['利用ブラウザー',usage?.active_browsers],['Instagram経由のブラウザー',usage?.instagram_browsers],['YouTube経由のブラウザー',usage?(sources.get('youtube')??0):null],['Readdy経由のブラウザー',usage?(sources.get('readdy')??0):null],['流入と照合できた購入ブラウザー',totals.has('checkout_completed')?paid.n:null],['Reels書き出し',usage?.reels_exports],['決済開始',usage?.checkout_starts],['決済完了',totals.get('checkout_completed')],['契約開始',totals.get('subscription_activated')],['更新',totals.get('subscription_renewed')],['解約',totals.get('subscription_canceled')],['契約額ベース月額（割引・税調整前）',subscriptions.grossMRR],['Pro契約者（active）',subscriptions.customers],['Free→Pro転換率',null],['30日前の契約者のうち現在非継続の割合',subscriptions.churn]];
writeFileSync(output,'<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>saww audio ecosystem 利用集計</title><style>body{font:17px system-ui;max-width:36rem;margin:2rem auto;padding:1rem}td,th{padding:.6rem;text-align:left;border-bottom:1px solid #ccc}</style><h1>saww audio ecosystem</h1><p>利用・課金 '+new Date().toISOString().slice(0,10)+' UTC</p><table>'+rows.map(([name,value])=>'<tr><th>'+name+'</th><td>'+(value??'未取得')+'</td></tr>').join('')+'</table></html>');
