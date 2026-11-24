// server/growth/billing-facts.mjs
async function billingFact(env, event, eligible) {
  if (!env.USAGE_DB || !eligible || typeof event.livemode !== "boolean" || !Number.isSafeInteger(event.created)) return;
  const o = event.data.object;
  const kind = {
    "checkout.session.completed": o.payment_status === "paid" ? "checkout_completed" : null,
    "customer.subscription.created": o.status === "active" ? "subscription_activated" : null,
    "customer.subscription.updated": o.status === "active" && ["trialing", "incomplete"].includes(event.data.previous_attributes?.status) ? "subscription_activated" : null,
    "invoice.paid": o.billing_reason === "subscription_cycle" ? "subscription_renewed" : null,
    "customer.subscription.deleted": "subscription_canceled"
  }[event.type];
  if (!kind) return;
  const ref = kind === "checkout_completed" && /^[a-z0-9]{12,40}$/.test(o.client_reference_id || "") ? o.client_reference_id : null;
  await env.USAGE_DB.prepare("INSERT OR IGNORE INTO billing_fact(id,event_time,kind,ref,live) VALUES(?,?,?,?,?)").bind(event.id, event.created, kind, ref, Number(event.livemode)).run();
}

// server/growth/readdy-jobs.mjs
var root = "/api/integrations/readdy/demo-jobs";
async function demoJobs(req, env) {
  const path = new URL(req.url).pathname;
  if (path !== root && !path.startsWith(root + "/")) return null;
  if (!env.READDY_DEMO_KEY || !env.USAGE_DB) return new Response(null, { status: 503 });
  if (req.headers.get("Authorization") !== "Bearer " + env.READDY_DEMO_KEY) return new Response(null, { status: 401 });
  const db = env.USAGE_DB;
  if (path === root && req.method === "POST") {
    const key = req.headers.get("Idempotency-Key");
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(key || "")) return new Response(null, { status: 400 });
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    if (body?.preset !== "rain-and-rock") return new Response(null, { status: 422 });
    const id = crypto.randomUUID();
    await db.prepare(`INSERT OR IGNORE INTO demo_job(id,request_key,preset)
   SELECT ?,?,? WHERE (SELECT count(*) FROM demo_job WHERE created_at>=datetime('now','-1 day'))<12`).bind(id, key, body.preset).run();
    const row = await db.prepare("SELECT id,state FROM demo_job WHERE request_key=?").bind(key).first();
    return row ? Response.json(row, { status: 202 }) : new Response(null, { status: 429 });
  }
  if (req.method === "GET" && /^[-0-9a-f]{36}$/.test(path.slice(root.length + 1))) {
    const row = await db.prepare("SELECT id,preset,state,created_at,updated_at FROM demo_job WHERE id=?").bind(path.slice(root.length + 1)).first();
    return row ? Response.json(row) : new Response(null, { status: 404 });
  }
  return new Response(null, { status: 405 });
}
async function renderQueue(req, env) {
  const path = new URL(req.url).pathname;
  if (!["/api/operator/demo/claim", "/api/operator/demo/finish"].includes(path)) return null;
  if (!env.RENDER_SERVICE_KEY || !env.USAGE_DB) return new Response(null, { status: 503 });
  if (req.headers.get("Authorization") !== "Bearer " + env.RENDER_SERVICE_KEY) return new Response(null, { status: 401 });
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (path.endsWith("/claim")) {
    const lease = crypto.randomUUID();
    const row = await env.USAGE_DB.prepare(`UPDATE demo_job SET state='rendering',updated_at=CURRENT_TIMESTAMP,lease=?
   WHERE id=(SELECT id FROM demo_job WHERE state='queued' OR
   (state='rendering' AND updated_at<datetime('now','-15 minutes')) ORDER BY created_at,id LIMIT 1)
   RETURNING id,preset,lease`).bind(lease).first();
    return row ? Response.json(row) : new Response(null, { status: 204 });
  }
  let result;
  try {
    result = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!result || !["review", "failed"].includes(result.state) || typeof result.lease !== "string") return new Response(null, { status: 400 });
  const done = await env.USAGE_DB.prepare("UPDATE demo_job SET state=?,lease=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND state='rendering' RETURNING id").bind(result.state, result.id, result.lease).first();
  return new Response(null, { status: done ? 204 : 409 });
}

// server/growth/catalog.json
var catalog_default = {
  features: [
    {
      id: "tiles",
      ja: "\u5199\u771F\u3092\u30BF\u30C3\u30D7\u3057\u3066\u5B9F\u9332\u97F3\u3092\u518D\u751F\u30FB\u91CD\u306D\u308B",
      en: "Tap photos to play and layer real recordings",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "library",
      ja: "\u5B9F\u9332\u97F3\u30E9\u30A4\u30D6\u30E9\u30EA\uFF08\u691C\u7D22\u30FB\u5730\u57DF\u30FB\u8A66\u8074\u30FB\u6A29\u5229\u60C5\u5831\uFF09",
      en: "Recording library (filters, regions, preview, rights info)",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "import",
      ja: "\u81EA\u5206\u306E\u97F3\u3092\u8AAD\u307F\u8FBC\u3080\uFF08\u7AEF\u672B\u306E\u5916\u3078\u9001\u3089\u306A\u3044\uFF09",
      en: "Import your own audio (never uploaded)",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "reel",
      ja: "\u30EA\u30FC\u30EB\u4F5C\u6210\u3068\u52D5\u753B\u306E\u66F8\u304D\u51FA\u3057\u30FB\u5171\u6709\uFF089:16\u30FB1080\xD71920\u30FB15\u301C60\u79D2\u30FB\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\uFF09",
      en: "Reel creator with video export and sharing (9:16, 1080\xD71920, 15\u201360 s, templates)",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "credits",
      ja: "\u30AF\u30EC\u30B8\u30C3\u30C8\uFF08\u5E30\u5C5E\u8868\u793A\uFF09\u306E\u81EA\u52D5\u4F5C\u6210\u30FB\u30B3\u30D4\u30FC\u30FB\u4FDD\u5B58",
      en: "Automatic credits (attribution): copy and save",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "autoplay",
      ja: "\u81EA\u5F8B\u6F14\u594F\uFF08\u81EA\u7136\u306A\u9CF4\u304D\u4EA4\u308F\u3057\uFF09",
      en: "Autonomous play (natural call-and-response)",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "creatures_free",
      ja: "\u751F\u304D\u7269\u306E\u58F025\u9332\u97F3\uFF08\u9CE5\u30FB\u866B\u30FB\u4E21\u751F\u985E\u30FB\u54FA\u4E73\u985E\u30FB\u6C34\u306E\u751F\u304D\u7269\u304B\u3089\u54045\u9332\u97F3\uFF09\u3068\u74B0\u5883\u97F310\u9332\u97F3",
      en: "25 wildlife recordings (5 each from birds, insects, amphibians, mammals and aquatic life) and 10 ambience recordings",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "creatures_all",
      ja: "\u3059\u3079\u3066\u306E\u751F\u304D\u7269\u306E\u58F0\uFF0897\u9332\u97F3\uFF09",
      en: "Every creature voice (97 recordings)",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "instruments_free",
      ja: "\u697D\u5668\uFF08\u5B9F\u9332\u97F3\uFF096\u7A2E\uFF1A\u30C7\u30A3\u30B8\u30E5\u30EA\u30C9\u30A5\u30FB\u81EA\u7136\u306E\u4F4E\u97F3\u30FB\u30D1\u30A4\u30D7\u30AA\u30EB\u30AC\u30F3\u306E\u30DA\u30C0\u30EB\u30FB\u30CF\u30FC\u30D7\u30FB\u30AB\u30EA\u30F3\u30D0\u30FB\u30D5\u30EC\u30FC\u30E0\u30C9\u30E9\u30E0\u3001\u5408\u6210\u97F3\u306F\u3059\u3079\u3066",
      en: "6 real-recorded instruments (didgeridoo, nature low, pipe organ pedal, harp, kalimba, frame drum) and all synth sounds",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "instruments_all",
      ja: "\u3059\u3079\u3066\u306E\u697D\u5668\uFF08\u5B9F\u9332\u97F3\uFF09\uFF1A\u30E0\u30D3\u30E9\u30FB\u30D0\u30E9\u30D5\u30A9\u30F3\u30FB\u30C0\u30F3\u30FB\u30C1\u30E3\u30F3\u30FB\u5F13\u3067\u5F3E\u304F\u30D7\u30B5\u30EB\u30C6\u30EA\u30FC\u306A\u3069\u306E\u4F1D\u7D71\u697D\u5668\u3092\u542B\u3080",
      en: "All real-recorded instruments, including traditional ones such as mbira, balafon, \u0111\xE0n tranh and bowed psaltery",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "mixer",
      ja: "DJ \u30DF\u30AD\u30B5\u30FC\uFF08\u30C1\u30E3\u30F3\u30CD\u30EB EQ\u30FB\u30D5\u30A3\u30EB\u30BF\u30FC\u30FB\u30DE\u30B9\u30BF\u30FC EQ\uFF09",
      en: "DJ mixer (channel EQ, filter, master EQ)",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "fx",
      ja: "BEAT FX 10\u7A2E\u30FB\u30C1\u30E3\u30F3\u30CD\u30EB FX",
      en: "10 BEAT FX and channel FX",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "sampler",
      ja: "\u30B5\u30F3\u30D7\u30E9\u30FC\uFF08\u5207\u308A\u53D6\u308A\u30FB8\u30D1\u30C3\u30C9\uFF09",
      en: "Sampler (slice, 8 pads)",
      tier: "pro",
      plans: [
        "pro"
      ],
      status: "available"
    },
    {
      id: "tracks",
      ja: "\u30DE\u30EB\u30C1\u30C8\u30E9\u30C3\u30AF\uFF08\u91CD\u306D\u9332\u308A\u30FB\u30DF\u30E5\u30FC\u30C8\u30FB\u30BD\u30ED\u30FB\u9001\u308A\u5148\uFF09",
      en: "Multitrack (overdub, mute, solo, routing)",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "export",
      ja: "\u97F3\u58F0\u30D5\u30A1\u30A4\u30EB\u306E\u66F8\u304D\u51FA\u3057\uFF08WAV\u30FBAIFF 24-bit\uFF09\u3068\u30D7\u30EA\u30BB\u30C3\u30C8\u306E\u66F8\u304D\u51FA\u3057",
      en: "Audio file export (WAV, AIFF 24-bit) and preset export",
      tier: "pro",
      plans: [
        "pro"
      ],
      status: "available"
    },
    {
      id: "midi",
      ja: "MIDI \u30B3\u30F3\u30C8\u30ED\u30FC\u30E9\u30FC\uFF08\u4E88\u5B9A\uFF09",
      en: "MIDI controllers (planned)",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "planned"
    },
    {
      id: "projects",
      ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4FDD\u5B58\uFF08\u4E88\u5B9A\uFF09",
      en: "Project saving (planned)",
      tier: "pro",
      plans: [
        "semi",
        "pro"
      ],
      status: "planned"
    },
    {
      id: "reel_visuals",
      ja: "\u30EA\u30FC\u30EB\u306E\u6620\u50CF\u30C6\u30F3\u30D7\u30EC\u30FC\u30C818\u7A2E\uFF08\u81EA\u7136\u306E\u5199\u771F\u306E\u8272\u30FB\u6D41\u4F53\u30FB\u7B49\u9AD8\u7DDA\u30FB\u4E07\u83EF\u93E1\u30FBBio Motion\u30FB\u6709\u6A5F\u30FB\u7C92\u5B50\u306A\u3069\uFF09\u3002\u6620\u50CF\u306F\u97F3\u304B\u3089\u63CF\u304F",
      en: "18 reel visual templates (nature photo colours, flow, contour, kaleidoscope, Bio Motion, organic, particles\u2026), drawn from the sound",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "rights",
      ja: "\u5546\u7528\u30E2\u30FC\u30C9\uFF1ACC0\u30FB\u30D1\u30D6\u30EA\u30C3\u30AF\u30C9\u30E1\u30A4\u30F3\u30FBCC BY \u3060\u3051\u3067\u9CF4\u3089\u3059\uFF0FBY-SA \u3092\u542B\u3080\u66F8\u304D\u51FA\u3057\u306F\u8B66\u544A\u3002\u30EA\u30FC\u30EB\u306F BY-SA \u3092\u542B\u3081\u305A\u3001\u5E30\u5C5E\u8868\u793A\u3092\u6620\u50CF\u3068\u30AF\u30EC\u30B8\u30C3\u30C8\u306B\u6B8B\u3059",
      en: "Commercial mode: play only CC0 / public domain / CC BY; warns when an export contains BY-SA. Reels never include BY-SA and carry attribution on screen and in the credits",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    },
    {
      id: "tuning",
      ja: "432Hz\u30FB5-limit \u7D14\u6B63\u5F8B\u306E\u97F3\u5F8B\u30A8\u30F3\u30B8\u30F3\uFF08\u57FA\u6E96 A4 \u3068\u97F3\u5F8B\u3092\u9078\u3079\u308B\u3001\u548C\u97F3\u306E\u5404\u97F3\u306E\u5468\u6CE2\u6570\u3092\u8868\u793A\u3001\u66F8\u304D\u51FA\u3057\u306E\u30AF\u30EC\u30B8\u30C3\u30C8\u306B\u97F3\u5F8B\u3092\u8A18\u9332\uFF09",
      en: "Tuning engine: A4 = 432 Hz and 5-limit just intonation (choose reference and temperament, see each note\u2019s frequency, tuning recorded in export credits)",
      tier: "free",
      plans: [
        "free",
        "semi",
        "pro"
      ],
      status: "available"
    }
  ],
  sounds: [
    {
      id: "uguisu-yokohama",
      title_ja: "\u30A6\u30B0\u30A4\u30B9\uFF08\u6A2A\u6D5C\u30FB\u8857\u306A\u304B\uFF09",
      title_en: "Japanese bush warbler (Yokohama, city)",
      group: "birds",
      author: "warukunai",
      license: "CC0 1.0",
      source: "https://freesound.org/people/warukunai/sounds/524526/",
      location: "\u795E\u5948\u5DDD\u770C\u6A2A\u6D5C\u5E02\uFF08\u6295\u7A3F\u8005\u306E\u81EA\u5B85\u4ED8\u8FD1\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/uguisu-yokohama.mp3"
    },
    {
      id: "song-thrush",
      title_ja: "\u30A6\u30BF\u30C4\u30B0\u30DF",
      title_en: "Song thrush",
      group: "birds",
      author: "Artemis_R_Swann",
      license: "CC0 1.0",
      source: "https://freesound.org/people/Artemis_R_Swann/sounds/517477/",
      location: "\u82F1\u56FD\u30A4\u30F3\u30B0\u30E9\u30F3\u30C9\u30FB\u30B1\u30F3\u30D6\u30EA\u30C3\u30B8",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/song-thrush.mp3"
    },
    {
      id: "eurasian-wren",
      title_ja: "\u30DF\u30BD\u30B5\u30B6\u30A4\uFF08\u3055\u3048\u305A\u308A\uFF09",
      title_en: "Eurasian wren (song)",
      group: "birds",
      author: "Sacha.Julien",
      license: "CC0 1.0",
      source: "https://freesound.org/people/Sacha.Julien/sounds/734533/",
      location: "\u30D5\u30E9\u30F3\u30B9\u30FB\u30A4\u30BC\u30FC\u30EB\u770C Claix\uFF08Peuil \u306E\u81EA\u7136\u5730\u533A\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/eurasian-wren.mp3"
    },
    {
      id: "nightingale-russia",
      title_ja: "\u30CA\u30A4\u30C1\u30F3\u30B2\u30FC\u30EB\uFF08\u30ED\u30B7\u30A2\u5317\u897F\u90E8\u30FB\u7A2E\u540D\u8A18\u8F09\u306A\u3057\uFF09",
      title_en: "Nightingale (NW Russia, species not stated)",
      group: "birds",
      author: "smand",
      license: "CC0 1.0",
      source: "https://freesound.org/people/smand/sounds/521035/",
      location: "\u30ED\u30B7\u30A2\u30FB\u30EC\u30CB\u30F3\u30B0\u30E9\u30FC\u30C9\u5DDE\u30AD\u30F3\u30AE\u30BB\u30C3\u30D7\u5730\u533A Pustomerzhskoe",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/nightingale-russia.mp3"
    },
    {
      id: "tawny-owl",
      title_ja: "\u30E2\u30EA\u30D5\u30AF\u30ED\u30A6",
      title_en: "Tawny owl",
      group: "birds",
      author: "Benboncan",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/Benboncan/sounds/63220/",
      location: "\u82F1\u56FD\u30A6\u30A7\u30FC\u30EB\u30BA\u30FB\u30B0\u30A6\u30A3\u30CD\u30BA\u5DDE Penrhyndeudraeth",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/tawny-owl.mp3"
    },
    {
      id: "cicada",
      title_ja: "\u30A2\u30D6\u30E9\u30BC\u30DF",
      title_en: "Large brown cicada",
      group: "insects",
      author: "Cory / ISAKA Yoji",
      license: "CC BY 2.1 JP",
      source: "https://commons.wikimedia.org/wiki/File:Aburazemi_07z7315.ogg",
      location: "\u795E\u5948\u5DDD\u770C\u5DDD\u5D0E\u5E02\u5BAE\u524D\u533A\u30FB\u6771\u9AD8\u6839\u68EE\u6797\u516C\u5712",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/cicada.mp3"
    },
    {
      id: "higurashi",
      title_ja: "\u30D2\u30B0\u30E9\u30B7",
      title_en: "Evening cicada",
      group: "insects",
      author: "\u03A364",
      license: "CC BY 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Tanna_japonensis_v01.ogg",
      location: "\u795E\u5948\u5DDD\u770C\u5DDD\u5D0E\u5E02\u9EBB\u751F\u533A",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/higurashi.mp3"
    },
    {
      id: "kashiwa-insects",
      title_ja: "\u866B\u306E\u5408\u5531\uFF08\u5343\u8449\u30FB\u67CF\uFF09",
      title_en: "Insect chorus (Kashiwa, Chiba)",
      group: "landscape",
      author: "RutgerMuller",
      license: "CC0 1.0",
      source: "https://freesound.org/people/RutgerMuller/sounds/365257/",
      location: "\u5343\u8449\u770C\u67CF\u5E02\uFF08\u7551\u3068\u5C0F\u3055\u306A\u6797\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/kashiwa-insects.mp3"
    },
    {
      id: "crickets-washington",
      title_ja: "\u591C\u306E\u30B3\u30AA\u30ED\u30AE\uFF08\u30EF\u30B7\u30F3\u30C8\u30F3\u5DDE\u30CA\u30C1\u30A7\u30B9\uFF09",
      title_en: "Crickets at night (Naches, Washington)",
      group: "insects",
      author: "ES335-001",
      license: "CC0 1.0",
      source: "https://freesound.org/people/ES335-001/sounds/440574/",
      location: "\u7C73\u56FD\u30EF\u30B7\u30F3\u30C8\u30F3\u5DDE Naches \u8FD1\u304F\u306E Nile Valley",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/crickets-washington.mp3"
    },
    {
      id: "tsukutsukuboshi",
      title_ja: "\u30C4\u30AF\u30C4\u30AF\u30DC\u30A6\u30B7",
      title_en: "Meimuna opalifera cicada",
      group: "insects",
      author: "\u03A364",
      license: "CC BY 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Meimuna_opalifera_v01.ogg",
      location: "\u795E\u5948\u5DDD\u770C\u5DDD\u5D0E\u5E02\u9EBB\u751F\u533A",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/tsukutsukuboshi.mp3"
    },
    {
      id: "common-toad",
      title_ja: "\u30E8\u30FC\u30ED\u30C3\u30D1\u30D2\u30AD\u30AC\u30A8\u30EB",
      title_en: "Common toad",
      group: "animals",
      author: "Breviceps",
      license: "CC0 1.0",
      source: "https://freesound.org/people/Breviceps/sounds/462863/",
      location: "\u539F\u5178\u306B\u8A18\u8F09\u306A\u3057\uFF08\u30D2\u30AD\u30AC\u30A8\u30EB\u306E\u9053\u8DEF\u6A2A\u65AD\u3092\u52A9\u3051\u308B\u6D3B\u52D5\u4E2D\u3001\u30D0\u30B1\u30C4\u306E\u4E2D\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/common-toad.mp3"
    },
    {
      id: "ricefield-frogs",
      title_ja: "\u591C\u306E\u6C34\u7530\u306E\u30AB\u30A8\u30EB\u306E\u5408\u5531\uFF08\u548C\u6B4C\u5C71\uFF09",
      title_en: "Night frog chorus in a rice paddy (Wakayama)",
      group: "landscape",
      author: "Robin_Dupuy",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/Robin_Dupuy/sounds/853181/",
      location: "\u548C\u6B4C\u5C71\u770C\u30FB\u9AD8\u91CE\u5C71\u8FD1\u304F\u306E\u5BCC\u8CB4\u5730\u533A\u306E\u6C34\u7530",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/ricefield-frogs.mp3"
    },
    {
      id: "pacific-treefrog-chorus",
      title_ja: "\u30BF\u30A4\u30D8\u30A4\u30E8\u30A6\u30A2\u30DE\u30AC\u30A8\u30EB\u985E\u306E\u5408\u5531\uFF08\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u30FB\u30DA\u30C8\u30ED\u30EA\u30A2\uFF09",
      title_en: "Pacific tree frog chorus (Petrolia, California)",
      group: "animals",
      author: "CVLTIV8R",
      license: "CC0 1.0",
      source: "https://freesound.org/people/CVLTIV8R/sounds/852657/",
      location: "\u7C73\u56FD\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u5DDE Petrolia \u306E\u5C0F\u3055\u306A\u6C60",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/pacific-treefrog-chorus.mp3"
    },
    {
      id: "malaysian-frogs",
      title_ja: "\u30AB\u30A8\u30EB\u306E\u7FA4\u308C\uFF08\u30DE\u30EC\u30FC\u30B7\u30A2\u30FB\u30E1\u30EB\u30B7\u30F3\uFF09",
      title_en: "Frogs in the evening (Mersing, Malaysia)",
      group: "animals",
      author: "ikbenraar",
      license: "CC0 1.0",
      source: "https://freesound.org/people/ikbenraar/sounds/819667/",
      location: "\u30DE\u30EC\u30FC\u30B7\u30A2\u30FB\u30B8\u30E7\u30DB\u30FC\u30EB\u5DDE Mersing",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/malaysian-frogs.mp3"
    },
    {
      id: "treefrog-france",
      title_ja: "\u30A2\u30DE\u30AC\u30A8\u30EB\u985E\uFF08\u30D5\u30E9\u30F3\u30B9\u5357\u897F\u90E8\u30FB\u7A2E\u540D\u8A18\u8F09\u306A\u3057\uFF09",
      title_en: "Tree frog (SW France, species not stated)",
      group: "animals",
      author: "reinsamba",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/reinsamba/sounds/15689/",
      location: "\u30D5\u30E9\u30F3\u30B9\u30FB\u30ED\u30C3\u30C8\uFF1D\u30A8\uFF1D\u30AC\u30ED\u30F3\u30CC\u770C Saint-Sernin",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/treefrog-france.mp3"
    },
    {
      id: "roe-deer",
      title_ja: "\u30CE\u30ED\u30B8\u30AB\u306E\u9CF4\u304D\u4EA4\u308F\u3057\uFF08\u30D6\u30EB\u30BF\u30FC\u30CB\u30E5\uFF09",
      title_en: "Roe deer calls (Brittany)",
      group: "animals",
      author: "bruno.auzet",
      license: "CC0 1.0",
      source: "https://freesound.org/people/bruno.auzet/sounds/850406/",
      location: "\u30D5\u30E9\u30F3\u30B9\u30FB\u30E2\u30EB\u30D3\u30A2\u30F3\u770C Saint-Dolay",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/roe-deer.mp3"
    },
    {
      id: "wolf",
      title_ja: "\u30AA\u30AA\u30AB\u30DF\uFF08\u7FA4\u308C\u306E\u9060\u5420\u3048\u30FB\u30F4\u30A7\u30EB\u30B3\u30FC\u30EB\uFF09",
      title_en: "Wolf pack howling (Vercors)",
      group: "animals",
      author: "Sacha.Julien",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/Sacha.Julien/sounds/762242/",
      location: "\u30D5\u30E9\u30F3\u30B9\u30FB\u30F4\u30A7\u30EB\u30B3\u30FC\u30EB\u306E\u68EE",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/wolf.mp3"
    },
    {
      id: "siamang-belgium",
      title_ja: "\u30D5\u30AF\u30ED\u30C6\u30CA\u30AC\u30B6\u30EB\uFF08\u30D9\u30EB\u30AE\u30FC\u306E\u52D5\u7269\u5712\uFF09",
      title_en: "Siamangs (zoo, Belgium)",
      group: "animals",
      author: "ikbenraar",
      license: "CC0 1.0",
      source: "https://freesound.org/people/ikbenraar/sounds/819670/",
      location: "\u30D9\u30EB\u30AE\u30FC\u30FB\u30A8\u30CE\u30FC\u5DDE Brugelette\uFF08\u52D5\u7269\u5712\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/siamang-belgium.mp3"
    },
    {
      id: "bat-batbox",
      title_ja: "\u30B3\u30A6\u30E2\u30EA\u306E\u30A8\u30B3\u30FC\u30ED\u30B1\u30FC\u30B7\u30E7\u30F3\uFF08\u30D0\u30C3\u30C8\u30C7\u30A3\u30C6\u30AF\u30BF\u30FC\u30FB\u30D5\u30E9\u30F3\u30B9\uFF09",
      title_en: "Bat echolocation via bat detector (France)",
      group: "animals",
      author: "Sacha.Julien",
      license: "CC0 1.0",
      source: "https://freesound.org/people/Sacha.Julien/sounds/724581/",
      location: "\u30D5\u30E9\u30F3\u30B9\u30FB\u30C9\u30ED\u30FC\u30E0\u770C Eurre \u306E\u81EA\u7136\u4FDD\u8B77\u533A\uFF08Livron-sur-Dr\xF4me\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/bat-batbox.mp3"
    },
    {
      id: "fox",
      title_ja: "\u30AD\u30C4\u30CD\uFF08\u591C\u306E\u9CF4\u304D\u58F0\uFF09",
      title_en: "Fox cry at night",
      group: "animals",
      author: "Simon Spiers",
      license: "CC0 1.0",
      source: "https://freesound.org/people/Simon%20Spiers/sounds/431302/",
      location: "\u539F\u5178\u306B\u8A18\u8F09\u306A\u3057\uFF08\u5BDD\u5BA4\u306E\u7A93\u306E\u3059\u3050\u5916\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/fox.mp3"
    },
    {
      id: "atlantic-spotted-dolphin",
      title_ja: "\u30BF\u30A4\u30BB\u30A4\u30E8\u30A6\u30DE\u30C0\u30E9\u30A4\u30EB\u30AB",
      title_en: "Atlantic spotted dolphin",
      group: "animals",
      author: "geraldfiebig",
      license: "CC0 1.0",
      source: "https://freesound.org/people/geraldfiebig/sounds/385796/",
      location: "\u30B9\u30DA\u30A4\u30F3\u30FB\u30AB\u30CA\u30EA\u30A2\u8AF8\u5CF6\u30E9\u30FB\u30B4\u30E1\u30E9\u5CF6 Valle Gran Rey \u6C96",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/atlantic-spotted-dolphin.mp3"
    },
    {
      id: "humpback",
      title_ja: "\u30B6\u30C8\u30A6\u30AF\u30B8\u30E9\u306E\u6B4C\uFF08\u30E2\u30F3\u30C8\u30EC\u30FC\u6E7E\u30FB\u6DF1\u6D77\uFF09",
      title_en: "Humpback whale song (Monterey Bay, deep water)",
      group: "animals",
      author: "MBARI_MARS",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/MBARI_MARS/sounds/496870/",
      location: "\u7C73\u56FD\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u5DDE\u30B5\u30F3\u30BF\u30AF\u30EB\u30FC\u30BA\u6C96\u306E\u6DF1\u6D77\uFF0836.71, \u2212122.186\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/humpback.mp3"
    },
    {
      id: "dolphin",
      title_ja: "\u30A4\u30EB\u30AB\u306E\u58F0\uFF08\u30AB\u30EA\u30D6\u6D77\u30FB\u6C34\u4E2D\u30FB\u7A2E\u540D\u8A18\u8F09\u306A\u3057\uFF09",
      title_en: "Dolphins underwater (Caribbean, species not stated)",
      group: "animals",
      author: "felix.blume",
      license: "CC0 1.0",
      source: "https://freesound.org/people/felix.blume/sounds/161691/",
      location: "\u30E1\u30AD\u30B7\u30B3\u30FB\u30AD\u30F3\u30BF\u30CA\u30ED\u30FC\u5DDE \u30D7\u30F3\u30BF\u30FB\u30A2\u30EC\u30F3\u8FD1\u304F\u306E\u6C96",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/dolphin.mp3"
    },
    {
      id: "garden-pond-hydrophone",
      title_ja: "\u5EAD\u306E\u6C60\u306E\u6C34\u4E2D\u97F3\uFF08\u82F1\u56FD\u30C7\u30F4\u30A9\u30F3\uFF09",
      title_en: "Garden pond hydrophone (Devon, UK)",
      group: "animals",
      author: "odilonmarcenaro",
      license: "CC0 1.0",
      source: "https://freesound.org/people/odilonmarcenaro/sounds/271673/",
      location: "\u82F1\u56FD\u30A4\u30F3\u30B0\u30E9\u30F3\u30C9\u30FB\u30C7\u30F4\u30A9\u30F3 Crediton",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/garden-pond-hydrophone.mp3"
    },
    {
      id: "snapping-shrimp",
      title_ja: "\u30C6\u30C3\u30DD\u30A6\u30A8\u30D3\u985E\u306E\u306F\u3058\u3051\u308B\u97F3\uFF08\u30D5\u30ED\u30EA\u30C0\u30FB\u6C34\u4E2D\uFF09",
      title_en: "Snapping shrimp (Florida, underwater)",
      group: "animals",
      author: "nathanwolek",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/nathanwolek/sounds/737242/",
      location: "\u7C73\u56FD\u30D5\u30ED\u30EA\u30C0\u5DDE New Smyrna Beach\uFF08\u30AD\u30E3\u30CA\u30D9\u30E9\u30EB\u56FD\u7ACB\u6D77\u5CB8\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/snapping-shrimp.mp3"
    },
    {
      id: "takayama-river",
      title_ja: "\u9AD8\u5C71\u306E\u5DDD\uFF08\u65E5\u672C\uFF09",
      title_en: "River at Takayama (Japan)",
      group: "landscape",
      author: "kzarkses",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/kzarkses/sounds/746927/",
      location: "\u65E5\u672C\u30FB\u9AD8\u5C71\uFF08\u4F5C\u54C1\u540D\u3068\u30BF\u30B0\u3002\u770C\u540D\u306A\u3069\u306E\u8A18\u8F09\u306A\u3057\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/takayama-river.mp3"
    },
    {
      id: "california-stream",
      title_ja: "\u68EE\u306E\u6E13\u6D41\uFF08\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\uFF09",
      title_en: "Forest stream (California)",
      group: "landscape",
      author: "ultraaccel",
      license: "CC0 1.0",
      source: "https://freesound.org/people/ultraaccel/sounds/617253/",
      location: "\u7C73\u56FD\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u5DDE\u306E\u68EE\uFF08\u6EDD\u306E\u4E0B\u6D41\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/california-stream.mp3"
    },
    {
      id: "kyoto-rain",
      title_ja: "\u4EAC\u90FD\u306E\u591C\u306E\u96E8\uFF08\u5EAD\uFF09",
      title_en: "Rainy night in a Kyoto garden",
      group: "landscape",
      author: "LG",
      license: "CC BY 4.0",
      source: "https://freesound.org/people/LG/sounds/462729/",
      location: "\u4EAC\u90FD\u5E9C\u4EAC\u90FD\u5E02\uFF08\u5EAD\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/kyoto-rain.mp3"
    },
    {
      id: "rain-field",
      title_ja: "\u96E8\u306E\u5B9F\u9332\u97F3",
      title_en: "\u8A72\u5F53\u306A\u3057",
      group: "landscape",
      author: "\u30B8\u30C0\u30CD",
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:Rain.ogg",
      location: "\u9332\u97F3\u5834\u6240\u4E0D\u660E",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/rain-field.mp3"
    },
    {
      id: "rocky-beach",
      title_ja: "\u5CA9\u6D5C\u306E\u5C0F\u3055\u306A\u6CE2",
      title_en: "\u8A72\u5F53\u306A\u3057",
      group: "landscape",
      author: "mnalis",
      license: "CC BY 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Small_sea_waves_at_rocky_beach.opus",
      location: "\u539F\u672C\u306B\u8A18\u8F09\u306A\u3057",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/rocky-beach.mp3"
    },
    {
      id: "waves-big-lagoon",
      title_ja: "\u6D77\u5CB8\u306B\u6253\u3061\u5BC4\u305B\u308B\u6CE2\uFF08\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u30FB\u30D3\u30C3\u30B0\u30E9\u30B0\u30FC\u30F3\uFF09",
      title_en: "Ocean waves at Big Lagoon (Redwood Coast, California)",
      group: "landscape",
      author: "CVLTIV8R",
      license: "CC0 1.0",
      source: "https://freesound.org/people/CVLTIV8R/sounds/803679/",
      location: "\u7C73\u56FD\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u5DDE\u5317\u90E8 \u30D3\u30C3\u30B0\u30E9\u30B0\u30FC\u30F3\uFF08\u30EC\u30C3\u30C9\u30A6\u30C3\u30C9\u6D77\u5CB8\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/waves-big-lagoon.mp3"
    },
    {
      id: "midwest-woods-wind",
      title_ja: "\u6669\u590F\u306E\u68EE\u306E\u98A8\u3068\u8449\uFF08\u7C73\u56FD\u4E2D\u897F\u90E8\uFF09",
      title_en: "Late-summer woods, leaves and wind (US Midwest)",
      group: "landscape",
      author: "kvgarlic",
      license: "CC0 1.0",
      source: "https://freesound.org/people/kvgarlic/sounds/669113/",
      location: "\u7C73\u56FD\u4E2D\u897F\u90E8\u306E\u68EE",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/midwest-woods-wind.mp3"
    },
    {
      id: "bamboo-stream",
      title_ja: "\u7AF9\u6797\u306E\u98A8\u3068\u5C0F\u5DDD\u30FB\u9CE5",
      title_en: "Wind in bamboo, a small stream and birds (Japan)",
      group: "landscape",
      author: "tomasloos",
      license: "CC0 1.0",
      source: "https://freesound.org/people/tomasloos/sounds/843520/",
      location: "\u65E5\u672C\uFF08\u5730\u540D\u306E\u8A18\u8F09\u306A\u3057\uFF09",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/bamboo-stream.mp3"
    },
    {
      id: "tide-rocks",
      title_ja: "\u5F15\u304D\u6F6E\u30FB\u5CA9\u3092\u4F1D\u3046\u6C34",
      title_en: "\u8A72\u5F53\u306A\u3057",
      group: "landscape",
      author: "earthcalling",
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:Water_over_rocks_as_tide_recedes.ogg",
      location: "\u539F\u672C\u306B\u8A18\u8F09\u306A\u3057",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/tide-rocks.mp3"
    },
    {
      id: "forest-thunderstorm-hamburg",
      title_ja: "\u68EE\u306E\u96F7\u96E8\uFF08\u30C9\u30A4\u30C4\u30FB\u30CF\u30F3\u30D6\u30EB\u30AF\u8FD1\u90CA\uFF09",
      title_en: "Thunderstorm in the forest (near Hamburg)",
      group: "landscape",
      author: "pulswelle",
      license: "CC0 1.0",
      source: "https://freesound.org/people/pulswelle/sounds/280214/",
      location: "\u30C9\u30A4\u30C4\u30FB\u30CF\u30F3\u30D6\u30EB\u30AF\u8FD1\u90CA",
      plan: "free",
      preview: "https://sawwaudio.github.io/audio-ecosystem-sounds-1/audio/lite/forest-thunderstorm-hamburg.mp3"
    }
  ],
  presets: [
    {
      id: "nature",
      kind: "reel-visual",
      label: "\u81EA\u7136\uFF08\u5199\u771F\u306E\u8272\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "nature-paper",
      kind: "reel-visual",
      label: "\u81EA\u7136\u30FB\u7D19\uFF08\u56F3\u7248\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "flow",
      kind: "reel-visual",
      label: "flow\uFF08\u6D41\u4F53\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "contour",
      kind: "reel-visual",
      label: "contour\uFF08\u7B49\u9AD8\u7DDA\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "geometry",
      kind: "reel-visual",
      label: "geometry\uFF08\u4E07\u83EF\u93E1\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "forest",
      kind: "reel-visual",
      label: "forest\uFF08\u533A\u753B\u30D1\u30CD\u30EB\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "ocean",
      kind: "reel-visual",
      label: "ocean\uFF08\u533A\u753B\u30D1\u30CD\u30EB\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "night",
      kind: "reel-visual",
      label: "night\uFF08\u533A\u753B\u30D1\u30CD\u30EB\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "wildlife",
      kind: "reel-visual",
      label: "wildlife\uFF08\u533A\u753B\u30D1\u30CD\u30EB\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "minimal",
      kind: "reel-visual",
      label: "minimal",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "waveform",
      kind: "reel-visual",
      label: "waveform",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "spectrum",
      kind: "reel-visual",
      label: "spectrum\uFF08\u5206\u6790\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "abstract",
      kind: "reel-visual",
      label: "abstract\uFF08\u52D5\u304D\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "cell-pulse",
      kind: "reel-visual",
      label: "Bio Motion \xB7 cell-pulse",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "micro-swim",
      kind: "reel-visual",
      label: "Bio Motion \xB7 micro-swim",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "mycelium",
      kind: "reel-visual",
      label: "Bio Motion \xB7 mycelium",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "organic",
      kind: "reel-visual",
      label: "organic\uFF08\u6709\u6A5F\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "particles",
      kind: "reel-visual",
      label: "particles\uFF08\u7C92\u5B50\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/#reelSection"
    },
    {
      id: "rain-and-rock",
      kind: "demo-job",
      label: "\u96E8\u3068\u5CA9\u306E\u6D5C\u306E\u5B9F\u9332\u97F3\u3092\u91CD\u306D\u305F7\u79D2\u306E\u30EA\u30FC\u30EB\uFF08Readdy \u306E\u30C7\u30E2\u751F\u6210\uFF09",
      app: "https://sawwaudio.github.io/audio-ecosystem/"
    }
  ],
  media: [
    {
      kind: "youtube-channel",
      url: "https://www.youtube.com/channel/UC9A_TfS5zFRcjjVLEmRkmmw",
      series: [
        "20 seconds in nature",
        "CALM"
      ]
    },
    {
      kind: "credits",
      url: "https://sawwaudio.github.io/audio-ecosystem/credits.html",
      ja: "\u5B9F\u9332\u97F3\u306E\u30AF\u30EC\u30B8\u30C3\u30C8\u4E00\u89A7"
    },
    {
      kind: "legal",
      url: "https://sawwaudio.github.io/audio-ecosystem/legal.html",
      ja: "\u7279\u5B9A\u5546\u53D6\u5F15\u6CD5\u306B\u57FA\u3065\u304F\u8868\u8A18"
    }
  ],
  releases: [
    {
      version: "v0.72",
      date: "2026-11-15",
      app: "https://sawwaudio.github.io/audio-ecosystem/",
      ja: "\u672C\u4F53\u306B\u7D71\u5408\uFF1A432Hz\u30FB\u7D14\u6B63\u5F8B\u306E\u97F3\u5F8B\u30A8\u30F3\u30B8\u30F3\u3001\u30AD\u30FC\u3001\u30EA\u30FC\u30EB\u306E\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\uFF08\u898B\u5165\u308C\u308B\u6620\u50CF\u30FBBio Motion\uFF09\u3001\u914D\u4FE1\u7528\u306E\u753B\u9762\u3001\u8AB2\u91D1\uFF08FREE\u30FBPRO \u6708\u984D\uFF0F\u5E74\u984D\u3001SEMI-PRO \u306F\u6E96\u5099\u4E2D\uFF09\u3001\u5E74\u672B\u306E\u5168\u6A5F\u80FD\u7121\u6599\u958B\u653E"
    }
  ],
  pricing: [
    {
      id: "free",
      name: "FREE",
      tagline: "create & share.",
      currency: "USD",
      monthly: 0,
      note_ja: "\u30A2\u30AB\u30A6\u30F3\u30C8\u306A\u3057\u3067\u4F7F\u3048\u307E\u3059\u3002\u30EA\u30FC\u30EB\u52D5\u753B\u306E\u66F8\u304D\u51FA\u3057\u3082\u3067\u304D\u307E\u3059\uFF08\u97F3\u58F0\u30D5\u30A1\u30A4\u30EB\u306E\u66F8\u304D\u51FA\u3057\u306F PRO\uFF09\u3002",
      note_en: "No account needed. Includes reel video export (audio file export needs PRO).",
      checkout: "none",
      app: "https://sawwaudio.github.io/audio-ecosystem/#plansSection"
    },
    {
      id: "semi",
      name: "SEMI-PRO",
      tagline: "perform.",
      currency: "USD",
      monthly: 5,
      note_ja: "\u3059\u3079\u3066\u306E\u97F3\u6E90\u3068\u30DF\u30AD\u30B5\u30FC\u30FBFX\u30FB\u30C8\u30E9\u30C3\u30AF\u306A\u3069\u306E\u64CD\u4F5C\u3001\u30EA\u30FC\u30EB\u52D5\u753B\u306E\u66F8\u304D\u51FA\u3057\u3002\u30B5\u30F3\u30D7\u30E9\u30FC\u3068\u97F3\u58F0\u30D5\u30A1\u30A4\u30EB\u306E\u66F8\u304D\u51FA\u3057\uFF08WAV\u30FBAIFF\uFF09\u306F\u542B\u307F\u307E\u305B\u3093\u3002",
      note_en: "Every recording, the mixer, FX and tracks, and reel video export. No sampler and no audio file export (WAV, AIFF).",
      checkout: "coming_soon",
      app: "https://sawwaudio.github.io/audio-ecosystem/#plansSection",
      annual: 50
    },
    {
      id: "pro",
      name: "PRO",
      tagline: "perform & produce.",
      currency: "USD",
      monthly: 9.99,
      note_ja: "\u6708\u984D\u30FB\u81EA\u52D5\u66F4\u65B0\u3002\u3044\u3064\u3067\u3082\u89E3\u7D04\u3067\u304D\u3001\u6B21\u306E\u66F4\u65B0\u65E5\u307E\u3067 PRO \u306E\u307E\u307E\u4F7F\u3048\u307E\u3059\u3002",
      note_en: "Monthly, renews automatically. Cancel any time; PRO stays on until the next renewal date.",
      checkout: "live",
      app: "https://sawwaudio.github.io/audio-ecosystem/#plansSection"
    },
    {
      id: "open-access",
      name: "Free access period",
      until: "2026-12-31T23:59:59+09:00",
      note_ja: "2026\u5E7412\u670831\u65E5\uFF08\u65E5\u672C\u6642\u9593\uFF09\u307E\u3067\u5168\u6A5F\u80FD\u3092\u7121\u6599\u958B\u653E\u4E2D\uFF08\u97F3\u58F0\u30D5\u30A1\u30A4\u30EB\u306E\u66F8\u304D\u51FA\u3057\u306F PRO \u306E\u307F\uFF09",
      note_en: "All features are free until Dec 31, 2026 (Japan time), except audio file export (PRO only)",
      app: "https://sawwaudio.github.io/audio-ecosystem/"
    }
  ]
};

// server/growth/routes.mjs
var events = /* @__PURE__ */ new Set(["app_open", "audio_started", "recording_imported", "export_completed", "reels_exported", "checkout_started"]);
var sources = /* @__PURE__ */ new Set(["instagram", "readdy", "youtube", "direct", "other"]);
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function growthRoute(req, env) {
  const queue = await renderQueue(req, env);
  if (queue) return queue;
  const demo = await demoJobs(req, env);
  if (demo) return demo;
  const path = new URL(req.url).pathname;
  if (path.startsWith("/api/public/")) {
    const key = path.slice("/api/public/".length);
    if (!Object.hasOwn(catalog_default, key)) return new Response(null, { status: 404 });
    if (req.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
    return Response.json(catalog_default[key], { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public,max-age=300" } });
  }
  if (path !== "/api/usage/events") return null;
  const origin = req.headers.get("Origin");
  if (origin !== "https://sawwaudio.github.io") return new Response(null, { status: 403 });
  const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
  const respond = (status) => new Response(null, { status, headers });
  if (req.method === "OPTIONS") return respond(204);
  if (req.method !== "POST") return respond(405);
  if (!env.USAGE_DB) return respond(503);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return respond(415);
  if (Number(req.headers.get("content-length")) > 512) return respond(413);
  const body = await req.text();
  if (body.length > 512) return respond(413);
  let e;
  try {
    e = JSON.parse(body);
  } catch {
    return respond(400);
  }
  if (!e || !uuid.test(e.id) || !uuid.test(e.browser) || !events.has(e.name) || !sources.has(e.source)) return respond(400);
  const insert = env.USAGE_DB.prepare("INSERT INTO usage_event(id,browser,name,source) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(e.id, e.browser, e.name, e.source);
  if (e.name === "checkout_started" && /^[a-z0-9]{12,40}$/.test(e.ref || "")) {
    const link = env.USAGE_DB.prepare("INSERT OR IGNORE INTO checkout_start(event_id,ref) SELECT id,? FROM usage_event WHERE id=? AND browser=? AND name=?").bind(e.ref, e.id, e.browser, e.name);
    await env.USAGE_DB.batch([insert, link]);
  } else await insert.run();
  return respond(204);
}

// server/worker.js
var ACTIVE = /* @__PURE__ */ new Set(["active", "trialing", "past_due"]);
var MAX_TOKEN = 40 * 86400;
var MAGIC_TTL = 20 * 60;
var REFRESH_WINDOW = 60 * 86400;
var enc = new TextEncoder();
var dec = new TextDecoder();
var b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
var now = () => Math.floor(Date.now() / 1e3);
var normEmail = (e) => String(e || "").trim().toLowerCase();
var okEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
var hex = (a) => [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function verifyStripeSignature(body, header, secret, tolerance = 300) {
  if (!header || !secret) return false;
  const parts = {};
  const v1 = [];
  for (const kv of header.split(",")) {
    const [k, v] = kv.split("=");
    if (k === "t") parts.t = v;
    if (k === "v1") v1.push(v);
  }
  if (!parts.t || !v1.length || Math.abs(now() - Number(parts.t)) > tolerance) return false;
  const want = hex(await hmac(secret, parts.t + "." + body));
  return v1.some((s) => safeEq(s, want));
}
var keyCache = null;
async function privKey(env) {
  if (keyCache && keyCache.src === env.ENT_PRIVATE_JWK) return keyCache;
  const jwk = JSON.parse(env.ENT_PRIVATE_JWK);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const vkey = await crypto.subtle.importKey("jwk", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  keyCache = { src: env.ENT_PRIVATE_JWK, key, vkey, pub, kid: jwk.kid || "saww-1" };
  return keyCache;
}
async function signToken(env, payload) {
  const k = await privKey(env);
  const h = b64u(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid: k.kid }))), p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k.key, enc.encode(h + "." + p));
  return h + "." + p + "." + b64u(sig);
}
async function readToken(env, tok) {
  const [h, p, s] = String(tok || "").split(".");
  if (!h || !p || !s) return null;
  const k = await privKey(env);
  let ok = false;
  try {
    ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.vkey, unb64u(s), enc.encode(h + "." + p));
  } catch (e) {
    ok = false;
  }
  if (!ok) return null;
  try {
    return JSON.parse(dec.decode(unb64u(p)));
  } catch (e) {
    return null;
  }
}
async function stripe(env, path) {
  const r = await fetch((env.STRIPE_API || "https://api.stripe.com") + path, { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
  if (!r.ok) throw new Error("stripe " + r.status);
  return r.json();
}
function periodEnd(sub) {
  if (sub.current_period_end) return sub.current_period_end;
  const ends = (sub.items && sub.items.data || []).map((i) => i.current_period_end).filter(Boolean);
  return ends.length ? Math.max(...ends) : 0;
}
var ids = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
function planOf(env, sub) {
  const items = (sub.items && sub.items.data || []).map((i) => i.price && i.price.id);
  const pro = ids(env.PRICE_IDS), semi = ids(env.SEMI_PRICE_IDS);
  if (!pro.length && !semi.length) return "pro";
  if (items.some((id) => pro.includes(id))) return "pro";
  if (items.some((id) => semi.includes(id))) return "semi";
  if (!pro.length && items.length) return "pro";
  return null;
}
function priceOk(env, sub) {
  return !!planOf(env, sub);
}
async function saveSub(env, sub, email) {
  const cus = typeof sub.customer === "string" ? sub.customer : sub.customer && sub.customer.id;
  if (!cus) return null;
  const rec = { cus, sub: sub.id, status: sub.status, pe: periodEnd(sub), pro: priceOk(env, sub), plan: planOf(env, sub) || "pro", at: now() };
  const old = JSON.parse(await env.SAWW_KV.get("cus:" + cus) || "null");
  rec.email = normEmail(email || old && old.email || sub.customer && sub.customer.email || "");
  if (!rec.email) {
    try {
      rec.email = normEmail((await stripe(env, "/v1/customers/" + cus)).email);
    } catch (e) {
    }
  }
  await env.SAWW_KV.put("cus:" + cus, JSON.stringify(rec));
  if (rec.email) await env.SAWW_KV.put("email:" + rec.email, cus);
  return rec;
}
var isPro = (rec) => !!rec && rec.pro && ACTIVE.has(rec.status) && rec.pe > now();
var CAPS = { pro: ["export", "sampler"], semi: [] };
async function issue(env, rec) {
  const t = now(), plan = rec.plan === "semi" ? "semi" : "pro";
  return signToken(env, { sub: rec.cus, plan, cap: CAPS[plan], st: rec.status, pe: rec.pe, iat: t, exp: Math.min(rec.pe, t + MAX_TOKEN) });
}
async function freshRec(env, cus, maxAge = 12 * 3600) {
  let rec = JSON.parse(await env.SAWW_KV.get("cus:" + cus) || "null");
  if (rec && rec.pe > now() && now() - rec.at < maxAge) return rec;
  try {
    const list = await stripe(env, "/v1/subscriptions?status=all&limit=10&customer=" + encodeURIComponent(cus));
    const subs = (list.data || []).sort((a, b) => ACTIVE.has(b.status) - ACTIVE.has(a.status) || periodEnd(b) - periodEnd(a));
    if (subs[0]) rec = await saveSub(env, subs[0], rec && rec.email);
  } catch (e) {
  }
  return rec;
}
function cors(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allow = String(env.ALLOWED_ORIGINS || new URL(env.APP_URL).origin).split(",").map((s) => s.trim());
  return allow.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}
var json = (obj, status, h) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...h || {} } });
var back = (env, frag) => new Response(null, { status: 303, headers: { Location: env.APP_URL + "#" + frag, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
async function webhook(req, env) {
  const body = await req.text();
  if (!await verifyStripeSignature(body, req.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET)) return json({ error: "bad signature" }, 400);
  const ev = JSON.parse(body), o = ev.data && ev.data.object;
  if (await env.SAWW_KV.get("ev:" + ev.id)) return json({ ok: true, dup: true });
  let eligible = false;
  if (ev.type === "checkout.session.completed" && o.mode === "subscription" && o.subscription) {
    const sub = await stripe(env, "/v1/subscriptions/" + o.subscription);
    eligible = priceOk(env, sub);
    await saveSub(env, sub, o.customer_details && o.customer_details.email || o.customer_email);
  } else if (/^customer\.subscription\.(created|updated|deleted|paused|resumed)$/.test(ev.type)) {
    const rec = await saveSub(env, o);
    eligible = rec?.pro === true;
    const previous = ev.data.previous_attributes || {};
    if (ev.type === "customer.subscription.updated" && previous.cancel_at_period_end === false && o.cancel_at_period_end === true && rec && rec.pro) {
      if (!okEmail(rec.email)) throw new Error("missing cancellation recipient");
      const end = new Date((o.cancel_at || rec.pe) * 1e3).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const result = await fetch((env.RESEND_API || "https://api.resend.com") + "/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "cancel-" + ev.id
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [rec.email],
          subject: (ev.livemode === false ? "\u3010\u30C6\u30B9\u30C8\u3011" : "") + "saww audio ecosystem " + (rec.plan === "semi" ? "SEMI-PRO" : "PRO") + " \u89E3\u7D04\u53D7\u4ED8",
          text: "\u6708\u984D " + (rec.plan === "semi" ? "SEMI-PRO" : "PRO") + " \u306E\u81EA\u52D5\u66F4\u65B0\u505C\u6B62\u3092\u53D7\u3051\u4ED8\u3051\u307E\u3057\u305F\u3002" + end + "\uFF08\u65E5\u672C\u6642\u9593\uFF09\u307E\u3067\u3054\u5229\u7528\u3044\u305F\u3060\u3051\u307E\u3059\u3002"
        })
      });
      if (!result.ok) throw new Error("cancellation email delivery request failed");
    }
  } else if (ev.type === "invoice.paid" && (o.subscription || o.parent && o.parent.subscription_details)) {
    const sid = o.subscription || o.parent.subscription_details.subscription;
    const sub = await stripe(env, "/v1/subscriptions/" + sid);
    eligible = priceOk(env, sub);
    await saveSub(env, sub, o.customer_email);
  }
  await billingFact(env, ev, eligible);
  await env.SAWW_KV.put("ev:" + ev.id, "1", { expirationTtl: 7 * 86400 });
  return json({ ok: true });
}
async function activate(req, env) {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,}$/.test(id)) return back(env, "saww-billing=error");
  let s;
  try {
    s = await stripe(env, "/v1/checkout/sessions/" + id + "?expand[]=subscription");
  } catch (e) {
    return back(env, "saww-billing=error");
  }
  if (s.status !== "complete" || !s.subscription) return back(env, "saww-billing=pending");
  const sub = typeof s.subscription === "string" ? await stripe(env, "/v1/subscriptions/" + s.subscription) : s.subscription;
  const rec = await saveSub(env, sub, s.customer_details && s.customer_details.email || s.customer_email);
  if (!isPro(rec)) return back(env, "saww-billing=pending");
  return back(env, "saww-pro=" + await issue(env, rec));
}
async function login(req, env) {
  let email = "";
  try {
    email = normEmail((await req.json()).email);
  } catch (e) {
  }
  if (!okEmail(email)) return json({ ok: false, error: "email" }, 400, cors(env, req));
  const reply = json({ ok: true }, 200, cors(env, req));
  if (await env.SAWW_KV.get("rl:" + email)) return reply;
  await env.SAWW_KV.put("rl:" + email, "1", { expirationTtl: 60 });
  const cus = await env.SAWW_KV.get("email:" + email);
  const rec = cus && await freshRec(env, cus);
  if (!isPro(rec)) return reply;
  const body = b64u(enc.encode(JSON.stringify({ c: rec.cus, e: email, exp: now() + MAGIC_TTL })));
  const t = body + "." + b64u(await hmac(env.MAGIC_SECRET, body));
  const link = new URL("/magic?t=" + t, req.url).toString();
  const html = `<p>saww audio ecosystem \u306B\u30ED\u30B0\u30A4\u30F3\u3059\u308B\u305F\u3081\u306E\u30EA\u30F3\u30AF\u3067\u3059\uFF0820\u5206\u9593\u30FB1\u56DE\u3060\u3051\u4F7F\u3048\u307E\u3059\uFF09\u3002</p><p><a href="${link}">\u30ED\u30B0\u30A4\u30F3\u3059\u308B</a></p><p>\u5FC3\u5F53\u305F\u308A\u304C\u306A\u3044\u5834\u5408\u306F\u3001\u3053\u306E\u30E1\u30FC\u30EB\u3092\u7121\u8996\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p><hr><p>This link signs you in to saww audio ecosystem (valid for 20 minutes, once).</p>`;
  const text = "saww audio ecosystem \u306B\u30ED\u30B0\u30A4\u30F3\u3059\u308B\u305F\u3081\u306E\u30EA\u30F3\u30AF\uFF0820\u5206\u9593\u30FB1\u56DE\u3060\u3051\uFF09\uFF1A\n" + link + "\n\n\u5FC3\u5F53\u305F\u308A\u304C\u306A\u3044\u5834\u5408\u306F\u7121\u8996\u3057\u3066\u304F\u3060\u3055\u3044\u3002\nSign-in link (20 minutes, once): " + link;
  await fetch((env.RESEND_API || "https://api.resend.com") + "/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: "saww audio ecosystem \u3078\u306E\u30ED\u30B0\u30A4\u30F3", html, text })
  }).catch(() => {
  });
  return reply;
}
async function magic(req, env) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const [body, sig] = t.split(".");
  if (!body || !sig || !safeEq(sig, b64u(await hmac(env.MAGIC_SECRET, body)))) return back(env, "saww-billing=link");
  let m;
  try {
    m = JSON.parse(dec.decode(unb64u(body)));
  } catch (e) {
    return back(env, "saww-billing=link");
  }
  if (!m.exp || m.exp < now() || await env.SAWW_KV.get("used:" + sig)) return back(env, "saww-billing=link");
  await env.SAWW_KV.put("used:" + sig, "1", { expirationTtl: MAGIC_TTL + 120 });
  const rec = await freshRec(env, m.c);
  if (!isPro(rec)) return back(env, "saww-billing=inactive");
  return back(env, "saww-pro=" + await issue(env, rec));
}
async function refresh(req, env) {
  let tok = "";
  try {
    tok = (await req.json()).token;
  } catch (e) {
  }
  const pl = await readToken(env, tok);
  if (!pl || !pl.sub || pl.typ || pl.exp + REFRESH_WINDOW < now()) return json({ ok: false, plan: "free", error: "token" }, 401, cors(env, req));
  const rec = await freshRec(env, pl.sub);
  if (!isPro(rec)) return json({ ok: true, plan: "free", status: rec ? rec.status : "none" }, 200, cors(env, req));
  return json({ ok: true, plan: rec.plan === "semi" ? "semi" : "pro", token: await issue(env, rec) }, 200, cors(env, req));
}
var EXPORT_TTL = 300;
var EXPORT_KINDS = /* @__PURE__ */ new Set(["audio", "video", "preset"]);
async function exportAuthorize(req, env) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
  }
  const kind = String(body.kind || "");
  if (!EXPORT_KINDS.has(kind)) return json({ ok: false, error: "kind" }, 400, cors(env, req));
  const pl = await readToken(env, body.token);
  if (!pl || !pl.sub || pl.typ || pl.exp + REFRESH_WINDOW < now()) return json({ ok: false, plan: "free", error: "token" }, 401, cors(env, req));
  const rec = await freshRec(env, pl.sub, 3600);
  if (!isPro(rec)) return json({ ok: false, plan: "free", status: rec ? rec.status : "none", error: "inactive" }, 403, cors(env, req));
  if (rec.plan === "semi") return json({ ok: false, plan: "semi", error: "plan", token: await issue(env, rec) }, 403, cors(env, req));
  const t = now();
  const ticket = await signToken(env, { typ: "export", sub: rec.cus, plan: "pro", kind, pe: rec.pe, iat: t, exp: Math.min(rec.pe, t + EXPORT_TTL) });
  return json({ ok: true, plan: "pro", ticket, exp: Math.min(rec.pe, t + EXPORT_TTL) }, 200, cors(env, req));
}
var worker_default = {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      const growth = await growthRoute(req, env);
      if (growth) return growth;
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });
      if (pathname === "/stripe/webhook" && req.method === "POST") return await webhook(req, env);
      if (pathname === "/activate" && req.method === "GET") return await activate(req, env);
      if (pathname === "/login" && req.method === "POST") return await login(req, env);
      if (pathname === "/magic" && req.method === "GET") return await magic(req, env);
      if (pathname === "/refresh" && req.method === "POST") return await refresh(req, env);
      if (pathname === "/export/authorize" && req.method === "POST") return await exportAuthorize(req, env);
      if (pathname === "/public-key" && req.method === "GET") {
        const { pub, kid } = await privKey(env);
        return json({ ...pub, kid });
      }
      if (pathname === "/") return json({ ok: true, service: "saww-billing" });
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server" }, 500, cors(env, req));
    }
  }
};
export {
  worker_default as default,
  signToken,
  verifyStripeSignature
};
