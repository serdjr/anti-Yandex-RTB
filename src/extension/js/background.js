chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const blockedUrls = [
      '*://*.yandex.ru/ads/*',
      '*://*.yandex.net/ads/*',
      '*://*.yandex.com/ads/*',
      '*://an.yandex.ru/*',
      '*://yastatic.net/*'
    ];
    for (const urlPattern of blockedUrls) {
      if (details.url.match(urlPattern)) {
        return { cancel: true };
      }
    }
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);