# EquiFlow

A calm place to watch a **simulated** stock tape. Prices are invented in the browser. The 20-price average, the volatility notes, and the chart are real calculations on that invented tape. An optional written read is produced by Gemini, and the API key never ships to the browser.

This is a portfolio project. It is not a brokerage, a data vendor, or investment advice.

![EquiFlow on a desktop, showing Apple’s simulated tape, the SMA-20, and a note that prices are generated in the browser.](docs/screenshots/desktop.png)

![EquiFlow on a phone, with the sample-price banner, search, and price cards stacked.](docs/screenshots/phone.png)

## What you can do

- Watch one of ten sample companies. The tape is a small random walk, about five prices a second.
- Read the latest price, the change since you opened that symbol, the high and low over that same stretch, and a simulated volume that is explicitly not exchange volume.
- See the SMA-20, the average of the last 20 prices, drawn as a dashed line once those 20 prices exist.
- Set how far the price may wander from that average before EquiFlow leaves a note. The gap is a percent, so a $150 name and a $300 name are treated the same way. The same move is not repeated for five seconds.
- Search the sample list by ticker, company, or sector, with the keyboard.
- Ask for a short read. Gemini 3 Flash describes the simulated tape. The button does nothing useful until a key is configured on the server, and the dashboard does not need that key.

The cash-session clock follows weekday hours in America/New_York, 9:30 a.m. to 4:00 p.m. It does not know holidays or early closes.

## Architecture

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[React dashboard]
    Tape[Sample tape]
    UI --- Tape
  end
  Worker[Cloudflare Worker]
  Gemini[Gemini 3 Flash]
  Tape -->|prices stay local| UI
  UI -->|last 50 simulated prices| Worker
  Worker -->|key stays on the server| Gemini
  Gemini --> Worker --> UI
```

The tape, the SMA-20, and the notes run entirely in the page. React keeps incoming prices in a ref and paints the chart and statistics together every 200ms, so a tick does not schedule its own render. At five prices a second that coalescing is modest. It is there so the screen has one steady cadence.

The only network call is optional: `POST /api/analyze`. A Vite dev server proxies `/api` to Wrangler. A deploy serves the built page and the API from the same Worker. Static assets use Workers Static Assets, with `/api/*` handled by the Worker first.

## Engineering decisions

**The model key stays on the server.** The previous build injected `GEMINI_API_KEY` into the client bundle with Vite `define`. Anyone who loaded the page could read it. The Worker reads the key from a Wrangler secret (`wrangler secret put GEMINI_API_KEY`) or, locally, from `.dev.vars`. Requests are capped at 8 per minute per IP per Cloudflare location, and the body is capped at 20 KB. The rate-limit binding is approximate and is counted separately in each Cloudflare location. A public deploy of an unauthenticated Gemini proxy can still spend quota. Put [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) or a similar gate in front of it before inviting the internet.

**Gemini 3 Flash is still the model.** `gemini-3-flash-preview` was checked against [Google’s Gemini 3 guide](https://ai.google.dev/gemini-api/docs/gemini-3) on 8 November 2026. It is a current preview model, not a retired one. The call sets `thinkingLevel` to `low`, which Google documents as the setting for short instruction-following, and it leaves temperature at the default. Thought parts are dropped before the note is shown. Preview model ids change. The id lives in `worker/gemini.ts`.

**The volatility gap is a percent of the average.** An absolute dollar gap treats a calm $150 tape and a jumpy high-priced name as the same distance. The simulator itself moves by a fraction of price, so the note uses that same idea. Sample starting prices were also brought into a round, post-split range. They are still labels for a fake tape, not quotes.

**Gains and losses are not color alone.** Up is a deep teal with an upward mark and the word “Up”. Down is a burnt orange with a downward mark and the word “Down”. The type is Atkinson Hyperlegible. Focus is a visible clay outline. The page scrolls on a phone, and the sample-data banner stays in view.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite on port 3000 and the Worker on port 8787 |
| `npm run dev:web` | Dashboard only. The written read will say the API is offline. |
| `npm run dev:api` | Worker only |
| `npm test` | SMA-20, volatility, session clock, search, and the analysis API |
| `npm run typecheck` | App and Worker projects |
| `npm run lint` | ESLint |
| `npm run build` | Production dashboard in `dist/` |
| `npm run check:bundle` | Fails if the built client contains a Gemini key or endpoint |
| `npm run deploy` | `vite build` and `wrangler deploy`. Not run by CI. |

## Setup

Node 20 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Open `http://localhost:3000`. Leave `GEMINI_API_KEY` empty in `.dev.vars` and the dashboard still runs. The “Write a read” button stays disabled and explains why.

To enable the read, put a [Gemini API key](https://aistudio.google.com/apikey) in `.dev.vars`:

```bash
GEMINI_API_KEY=your-key
```

Restart `npm run dev`. The key is used by Wrangler. It is not written into the page.

### Deploy

This repository does not deploy itself.

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

`npm run deploy` builds the dashboard and publishes the Worker named `equiflow`, including the static files in `dist/`. Logs and traces are turned on in `wrangler.jsonc`. The compatibility date is 2026-11-08.

## Tests and CI

GitHub Actions runs typecheck, lint, test, build, and the client-bundle check on Node 22. The market math under test includes:

- SMA-20 is null until 20 prices exist, then averages those 20, then drops the oldest.
- A move inside the percent threshold stays quiet. A wider move is a spike or a drop. More than twice the threshold is a large gap.
- Notes wait out a cooldown so one swing is not repeated on every tick.
- The weekday cash-session clock, including a Sunday, a morning open, and a Friday close.

## Limitations

- Prices, volume, and the ten-name list are simulated. There is no exchange feed, no WebSocket, and no Redis.
- The chart keeps a few minutes of prices. High, low, and volume reset when you pick another symbol, and they start over on refresh.
- The session clock ignores market holidays and early closes.
- Analysis sends the simulated prices you are already looking at to Google when you press the button. It is a description, not a forecast, and not advice.
- The analysis route is unauthenticated. The rate limit is per location and can be exceeded while counts catch up. Do not put a production key behind a public URL without an additional gate.
- `gemini-3-flash-preview` is a preview model and can be retired or renamed by Google.

## License

[MIT](LICENSE)
