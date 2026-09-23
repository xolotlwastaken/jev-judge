# 🛠️ How to Build Jev Judge: Step-by-Step Implementation Guide

This guide breaks down exactly how **Jev Judge** was built and how you can implement it from scratch or teach it in a video or workshop.

---

## 🧠 The 30-Second Mental Model

Building a real-time AI feed classifier requires solving 4 challenges:

```text
1. DOM Detection       2. Concurrency Queue      3. Decision Engine         4. Visual Stamping
   (X Infinite Scroll)    (Don't spam the API)      (Jev Decisions API)        (Badges, Memes, HUD)
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ IntersectionObserver│──▶│ Max 5 in-flight    │──▶│ ~typesafe/jev-latest│──▶│ Glowing Borders     │
│ + MutationObserver │   │ Deduplication cache│   │ Choice criteria    │   │ AI Slop Meme Slam  │
└────────────────────┘   └────────────────────┘   └────────────────────┘   └────────────────────┘
```

1. **The Browser Layer**: Detect when a tweet scrolls into view, extract its text, and deduplicate by tweet ID.
2. **The Queue Layer**: Limit concurrent requests to 5 so scrolling fast doesn't trigger rate limits.
3. **The AI Backend**: Call TypeSafe AI's **Jev** model to categorize the post in ~200ms.
4. **The Visual Layer**: Inject a live glowing badge, an oversized meme stamp on AI slop, and update a floating HUD with spend metrics.

---

## 📦 Part 1: Build the Backend (Node.js + TypeScript)

### Why use a backend proxy instead of calling Jev directly in the browser?
- **Security**: Never expose your API keys in frontend extension code.
- **Deduplication Cache**: If the user scrolls past the same tweet twice, return the cached result in 1ms with $0 cost.
- **Live Terminal Telemetry**: Prints clean latency, cost, and classification stats designed for demos.

### 1. Project Setup
```bash
mkdir server && cd server
npm init -y
npm install express cors dotenv
npm install -D typescript tsx @types/express @types/cors @types/node
npx tsc --init
```

### 2. Calling Jev with the Decisions API (`server/src/jev.ts`)
Jev is a **System One** decision model designed for high-speed choices. Instead of generic open-ended chat completions, you pass structured criteria:

```typescript
// server/src/jev.ts
const OPENROUTER_DECISIONS_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';

export async function callJev(apiKey: string, tweetText: string) {
  const payload = {
    model: '~typesafe/jev-latest', // Note the tilde '~' for OpenRouter Jev
    state: { post: tweetText },
    questions: {
      category: {
        type: 'choice',
        instructions: 'Classify this X post based on its value to an AI & tech builder.',
        criteria: {
          breaking: 'Major AI model releases, product launches, research breakthroughs, or company acquisitions.',
          golden_nugget: 'Actionable tutorials, code snippets, benchmarks, workflows, or resources worth bookmarking.',
          meh: 'Casual banter, routine personal updates, or everyday chatter that is neither high-value nor slop.',
          ai_slop: 'Generic hype threads, recycled platitudes, impression farming, or low-information engagement bait.'
        }
      }
    }
  };

  const response = await fetch(OPENROUTER_DECISIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  const choice = data.answers.category.choice;       // e.g. 'breaking'
  const confidence = data.answers.category.confidence; // e.g. 0.99
  
  // Calculate exact dollar cost ($0.042 per 1M input tokens)
  const tokens = data.usage?.input_tokens || Math.ceil(tweetText.length / 4) + 180;
  const cost = (tokens * 0.042) / 1_000_000;

  return { category: choice, confidence, cost };
}
```

### 3. Expose the Express Endpoint (`server/src/index.ts`)
```typescript
// server/src/index.ts
import express from 'express';
import cors from 'cors';
import { callJev } from './jev.js';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

let totalJudged = 0;
let totalSpend = 0;

app.post('/api/classify', async (req, res) => {
  const { text } = req.body;
  const result = await callJev(process.env.OPENROUTER_API_KEY!, text);
  
  totalJudged++;
  totalSpend += result.cost;

  console.log(`[JEV] → ${result.category.toUpperCase()} (${Math.round(result.confidence * 100)}%)`);
  console.log(`[JEV] $${result.cost.toFixed(6)} | Total: ${totalJudged} posts ($${totalSpend.toFixed(5)})`);

  res.json({ ...result, totalJudged, totalSpend });
});

app.listen(8787, () => console.log('Backend ready on http://localhost:8787'));
```

---

## 🧩 Part 2: Build the Chrome Extension (Manifest V3)

### 1. `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "Jev Judge",
  "version": "1.0.0",
  "permissions": ["storage"],
  "host_permissions": [
    "*://x.com/*",
    "*://twitter.com/*",
    "http://localhost:8787/*"
  ],
  "content_scripts": [
    {
      "matches": ["*://x.com/*", "*://twitter.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "48": "icons/icon-48.png" }
  },
  "web_accessible_resources": [
    {
      "resources": ["memes/*.png"],
      "matches": ["*://x.com/*", "*://twitter.com/*"]
    }
  ]
}
```

### 2. Detecting Posts Without Lag (`extension/content.js`)
The golden combination on infinite-scrolling pages is **`IntersectionObserver`** + **`MutationObserver`**:

```javascript
// 1. Queue to prevent sending 50 requests at once
const queue = [];
let activeRequests = 0;

// 2. IntersectionObserver: Only process tweets that actually scroll into view
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      handleTweet(entry.target);
    }
  }
}, { rootMargin: '250px 0px 250px 0px', threshold: 0.05 });

// 3. MutationObserver: Watch for new tweets added by X's virtual scroll
const domObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) {
        if (node.matches?.('article[data-testid="tweet"]')) observer.observe(node);
        node.querySelectorAll?.('article[data-testid="tweet"]').forEach(t => observer.observe(t));
      }
    }
  }
});
domObserver.observe(document.body, { childList: true, subtree: true });
```

### 3. Extracting Stable Tweet IDs & Text
```javascript
function extractTweetData(article) {
  // Grab tweet text
  const textEl = article.querySelector('[data-testid="tweetText"]');
  if (!textEl) return null;
  const text = textEl.innerText.trim();

  // Grab stable status ID from permalink (e.g. /username/status/18882910...)
  const statusLink = article.querySelector('a[href*="/status/"]');
  const tweetId = statusLink?.href.match(/\/status\/(\d+)/)?.[1] || text.slice(0, 32);

  return { tweetId, text };
}
```

### 4. Slamming the Animated Meme Stamp on AI Slop
When Jev returns `ai_slop`, we inject a random meme directly over the tweet card:

```javascript
function triggerSlopStamp(article) {
  if (article.querySelector('.jev-slop-stamp-overlay')) return;

  const memeNum = Math.floor(Math.random() * 5) + 1; // Pick 1 of 5 memes
  const memeUrl = chrome.runtime.getURL(`memes/slop_${memeNum}.png`);

  const stamp = document.createElement('div');
  stamp.className = 'jev-slop-stamp-overlay';
  stamp.innerHTML = `<img src="${memeUrl}" class="jev-slop-stamp-img" alt="Certified AI Slop" />`;

  article.appendChild(stamp);
}
```

And style it with bounce impact keyframes in CSS (`extension/styles.css`):
```css
.jev-slop-stamp-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-8deg);
  z-index: 9999;
  pointer-events: none; /* Never blocks scrolling or clicking */
  animation: jev-stamp-slam-stay 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes jev-stamp-slam-stay {
  0%   { transform: translate(-50%, -50%) scale(3.5) rotate(-28deg); opacity: 0; }
  55%  { transform: translate(-50%, -50%) scale(0.92) rotate(-8deg); opacity: 1; }
  75%  { transform: translate(-50%, -50%) scale(1.05) rotate(-7deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1) rotate(-8deg);    opacity: 0.96; }
}

/* Red Emergency Flashing Siren Border */
article.jev-post-ai-slop {
  border: 2.5px solid #ef4444 !important;
  border-radius: 16px !important;
  animation: jev-slop-siren 0.75s infinite alternate ease-in-out !important;
}
```

### 5. Floating Live HUD Widget
In `content.js`, append a small glassmorphic badge to `document.body`:
```javascript
function renderFeedHud() {
  const hud = document.createElement('div');
  hud.className = 'jev-feed-hud';
  hud.innerHTML = `
    <span class="jev-hud-diamond">◆</span>
    <span class="jev-hud-title">JEV</span> · 
    <span id="jevHudPosts">0</span> judged · 
    <span id="jevHudCost" class="jev-hud-cost">$0.00000</span>
  `;
  document.body.appendChild(hud);
}
```
Whenever a post completes, update the HUD element and sync to `chrome.storage.local.set({ stats })` so the extension popup updates in real time.

---

## 🎬 Testing & Recording Your Demo

1. **Split-Screen Setup**: Open `x.com` on the left half of your screen and your terminal on the right.
2. **Start the backend**:
   ```bash
   cd server && npm run dev
   ```
3. **Load the extension**: Go to `chrome://extensions` -> **Load unpacked** -> select `extension/`.
4. **Scroll & Observe**:
   - Scroll into an AI tutorial: highlights gold (Golden Nugget).
   - Scroll into a breaking model launch: flashes green (Breaking).
   - Scroll into an engagement-bait thread: slams a giant meme stamp with red sirens (AI Slop).
   - Scroll into a casual comment: turns grey (Meh).
5. **Point out the HUD**: Show that classifying 20+ posts costs less than **$0.0005** total!

---

## 💡 Key Takeaways to Share with Your Audience

1. **Don't use full LLMs for rapid classification**: Standard chat models take 1.5–3 seconds. System One choice models like Jev resolve in ~180ms at \$0.042/1M tokens.
2. **Throttle your DOM calls**: A queue with concurrency limit = 5 prevents browser freezes and network flooding.
3. **Always anchor stamps with `pointer-events: none`**: This allows the user to continue scrolling, liking, and clicking links without the injected meme getting in the way.
