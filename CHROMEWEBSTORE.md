# Chrome Web Store Listing — Jev Judge

> Last Updated: 2026-09-23

## Store Listing

**Extension Name** [REQUIRED]
Jev Judge

**Short Description** [REQUIRED]
Classifies posts on your X/Twitter feed in real time using TypeSafe AI's Jev model into Breaking, Golden Nugget, Meh, or AI Slop.

**Detailed Description** [REQUIRED]
Tired of scrolling through AI hype, engagement bait, and recycled summaries on X? Jev Judge evaluates posts in your feed in real time as you scroll and adds subtle, native badges to highlight high-value insights.

Powered by TypeSafe AI's fast System One model, Jev Judge classifies posts into four clear categories:
- BREAKING: Major model releases, research breakthroughs, launch events, and genuine tech news.
- GOLDEN NUGGET: Deep tutorials, architectures, actionable code, and insightful workflows worth bookmarking.
- MEH: Casual banter, daily chatter, and ordinary everyday posts that are neither high-value nor slop.
- AI SLOP: Generic hype threads, engagement bait, and low-information commentary.

Key Features:
- Real-Time Feed Scanning: Evaluates posts smoothly as they scroll into view.
- Understated Native Badges: Clean, unobtrusive pills designed to match both dark and light modes on X.
- Subtle Visual Focus: Gently highlights breaking news and golden nuggets while subduing low-value posts.
- Session Statistics: Track how many posts you have judged directly from the extension popup.
- One-Click Toggle: Temporarily pause or reset classifications whenever you want.

How to Use:
1. Open X (Twitter) in your browser.
2. Scroll through your feed as you normally do.
3. Jev Judge automatically detects posts and injects classification badges in real time.
4. Click the extension icon in your toolbar to view your session breakdown or toggle filtering.

Privacy & Safety:
- Jev Judge only reads post text in your active feed to determine value classification.
- No personal account information, credentials, private messages, or browsing history are ever accessed or collected.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Real-time classification and badge highlighting of public social media posts on X/Twitter based on informational value.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `extension/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | `screenshots/feed-demo.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `screenshots/promo-small.png` |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Used to persist the user's enabled/disabled toggle and maintain session classification metrics across tab reloads. |
| `*://x.com/*` | host_permissions | Allows the extension content script to detect post elements on X and display classification badges. |
| `*://twitter.com/*` | host_permissions | Supports legacy Twitter URLs to display classification badges. |
| `http://localhost:8787/*` | host_permissions | Connects to the local Jev Judge backend server for real-time post classification. |
| `http://127.0.0.1:8787/*` | host_permissions | Alternative loopback address for the local Jev Judge backend server. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

Jev Judge does not collect, store, or sell any personal user data. Post text processed for classification is transmitted exclusively to the local backend proxy to communicate with the TypeSafe Jev API.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public
**Regions**: All regions

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-09-23 | Initial release with real-time X feed classification and popup stats | Draft |
