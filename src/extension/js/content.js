const DEFAULT_SETTINGS = {
  blockRequests: true,
  cleanWidgets: true,
  stealthMode: true,
  whitelist: []
};

const SELECTORS = [
  '.yandex-rtb',
  '[id^="yandex_rtb"]',
  '[id*="yandex_rtb"]',
  'iframe[src*="yandex.ru"]',
  'iframe[src*="yandex.net"]',
  'iframe[src*="yandex.com"]',
  '[class*="yandex_rtb"]',
  '[data-rtb]',
  '[data-yd-widget]'
];

const STEALTH_STYLE_ID = 'rtb-blocker-stealth-style';

let currentSettings = { ...DEFAULT_SETTINGS };
let observer;
let cleanupScheduled = false;

const getSettings = async () => {
  const stored = await chrome.storage.local.get(['settings']);
  currentSettings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  return currentSettings;
};

const isWhitelisted = () => {
  const host = window.location.hostname;
  return currentSettings.whitelist?.includes(host);
};

const applyStealthMode = (enabled) => {
  const existing = document.getElementById(STEALTH_STYLE_ID);
  if (enabled && !existing) {
    const style = document.createElement('style');
    style.id = STEALTH_STYLE_ID;
    style.textContent = `
      ${SELECTORS.join(', ')} {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);
  } else if (!enabled && existing) {
    existing.remove();
  }
};

const isElementEmpty = (element) => {
  if (!element) {
    return false;
  }
  const hasElementChildren = element.children.length > 0;
  if (hasElementChildren) {
    return false;
  }
  return element.textContent.trim().length === 0;
};

const pruneEmptyAncestors = (element) => {
  let current = element?.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    if (!isElementEmpty(current)) {
      break;
    }
    const parent = current.parentElement;
    current.remove();
    current = parent;
  }
};

const cleanupWidgets = () => {
  if (!currentSettings.cleanWidgets || isWhitelisted()) {
    return 0;
  }

  let removed = 0;
  SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element.dataset.rtbBlockerCleaned) {
        element.dataset.rtbBlockerCleaned = 'true';
        const parent = element.parentElement;
        element.remove();
        pruneEmptyAncestors(parent);
        removed += 1;
      }
    });
  });
  return removed;
};

const scheduleCleanup = () => {
  if (cleanupScheduled) {
    return;
  }
  cleanupScheduled = true;
  requestAnimationFrame(() => {
    const cleaned = cleanupWidgets();
    updateStats(cleaned);
    cleanupScheduled = false;
  });
};

const updateStats = async (cleanedCount) => {
  if (!cleanedCount) {
    return;
  }
  const host = window.location.hostname;
  const { stats } = await chrome.storage.local.get(['stats']);
  const updatedStats = {
    blockedTotal: stats?.blockedTotal || 0,
    cleanupTotal: (stats?.cleanupTotal || 0) + cleanedCount,
    blockedByDomain: stats?.blockedByDomain || {},
    cleanupByDomain: {
      ...(stats?.cleanupByDomain || {}),
      [host]: (stats?.cleanupByDomain?.[host] || 0) + cleanedCount
    }
  };
  await chrome.storage.local.set({ stats: updatedStats });
};

const startObserver = () => {
  if (observer) {
    observer.disconnect();
  }
  observer = new MutationObserver(() => {
    if (currentSettings.cleanWidgets && !isWhitelisted()) {
      scheduleCleanup();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
};

const applySettings = async () => {
  await getSettings();
  applyStealthMode(currentSettings.stealthMode && !isWhitelisted());

  if (currentSettings.cleanWidgets && !isWhitelisted()) {
    const cleaned = cleanupWidgets();
    await updateStats(cleaned);
    startObserver();
  } else if (observer) {
    observer.disconnect();
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'run-cleanup') {
    const cleaned = cleanupWidgets();
    updateStats(cleaned).then(() => {
      sendResponse({ cleaned });
    });
    return true;
  }

  if (message.type === 'settings-updated') {
    applySettings();
  }
});

applySettings();
