// Call inside the existing signature-verified webhook, after the price check.
export async function billingFact(env,event,eligible){
 if(!env.USAGE_DB||!eligible||typeof event.livemode!=='boolean'||!Number.isSafeInteger(event.created))return;
 const o=event.data.object;
 const kind={
  'checkout.session.completed':o.payment_status==='paid'?'checkout_completed':null,
  'customer.subscription.created':o.status==='active'?'subscription_activated':null,
  'customer.subscription.updated':o.status==='active'&&['trialing','incomplete'].includes(event.data.previous_attributes?.status)?'subscription_activated':null,
  'invoice.paid':o.billing_reason==='subscription_cycle'?'subscription_renewed':null,
  'customer.subscription.deleted':'subscription_canceled'
 }[event.type];
 if(!kind)return;
 const ref=kind==='checkout_completed'&&/^[a-z0-9]{12,40}$/.test(o.client_reference_id||'')?o.client_reference_id:null;
 await env.USAGE_DB.prepare('INSERT OR IGNORE INTO billing_fact(id,event_time,kind,ref,live) VALUES(?,?,?,?,?)').bind(event.id,event.created,kind,ref,Number(event.livemode)).run();
}
