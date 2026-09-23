// Popup controller for Jev Judge

const enableToggle = document.getElementById('enableToggle');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

const totalCountEl = document.getElementById('totalCount');
const totalSpendEl = document.getElementById('totalSpend');
const breakingCountEl = document.getElementById('breakingCount');
const goldenCountEl = document.getElementById('goldenCount');
const mehCountEl = document.getElementById('mehCount');
const slopCountEl = document.getElementById('slopCount');
const btnReset = document.getElementById('btnReset');

const API_BASE_URL = 'http://localhost:8787';

function formatSpend(amount) {
  if (!amount || amount === 0) return '$0.00000';
  if (amount < 0.01) {
    return '$' + Number(amount).toFixed(5);
  }
  return '$' + Number(amount).toFixed(3);
}

// Load stored state and statistics
async function initPopup() {
  const data = await chrome.storage.local.get(['enabled', 'stats']);
  const enabled = data.enabled !== false; // Default true
  const stats = data.stats || { total: 0, breaking: 0, golden_nugget: 0, meh: 0, ai_slop: 0, totalCost: 0 };

  enableToggle.checked = enabled;
  updateStatusUI(enabled);
  updateStatsUI(stats);
}

function updateStatusUI(enabled) {
  if (enabled) {
    statusBadge.className = 'status-badge';
    statusText.textContent = 'Active';
  } else {
    statusBadge.className = 'status-badge inactive';
    statusText.textContent = 'Disabled';
  }
}

function updateStatsUI(stats) {
  totalCountEl.textContent = stats.total || 0;
  if (totalSpendEl) {
    totalSpendEl.textContent = formatSpend(stats.totalCost || stats.totalSpend || 0);
  }
  breakingCountEl.textContent = stats.breaking || 0;
  goldenCountEl.textContent = stats.golden_nugget || 0;
  if (mehCountEl) {
    mehCountEl.textContent = stats.meh || 0;
  }
  slopCountEl.textContent = stats.ai_slop || 0;
}

// Toggle enabled status
enableToggle.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ enabled });
  updateStatusUI(enabled);
});

// Reset session handler
btnReset.addEventListener('click', async () => {
  const resetStats = { total: 0, breaking: 0, golden_nugget: 0, meh: 0, ai_slop: 0, totalCost: 0 };
  await chrome.storage.local.set({
    stats: resetStats,
    resetSessionTimestamp: Date.now()
  });

  updateStatsUI(resetStats);

  // Attempt to notify backend to clear memory cache
  try {
    await fetch(`${API_BASE_URL}/api/reset`, { method: 'POST' });
  } catch (err) {
    console.debug('Backend cache reset call:', err);
  }

  // Provide quick visual feedback on button
  btnReset.textContent = '✓ Session reset';
  setTimeout(() => {
    btnReset.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Reset session
    `;
  }, 1000);
});

// Listen for live updates from content script
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.stats) {
      updateStatsUI(changes.stats.newValue || { total: 0, breaking: 0, golden_nugget: 0, meh: 0, ai_slop: 0 });
    }
    if (changes.enabled !== undefined) {
      enableToggle.checked = changes.enabled.newValue;
      updateStatusUI(changes.enabled.newValue);
    }
  }
});

initPopup();
