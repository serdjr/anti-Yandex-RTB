const DEFAULT_SETTINGS = {
  blockRequests: true,
  cleanWidgets: true,
  stealthMode: true,
  whitelist: [],
  language: 'ru'
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
  languageSelect: document.getElementById('languageSelect'),
  toggleBlockRequests: document.getElementById('toggleBlockRequests'),
  toggleCleanWidgets: document.getElementById('toggleCleanWidgets'),
  toggleStealthMode: document.getElementById('toggleStealthMode'),
  runCleanup: document.getElementById('runCleanup'),
  resetSettings: document.getElementById('resetSettings')
};

const translations = {
  en: {
    eyebrow: 'Smart Protection',
    title: 'RTB Blocker',
    languageLabel: 'Language',
    currentSiteLabel: 'Current site',
    blockedToday: 'Blocked today',
    cleanups: 'Cleanups',
    blockRequestsTitle: 'Block ad requests',
    blockRequestsSubtitle: 'Stops RTB calls before they load.',
    cleanWidgetsTitle: 'Clean recommendation widgets',
    cleanWidgetsSubtitle: 'Removes Yandex-style blocks on the page.',
    stealthTitle: 'Stealth mode',
    stealthSubtitle: 'Hides leftover ad containers quietly.',
    runCleanup: 'Run cleanup now',
    resetSettings: 'Reset settings',
    footnote: 'Protection updates automatically. Whitelisted sites are always respected.',
    whitelist: 'Whitelist',
    removeWhitelist: 'Remove whitelist',
    statusActive: 'Active',
    statusPaused: 'Paused'
  },
  ru: {
    eyebrow: 'Умная защита',
    title: 'RTB Блокировщик',
    languageLabel: 'Язык',
    currentSiteLabel: 'Текущий сайт',
    blockedToday: 'Заблокировано сегодня',
    cleanups: 'Очистки',
    blockRequestsTitle: 'Блокировать рекламные запросы',
    blockRequestsSubtitle: 'Останавливает RTB-вызовы до загрузки.',
    cleanWidgetsTitle: 'Чистить рекомендательные виджеты',
    cleanWidgetsSubtitle: 'Удаляет блоки в стиле Яндекса на странице.',
    stealthTitle: 'Скрытый режим',
    stealthSubtitle: 'Прячет оставшиеся контейнеры рекламы.',
    runCleanup: 'Запустить очистку',
    resetSettings: 'Сбросить настройки',
    footnote: 'Защита обновляется автоматически. Белый список всегда учитывается.',
    whitelist: 'В белый список',
    removeWhitelist: 'Убрать из белого списка',
    statusActive: 'Активно',
    statusPaused: 'Пауза'
  }
};

const i18nElements = document.querySelectorAll('[data-i18n]');

let currentDomain = 'unknown';

const getTranslation = (language) => translations[language] || translations.en;

const applyTranslations = (language) => {
  const dictionary = getTranslation(language);
  i18nElements.forEach((node) => {
    const key = node.dataset.i18n;
    if (dictionary[key]) {
      node.textContent = dictionary[key];
    }
  });
};

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

const setStatus = (isWhitelisted, language) => {
  const dictionary = getTranslation(language);
  if (isWhitelisted) {
    elements.statusBadge.textContent = dictionary.statusPaused;
    elements.statusBadge.style.background = 'rgba(249, 115, 22, 0.18)';
    elements.statusBadge.style.color = '#f97316';
    elements.statusBadge.style.borderColor = 'rgba(249, 115, 22, 0.4)';
  } else {
    elements.statusBadge.textContent = dictionary.statusActive;
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
  const language = settings.language || 'en';
  const dictionary = getTranslation(language);

  elements.toggleBlockRequests.checked = settings.blockRequests;
  elements.toggleCleanWidgets.checked = settings.cleanWidgets;
  elements.toggleStealthMode.checked = settings.stealthMode;
  elements.languageSelect.value = language;
  elements.whitelistButton.textContent = isWhitelisted
    ? dictionary.removeWhitelist
    : dictionary.whitelist;

  applyTranslations(language);
  setStatus(isWhitelisted, language);
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

  elements.languageSelect.addEventListener('change', async (event) => {
    await updateStorageSettings({ language: event.target.value });
    await refreshUI();
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
