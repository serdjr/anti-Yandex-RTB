const DEFAULT_SETTINGS = {
  blockRequests: true,
  cleanWidgets: true,
  stealthMode: true,
  whitelist: []
};

const DEFAULT_STATS = {
  blockedTotal: 0,
  cleanupTotal: 0,
  blockedByDomain: {},
  cleanupByDomain: {}
};

const elements = {
  statusBadge: document.getElementById('statusBadge'),
  currentSite: document.getElementById('currentSite'),
  blockedCount: document.getElementById('blockedCount'),
  cleanupCount: document.getElementById('cleanupCount'),
  whitelistButton: document.getElementById('whitelistButton'),
  toggleBlockRequests: document.getElementById('toggleBlockRequests'),
  toggleCleanWidgets: document.getElementById('toggleCleanWidgets'),
  toggleStealthMode: document.getElementById('toggleStealthMode'),
  runCleanup: document.getElementById('runCleanup'),
  resetSettings: document.getElementById('resetSettings')
};

let currentDomain = 'unknown';

const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const extractDomain = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname || 'unknown';
  } catch (error) {
    return 'unknown';
  }
};

const getStorage = async () => {
  const stored = await chrome.storage.local.get(['settings', 'stats']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(stored.settings || {}) },
    stats: { ...DEFAULT_STATS, ...(stored.stats || {}) }
  };
};

const updateStorageSettings = async (updates) => {
  const stored = await getStorage();
  const settings = { ...stored.settings, ...updates };
  await chrome.storage.local.set({ settings });
  return settings;
};

const setStatus = (isWhitelisted) => {
  if (isWhitelisted) {
    elements.statusBadge.textContent = 'Paused';
    elements.statusBadge.style.background = 'rgba(249, 115, 22, 0.18)';
    elements.statusBadge.style.color = '#f97316';
    elements.statusBadge.style.borderColor = 'rgba(249, 115, 22, 0.4)';
  } else {
    elements.statusBadge.textContent = 'Active';
    elements.statusBadge.style.background = 'rgba(34, 197, 94, 0.18)';
    elements.statusBadge.style.color = '#22c55e';
    elements.statusBadge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
  }
};

const refreshStats = (stats) => {
  const blocked = stats.blockedByDomain?.[currentDomain] ?? 0;
  const cleaned = stats.cleanupByDomain?.[currentDomain] ?? 0;
  elements.blockedCount.textContent = blocked;
  elements.cleanupCount.textContent = cleaned;
};

const refreshUI = async () => {
  const { settings, stats } = await getStorage();
  const isWhitelisted = settings.whitelist.includes(currentDomain);

  elements.toggleBlockRequests.checked = settings.blockRequests;
  elements.toggleCleanWidgets.checked = settings.cleanWidgets;
  elements.toggleStealthMode.checked = settings.stealthMode;
  elements.whitelistButton.textContent = isWhitelisted ? 'Remove whitelist' : 'Whitelist';

  setStatus(isWhitelisted);
  refreshStats(stats);
};

const notifyContentScript = async (message) => {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    return null;
  }
  return chrome.tabs.sendMessage(tab.id, message).catch(() => null);
};

const handleCleanup = async () => {
  const response = await notifyContentScript({ type: 'run-cleanup' });
  if (response?.cleaned) {
    const { stats } = await getStorage();
    refreshStats(stats);
  }
};

const init = async () => {
  const tab = await getCurrentTab();
  currentDomain = extractDomain(tab?.url || '');
  elements.currentSite.textContent = currentDomain;

  await refreshUI();

  elements.toggleBlockRequests.addEventListener('change', async (event) => {
    await updateStorageSettings({ blockRequests: event.target.checked });
  });

  elements.toggleCleanWidgets.addEventListener('change', async (event) => {
    await updateStorageSettings({ cleanWidgets: event.target.checked });
    await notifyContentScript({ type: 'settings-updated' });
  });

  elements.toggleStealthMode.addEventListener('change', async (event) => {
    await updateStorageSettings({ stealthMode: event.target.checked });
    await notifyContentScript({ type: 'settings-updated' });
  });

  elements.whitelistButton.addEventListener('click', async () => {
    const { settings } = await getStorage();
    const whitelist = new Set(settings.whitelist || []);
    if (whitelist.has(currentDomain)) {
      whitelist.delete(currentDomain);
    } else {
      whitelist.add(currentDomain);
    }
    await updateStorageSettings({ whitelist: Array.from(whitelist) });
    await notifyContentScript({ type: 'settings-updated' });
    await refreshUI();
  });

  elements.runCleanup.addEventListener('click', handleCleanup);

  elements.resetSettings.addEventListener('click', async () => {
    await chrome.storage.local.set({
      settings: DEFAULT_SETTINGS,
      stats: DEFAULT_STATS
    });
    await notifyContentScript({ type: 'settings-updated' });
    await refreshUI();
  });

  chrome.storage.onChanged.addListener(() => {
    refreshUI();
  });
};

init();
