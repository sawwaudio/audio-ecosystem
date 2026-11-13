CREATE TABLE IF NOT EXISTS usage_event (
 id TEXT PRIMARY KEY, browser TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL,
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE VIEW IF NOT EXISTS daily_usage AS
 SELECT date(received_at) AS utc_day,
 COUNT(DISTINCT CASE WHEN name='app_open' THEN browser END) AS active_browsers,
 COUNT(DISTINCT CASE WHEN name='app_open' AND source='instagram' THEN browser END) AS instagram_browsers,
 SUM(name='reels_exported') AS reels_exports, SUM(name='checkout_started') AS checkout_starts
 FROM usage_event GROUP BY date(received_at);

CREATE TABLE IF NOT EXISTS demo_job(
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, preset TEXT NOT NULL, lease TEXT,
 state TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS billing_fact(
 id TEXT PRIMARY KEY, event_time INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT,
 live INTEGER NOT NULL
);
CREATE VIEW IF NOT EXISTS daily_billing AS
 SELECT date(event_time,'unixepoch') AS utc_day,live,kind,count(*) AS event_count
 FROM billing_fact GROUP BY utc_day,live,kind;
CREATE TABLE IF NOT EXISTS checkout_start(
 event_id TEXT PRIMARY KEY REFERENCES usage_event(id),ref TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checkout_ref ON checkout_start(ref);
CREATE VIEW IF NOT EXISTS attributed_checkout AS
 SELECT b.id,b.event_time,b.live,u.browser,u.source FROM billing_fact b
 JOIN usage_event u ON u.id=(
 SELECT e.id FROM checkout_start s JOIN usage_event e ON e.id=s.event_id
 WHERE s.ref=b.ref AND unixepoch(e.received_at)<=b.event_time
 AND unixepoch(e.received_at)>=b.event_time-30*86400
 ORDER BY e.received_at DESC,e.id DESC LIMIT 1)
 WHERE b.kind='checkout_completed';
