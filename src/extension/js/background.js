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

const BLOCK_RULES = [
  {
    id: 1001,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'yandex.ru/ads',
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
    }
  },
  {
    id: 1002,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'yandex.net/ads',
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
    }
  },
  {
    id: 1003,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'yandex.com/ads',
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
    }
  },
  {
    id: 1004,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'an.yandex.ru',
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
    }
  },
  {
    id: 1005,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'yastatic.net',
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
    }
  }
];

const initializeStorage = async () => {
  const stored = await chrome.storage.local.get(['settings', 'stats']);
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!stored.stats) {
    await chrome.storage.local.set({ stats: DEFAULT_STATS });
  }
};

const applyBlockingRules = async (enabled) => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: BLOCK_RULES.map((rule) => rule.id),
    addRules: enabled ? BLOCK_RULES : []
  });
};

const updateStatsForRequest = async (request) => {
  const host = new URL(request.request.url).hostname;
  const { stats } = await chrome.storage.local.get(['stats']);
  const updatedStats = {
    blockedTotal: (stats?.blockedTotal || 0) + 1,
    cleanupTotal: stats?.cleanupTotal || 0,
    blockedByDomain: {
      ...(stats?.blockedByDomain || {}),
      [host]: (stats?.blockedByDomain?.[host] || 0) + 1
    },
    cleanupByDomain: stats?.cleanupByDomain || {}
  };
  await chrome.storage.local.set({ stats: updatedStats });
};

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  const { settings } = await chrome.storage.local.get(['settings']);
  await applyBlockingRules(settings?.blockRequests ?? true);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const updated = changes.settings.newValue;
    applyBlockingRules(updated?.blockRequests ?? true);
  }
});

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  updateStatsForRequest(info);
});
