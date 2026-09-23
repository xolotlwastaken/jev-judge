/**
 * Jev Judge — Content Script for X / Twitter
 *
 * Automatically detects visible posts as you scroll, extracts post text,
 * calls the local Jev backend, and renders clean badges + subtle post styles.
 */

(() => {
  'use strict';

  const API_BASE_URL = 'http://localhost:8787';
  const CONCURRENCY_LIMIT = 5;

  let isEnabled = true;

  // Track processed posts: tweetId -> { status: 'judging'|'judged'|'unavailable', category, confidence, text }
  const processedPosts = new Map();

  // Queue for Jev classification requests
  const requestQueue = [];
  let activeRequests = 0;

  // Local session counters
  let sessionStats = {
    total: 0,
    breaking: 0,
    golden_nugget: 0,
    meh: 0,
    ai_slop: 0,
    totalCost: 0
  };

  /**
   * Initialize extension configuration and storage listeners
   */
  async function init() {
    try {
      const data = await chrome.storage.local.get(['enabled', 'stats']);
      isEnabled = data.enabled !== false;
      if (data.stats) {
        sessionStats = { ...sessionStats, ...data.stats };
      }
      if (!isEnabled) {
        document.body.classList.add('jev-disabled');
      }
    } catch (e) {
      console.debug('[Jev Judge] Storage init fallback:', e);
    }

    renderFeedHud();

    // Listen to changes from popup (toggle enable/disable or reset session)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;

      if (changes.stats) {
        sessionStats = { ...sessionStats, ...changes.stats.newValue };
        updateFeedHud();
      }

      if (changes.enabled !== undefined) {
        isEnabled = changes.enabled.newValue;
        if (isEnabled) {
          document.body.classList.remove('jev-disabled');
          processQueue();
        } else {
          document.body.classList.add('jev-disabled');
        }
      }

      if (changes.resetSessionTimestamp) {
        resetSession();
      }
    });

    startObserving();
  }

  /**
   * Reset local session state and clean up DOM elements
   */
  function resetSession() {
    processedPosts.clear();
    requestQueue.length = 0;
    sessionStats = { total: 0, breaking: 0, golden_nugget: 0, meh: 0, ai_slop: 0, totalCost: 0 };
    updateFeedHud();

    // Remove all injected badges and stamp overlays from DOM
    document.querySelectorAll('.jev-badge-container, .jev-slop-stamp-overlay').forEach(el => el.remove());

    // Remove all post visual treatments
    document.querySelectorAll('article.jev-post-breaking, article.jev-post-golden-nugget, article.jev-post-meh, article.jev-post-ai-slop')
      .forEach(article => {
        article.classList.remove('jev-post-breaking', 'jev-post-golden-nugget', 'jev-post-meh', 'jev-post-ai-slop');
      });

    console.log('[Jev Judge] Session state reset.');
  }

  /**
   * Extract a stable identifier for an X post:
   * 1. Status ID from permalink (e.g., /user/status/18882910)
   * 2. Fallback: text hash
   */
  function getTweetId(article, text) {
    const statusLink = article.querySelector('a[href*="/status/"]');
    if (statusLink) {
      const match = statusLink.getAttribute('href').match(/\/status\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    // Fast text hash fallback
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
    }
    return 'h_' + (hash >>> 0);
  }

  /**
   * Extract clean post text from an X tweet article
   */
  function extractTweetText(article) {
    // Avoid ads / promoted tweets if detectable
    if (article.innerText.includes('Promoted') || article.innerText.includes('Ad ·')) {
      // Secondary check: verify if there is an ad indicator
      const spans = article.querySelectorAll('span');
      for (const span of spans) {
        if (span.textContent === 'Ad' || span.textContent === 'Promoted') {
          return null; // Skip ad
        }
      }
    }

    // The primary tweet text is the first [data-testid="tweetText"] in the article
    const textEl = article.querySelector('[data-testid="tweetText"]');
    if (!textEl) return null;

    const text = textEl.innerText.trim();
    if (text.length < 5) return null; // Ignore non-substantive posts

    return text;
  }

  /**
   * Slams an animated meme stamp on top of the post itself and leaves it there permanently
   */
  function triggerSlopStamp(article, memeIndex) {
    if (article.querySelector('.jev-slop-stamp-overlay')) return;

    const memeNum = memeIndex || (Math.floor(Math.random() * 5) + 1);
    const memeUrl = chrome.runtime.getURL(`memes/slop_${memeNum}.png`);

    const stamp = document.createElement('div');
    stamp.className = 'jev-slop-stamp-overlay';
    stamp.innerHTML = `<img src="${memeUrl}" class="jev-slop-stamp-img" alt="Certified AI Slop" />`;

    article.appendChild(stamp);
  }

  /**
   * Create or update the Jev badge on a tweet
   */
  function renderBadge(article, state, category, confidence, memeIndex, shouldStamp = false) {
    let container = article.querySelector('.jev-badge-container');

    if (!container) {
      container = document.createElement('div');
      container.className = 'jev-badge-container';

      // Find insertion anchor: directly above action bar (reply, retweet, like)
      const actionBar = article.querySelector('div[role="group"]');
      if (actionBar && actionBar.parentNode) {
        actionBar.parentNode.insertBefore(container, actionBar);
      } else {
        // Fallback: append inside main tweet column
        const textEl = article.querySelector('[data-testid="tweetText"]');
        if (textEl && textEl.parentNode) {
          textEl.parentNode.insertBefore(container, textEl.nextSibling);
        } else {
          article.appendChild(container);
        }
      }
    }

    if (state === 'judging') {
      container.innerHTML = `
        <div class="jev-badge jev-judging">
          <span class="jev-diamond">◆</span>
          <span class="jev-label">JEV JUDGING...</span>
        </div>
      `;
    } else if (state === 'judged') {
      const categoryLabel = category.toUpperCase().replace('_', ' ');
      const percent = confidence ? `${Math.round(confidence * 100)}%` : '';

      container.innerHTML = `
        <div class="jev-badge jev-${category}">
          <span class="jev-diamond">◆</span>
          <span class="jev-label">JEV JUDGED · ${categoryLabel}</span>
          ${percent ? `<span class="jev-confidence">${percent}</span>` : ''}
        </div>
      `;

      // Apply prominent post treatment and flashing border highlight
      article.classList.remove('jev-post-breaking', 'jev-post-golden-nugget', 'jev-post-meh', 'jev-post-ai-slop');
      if (category === 'breaking') {
        article.classList.add('jev-post-breaking');
      } else if (category === 'golden_nugget') {
        article.classList.add('jev-post-golden-nugget');
      } else if (category === 'meh') {
        article.classList.add('jev-post-meh');
      } else if (category === 'ai_slop') {
        article.classList.add('jev-post-ai-slop');
        if (shouldStamp) {
          triggerSlopStamp(article, memeIndex);
        }
      }
    } else if (state === 'unavailable') {
      container.innerHTML = `
        <div class="jev-badge jev-unavailable">
          <span class="jev-diamond">◆</span>
          <span class="jev-label">JEV UNAVAILABLE</span>
        </div>
      `;
    }
  }

  /**
   * Process the request queue with concurrency limiting
   */
  async function processQueue() {
    if (!isEnabled) return;

    while (activeRequests < CONCURRENCY_LIMIT && requestQueue.length > 0) {
      const job = requestQueue.shift();
      activeRequests++;

      executeClassification(job)
        .catch(err => {
          console.error('[Jev Judge] Job error:', err);
        })
        .finally(() => {
          activeRequests--;
          processQueue();
        });
    }
  }

  /**
   * Execute classification against local backend
   */
  async function executeClassification(job) {
    const { tweetId, text, article } = job;

    try {
      const response = await fetch(`${API_BASE_URL}/api/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const { category, confidence } = data;

      // Pick random meme if AI Slop
      let memeIndex = null;
      if (category === 'ai_slop') {
        memeIndex = Math.floor(Math.random() * 5) + 1;
      }

      // Update post record
      processedPosts.set(tweetId, {
        status: 'judged',
        category,
        confidence,
        text,
        memeIndex
      });

      // Update badge and trigger animated stamp overlay if element is still in DOM
      if (document.body.contains(article)) {
        renderBadge(article, 'judged', category, confidence, memeIndex, true);
      }

      // Update session statistics
      sessionStats.total++;
      sessionStats.totalCost = (sessionStats.totalCost || 0) + (data.cost || 0.000014);
      if (category === 'breaking') sessionStats.breaking++;
      else if (category === 'golden_nugget') sessionStats.golden_nugget++;
      else if (category === 'meh') sessionStats.meh++;
      else if (category === 'ai_slop') sessionStats.ai_slop++;

      updateFeedHud();

      // Persist updated stats for popup
      chrome.storage.local.set({ stats: sessionStats });

    } catch (err) {
      console.warn(`[Jev Judge] Classification failed for tweet ${tweetId}:`, err.message);

      processedPosts.set(tweetId, {
        status: 'unavailable',
        text
      });

      if (document.body.contains(article)) {
        renderBadge(article, 'unavailable');
      }
    }
  }

  /**
   * Handle an observed tweet entering the viewport
   */
  function handleTweetIntersection(article) {
    if (!isEnabled) return;

    const text = extractTweetText(article);
    if (!text) return;

    const tweetId = getTweetId(article, text);

    // Check if already processed or currently judging
    if (processedPosts.has(tweetId)) {
      const cached = processedPosts.get(tweetId);
      // If X rerendered the article, re-render the badge from memory
      if (!article.querySelector('.jev-badge-container')) {
        renderBadge(article, cached.status, cached.category, cached.confidence, cached.memeIndex, false);
      }
      // Re-attach stamp overlay if missing on rerendered AI Slop post
      if (cached.category === 'ai_slop' && !article.querySelector('.jev-slop-stamp-overlay')) {
        triggerSlopStamp(article, cached.memeIndex);
      }
      return;
    }

    // Mark as judging immediately
    processedPosts.set(tweetId, { status: 'judging', text });
    renderBadge(article, 'judging');

    // Add to request queue
    requestQueue.push({ tweetId, text, article });
    processQueue();
  }

  /**
   * Floating HUD pill in the bottom corner of X showing live classified posts and spend
   */
  function renderFeedHud() {
    if (document.getElementById('jevFeedHud')) return;

    const hud = document.createElement('div');
    hud.id = 'jevFeedHud';
    hud.className = 'jev-feed-hud';
    hud.innerHTML = `
      <span class="jev-hud-diamond">◆</span>
      <span class="jev-hud-title">JEV</span>
      <span class="jev-hud-sep">·</span>
      <span class="jev-hud-posts"><span id="jevHudPosts">0</span> judged</span>
      <span class="jev-hud-sep">·</span>
      <span class="jev-hud-cost" id="jevHudCost">$0.00000</span>
    `;
    document.body.appendChild(hud);
    updateFeedHud();
  }

  function updateFeedHud() {
    const postsEl = document.getElementById('jevHudPosts');
    const costEl = document.getElementById('jevHudCost');
    if (postsEl) postsEl.textContent = sessionStats.total || 0;
    if (costEl) {
      const cost = sessionStats.totalCost || 0;
      costEl.textContent = cost < 0.01 ? `$${cost.toFixed(5)}` : `$${cost.toFixed(3)}`;
    }
  }

  /**
   * Set up IntersectionObserver and MutationObserver
   */
  function startObserving() {
    // 1. IntersectionObserver detects posts coming into view (+250px margin for smooth preloading)
    const viewportObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          handleTweetIntersection(entry.target);
        }
      }
    }, {
      root: null,
      rootMargin: '250px 0px 250px 0px',
      threshold: 0.05
    });

    // 2. Scan existing tweets on page
    const existingTweets = document.querySelectorAll('article[data-testid="tweet"]');
    existingTweets.forEach(article => viewportObserver.observe(article));

    // 3. MutationObserver watches for newly inserted tweets as user scrolls
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches('article[data-testid="tweet"]')) {
              viewportObserver.observe(node);
            } else if (node.querySelectorAll) {
              const tweets = node.querySelectorAll('article[data-testid="tweet"]');
              tweets.forEach(tweet => viewportObserver.observe(tweet));
            }
          }
        }
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Jev Judge] Active and observing X feed.');
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
