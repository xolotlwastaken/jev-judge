# ⚡ Jev Judge — Real-Time AI Post Classifier for X / Twitter

A Chrome Extension (Manifest V3) and high-speed Node.js/TypeScript backend that uses **TypeSafe AI's Jev** System One model to evaluate, classify, and visually tag posts on X (Twitter) in real time as you scroll your feed.

Designed specifically for clear, engaging demos with visually obvious post highlights, animated stamps, live spend tracking, and terminal logs.

---

## 🎯 What Jev Judge Does

As you scroll your feed on [x.com](https://x.com), Jev Judge detects visible posts, extracts the text, and streams it to the Jev decision pipeline. Each post is classified into one of **4 categories**:

| Category | Indicator | Visual Effect on X | Description |
| :--- | :---: | :--- | :--- |
| **BREAKING** | 🟢 Green | Neon green flashing strobe badge + bright green glowing left edge | Major model releases, breaking company announcements, research breakthroughs, and critical AI industry developments. |
| **GOLDEN NUGGET** | 🟡 Gold | Radiant golden shimmering badge + glowing yellow accent border | High-value technical tutorials, benchmarks, system prompts, code repositories, actionable architectures, and resources worth bookmarking. |
| **MEH** | ⚪ Grey | Clean subtle grey badge (`#64748b`) + grey accent line | Casual chatter, mundane daily updates, routine banter, and ordinary everyday posts that are neither high-value nor blatant slop. |
| **AI SLOP** | 🔴 Red | **Oversized animated meme stamp** + flashing emergency siren border | Generic hype threads, recycled engagement bait, vague motivational platitudes, and impression-farming threads. |

### 💥 High-Impact Visual Features
- **Permanent Meme Stamp on AI Slop**: Slams an animated meme stamp (`slop_1.png` to `slop_5.png`) directly onto the post with bounce physics. The stamp stays permanently on the post with zero click interference (`pointer-events: none`).
- **Live Feed HUD Widget**: A floating dark glassmorphic pill in the bottom-right corner of X showing live counts and cost ticker: `◆ JEV · 24 judged · $0.00034`.
- **Real-Time Cost Tracking**: Calculates token costs at \$0.042 per 1M input tokens. Track spend per-post, in the terminal, in the floating HUD, and in the popup.
- **Dark Mode Popup**: Click the extension icon to view cumulative session statistics, per-category breakdown, toggle filtering on/off, or click **Reset session** to clear caches and counters with one click.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       X (Twitter) Feed                      │
│                                                             │
│   [IntersectionObserver] (detects posts entering view)       │
│               ↓                                             │
│   [Concurrency Queue] (max 5 active classifications)        │
│               ↓                                             │
│   Chrome Extension (Manifest V3 Content Script)             │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/classify
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            Node.js / TypeScript Express Backend             │
│                  (http://localhost:8787)                    │
│                                                             │
│   1. In-memory SHA-256 hash cache (instant duplicate skips) │
│   2. Multi-provider Decision Pipeline:                      │
│      • OpenRouter Jev (~typesafe/jev-latest Decisions API)   │
│      • TypeSafe AI Direct (api.typesafe.ai/v1/systemone)    │
│      • Groq (Llama 3.3 70B ~150ms fallback)                 │
│      • OpenAI (gpt-4o-mini fallback)                        │
│      • Local Demo Mock Mode (offline fallback, 0 keys)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON: category, confidence,
                               │ cost, probabilities
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOM Injection on X                       │
│                                                             │
│   • Injects badge above tweet action bar                    │
│   • Stamped meme overlay on AI Slop                         │
│   • Glowing border highlights (Green, Gold, Grey, Red)      │
│   • Live Feed HUD pill update                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Implement & Run This Repo

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Google Chrome](https://www.google.com/chrome/) or any Chromium browser (Brave, Edge, Arc)
- *(Optional)* An API key from [OpenRouter](https://openrouter.ai/keys) or [TypeSafe AI](https://typesafe.ai)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/jev-judge.git
cd jev-judge
```

---

### Step 2: Set Up the Backend Server

1. Navigate into the `server/` directory and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```

3. Choose your AI provider in `server/.env`:
   - **Option A: OpenRouter (Instant Jev Access — No Waitlist)**
     ```env
     OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key
     ```
   - **Option B: TypeSafe AI Direct**
     ```env
     TYPESAFE_API_KEY=your_typesafe_key
     ```
   - **Option C: Free Groq Fallback (~150ms)**
     ```env
     GROQ_API_KEY=gsk_your_groq_key
     ```
   - **Option D: Offline Local Demo Mode (Zero API Keys Needed)**
     Leave the keys blank or commented out. The server will run in intelligent simulation mode with realistic classifications and 20ms latency—ideal for quick demos or recording offline!

---

### Step 3: Start the Backend Server

```bash
npm run dev
```

You should see:

```text
==================================================
  Jev Judge Backend running on http://localhost:8787
  Active Provider: OpenRouter (Jev)
  Debug:           Disabled
==================================================
```

Verify the health check in a separate terminal:
```bash
curl http://localhost:8787/health
# {"status":"ok","service":"jev-judge-backend","timestamp":"..."}
```

---

### Step 4: Install the Chrome Extension

1. Open Google Chrome and go to `chrome://extensions`.
2. Turn ON **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder inside this repository.
5. You will see **Jev Judge** appear in your extension list with its diamond icon.

---

### Step 5: Test on X (Twitter)

1. Open [x.com](https://x.com) in Chrome (or reload any existing X tab).
2. Look at the bottom-right corner: you will see the floating **JEV HUD pill**.
3. Scroll through your feed:
   - Posts entering the viewport will briefly flash `◆ JEV JUDGING...`
   - Within milliseconds, the badge transforms into `◆ JEV JUDGED · BREAKING`, `GOLDEN NUGGET`, `MEH`, or `AI SLOP`.
   - AI Slop tweets will be stamped with an oversized meme and red siren border!
4. Check your terminal: clean YouTube-ready logs stream live:
   ```text
   [JEV] Judging post: "Anthropic officially launches Claude 3.7 Sonnet..."
   [JEV] → BREAKING (99%) · OpenRouter (Jev)
   [JEV] 210ms · $0.000022 (Total: 8 posts · $0.00019)
   ```

---

## 🧪 Testing

Run the included verification test suite:

```bash
cd server
npx tsx src/test-dom-and-api.ts
```

Output:
```text
🧪 Starting Verification Tests...

Test 1: Breaking post classification...
✓ Test 1 passed: Classified as BREAKING (94%)

Test 2: Golden Nugget post classification...
✓ Test 2 passed: Classified as GOLDEN NUGGET (89%)

Test 3: AI Slop post classification...
✓ Test 3 passed: Classified as AI SLOP (91%)

Test 4: Meh post classification...
✓ Test 4 passed: Classified as MEH (88%)

Test 5: Cache hit verification...
✓ Test 5 passed: Cache hit successfully verified

Test 6: Tweet ID extraction verification...
✓ Test 5 passed: Tweet ID regex extracted 1888291029103982019

🎉 All automated tests passed successfully!
```

---

## 📁 Repository Structure

```text
jev-judge/
├── extension/                   # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension manifest with permissions
│   ├── content.js               # Intersection/Mutation observers & DOM injection
│   ├── styles.css               # Strobe animations, badges, meme stamps, & HUD
│   ├── popup.html               # Extension popup dashboard
│   ├── popup.js                 # Popup controller & stats sync
│   ├── icons/                   # Extension icons (16, 48, 128px)
│   └── memes/                   # Meme stamp images (slop_1.png to slop_5.png)
├── server/                      # Node.js + TypeScript Backend
│   ├── src/
│   │   ├── index.ts             # Express server, CORS, session stats & logging
│   │   ├── jev.ts               # Multi-provider Jev decision pipeline & cost math
│   │   └── test-dom-and-api.ts  # End-to-end verification tests
│   ├── package.json             # Backend dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   └── .env.example             # Template for API keys
├── .gitignore                   # Comprehensive secrets & build ignores
└── README.md                    # Documentation
```

---

## 🎬 Tips for YouTube & Video Demos

1. **Split-Screen Layout**: Position your browser with `x.com` on the left and your terminal running `npm run dev` on the right. Viewers can see classifications resolve simultaneously in the terminal and on the feed.
2. **Demo AI Slop First**: Scroll to an engagement-bait tweet to demonstrate the oversized meme stamp slam animation.
3. **Show the HUD & Cost**: Highlight the floating pill at the bottom-right showing that running Jev on dozens of posts costs less than a tenth of a cent.
4. **Reset Between Takes**: Click the extension icon and hit **Reset session** to clear all DOM stamps and reset counters to zero instantly.

---

## 🔒 Security & Secrets Hygiene

- **No Secrets in Extension**: The Chrome extension contains zero API keys or credentials. All API communication routes through your local backend.
- **Git Ignored**: `.env`, `.env.*`, and credentials are fully git-ignored and never committed.

---

## 📄 License

MIT License. Feel free to use this project as a foundation for your own AI extensions, demos, or feed filters.
