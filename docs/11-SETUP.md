# 11 — Local Setup

## Run the production build locally (read-only inspection)

```bash
cd technetos-review
python3 -m http.server 8000 --directory src/multiplayer
# open http://localhost:8000/master.html
```

But this won't actually work because:
1. The source files reference `<script src="./historical-bundle.js">` which is not in the package (1.25 MB, see NOTE.md)
2. Supabase auth requires the keys (`supabase-config.js`)

## To get a fully working local copy

### 1. Clone the canonical repo

```bash
git clone https://github.com/jatl1956/technetos.git
cd technetos
```

This includes `historical-bundle.js` and the built HTML files at root.

### 2. Direct-open the built file

Open `master.html` (or `student.html`) directly in a browser via `file://` URL. The Supabase client doesn't care about origin for auth.

### 3. Or run a local static server

```bash
python3 -m http.server 8000
# open http://localhost:8000/master.html
```

## To rebuild after editing source

```bash
cd technetos
node build-inline.js
# This regenerates dist/multiplayer/master.html and dist/multiplayer/student.html
# Copy them to the root master.html and student.html for Vercel
cp dist/multiplayer/master.html master.html
cp dist/multiplayer/student.html student.html
```

## Supabase setup (already done in production)

To recreate from scratch (advanced):

### 1. Create project at supabase.com

- Region: any
- Plan: Free tier is sufficient

### 2. Run migrations

```bash
# In Supabase SQL editor, run:
\i migrations/001_margin_short_fees.sql
\i migrations/002_margin_call_grace.sql
```

(Plus the original schema for `rooms`, `participants`, `orders` — not in repo, see Known Issues #9.)

### 3. Set RLS policies

Approximate intent (not in repo, configure in Supabase dashboard):

```sql
-- rooms
create policy "anyone reads active rooms" on rooms for select using (status in ('active', 'paused'));
create policy "master manages own rooms" on rooms for all using (auth.uid() = master_id);

-- participants
create policy "students see participants in joined rooms" on participants for select using (true);
create policy "students manage own row" on participants for all using (auth.uid() = student_id);

-- orders
create policy "students manage own orders" on orders for all using (auth.uid() = student_id);
create policy "master sees all orders in their rooms" on orders for select using (
  room_id in (select id from rooms where master_id = auth.uid())
);
```

### 4. Update `supabase-config.js`

Replace SUPABASE_URL and SUPABASE_ANON_KEY with your own.

### 5. Enable Realtime

In Supabase dashboard: Database → Replication → enable Realtime on `rooms` and `participants`.

## To regenerate the historical bundle

You need an FMP API key (Basic plan $19/mo or higher).

```python
# Use the script that's referenced but not in repo:
# (paraphrased, original was in workspace at /home/user/workspace/download-historical.py)

import json, urllib.request
API_KEY = "YOUR_FMP_KEY"
TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMD", "JPM", "GS", "BAC",
           "XOM", "CVX", "JNJ", "PFE", "AMZN", "KO", "BA", "TSLA", "SPY",
           "BTCUSD", "ETHUSD"]

bundle = {}
for ticker in TICKERS:
    url = f"https://financialmodelingprep.com/stable/historical-price-eod/full?symbol={ticker}&apikey={API_KEY}"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read().decode())
    if isinstance(data, list) and data:
        bundle[ticker] = [
            [d["date"], d["open"], d["high"], d["low"], d["close"], d["volume"]]
            for d in reversed(data)
        ]

with open("historical-bundle.js", "w") as f:
    f.write("const _HISTORICAL_BUNDLE = " + json.dumps(bundle, separators=(",",":")) + ";\n")
    f.write("HistoricalData.loadBundle(_HISTORICAL_BUNDLE);\n")
```

## Test accounts (production)

- **Master:** `testmaster@technetos.com` / `TestPass123!`
- **Student:** `alice@student.com` / `TestPass123!`

## Vercel deployment

The repo is connected to Vercel. Auto-deploys on push to `main`. No build step on Vercel (it just serves the static `master.html` and `student.html` from root).

## Browser support

Tested on:
- Chrome (latest) ✓
- Comet (latest) ✓
- Safari — should work, lightweight-charts supports it
- Firefox — should work

Mobile browsers not officially supported. There is no responsive layout.
