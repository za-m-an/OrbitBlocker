(() => {
if (globalThis.__znBlockerAutoLearnScannerLoaded) {
  return;
}

globalThis.__znBlockerAutoLearnScannerLoaded = true;

const DEFAULT_SETTINGS = Object.freeze({
  blockAutoLearningEnabled: true
});

const URL_ATTR_SELECTORS = [
  "a[href]",
  "area[href]",
  "iframe[src]",
  "script[src]",
  "img[src]",
  "source[src]",
  "video[src]",
  "audio[src]",
  "link[href]",
  "[data-href]",
  "[data-url]",
  "[data-destination]"
].join(",");

const URL_ATTR_KEYS = ["href", "src", "data-href", "data-url", "data-destination"];
const MAX_URLS_PER_SCAN = 220;
const RESCAN_DELAY_MS = 1300;

let scanningEnabled = true;
let scanTimer = null;
let observer = null;

function parseHttpUrl(rawUrl, baseUrl = window.location.href) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl, baseUrl);

    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function collectCandidateUrls(root = document) {
  if (!scanningEnabled) {
    return [];
  }

  const candidates = new Set();
  const elements = [];

  if (root instanceof Element && root.matches(URL_ATTR_SELECTORS)) {
    elements.push(root);
  }

  if (root instanceof Document || root instanceof Element) {
    elements.push(...root.querySelectorAll(URL_ATTR_SELECTORS));
  }

  for (const element of elements) {
    if (candidates.size >= MAX_URLS_PER_SCAN) {
      break;
    }

    for (const key of URL_ATTR_KEYS) {
      const rawValue = element.getAttribute?.(key);
      const normalized = parseHttpUrl(rawValue);

      if (!normalized) {
        continue;
      }

      candidates.add(normalized);

      if (candidates.size >= MAX_URLS_PER_SCAN) {
        break;
      }
    }
  }

  return [...candidates];
}

function sendCandidates(urls) {
  if (!scanningEnabled || !Array.isArray(urls) || urls.length === 0) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "AUTO_LEARN_PAGE_URLS",
    pageUrl: window.location.href,
    urls
  }).catch(() => {
    // Ignore errors when service worker is restarting.
  });
}

function runScan(root = document) {
  const urls = collectCandidateUrls(root);
  sendCandidates(urls);
}

function queueRescan() {
  if (!scanningEnabled || scanTimer) {
    return;
  }

  scanTimer = setTimeout(() => {
    scanTimer = null;
    runScan(document);
  }, RESCAN_DELAY_MS);
}

function startObserver() {
  if (observer || !document.documentElement) {
    return;
  }

  observer = new MutationObserver((mutations) => {
    if (!scanningEnabled) {
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }

        runScan(node);
      }
    }

    queueRescan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function stopObserver() {
  if (!observer) {
    return;
  }

  observer.disconnect();
  observer = null;
}

function applyScanningState(enabled) {
  scanningEnabled = Boolean(enabled);

  if (!scanningEnabled) {
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }

    stopObserver();
    return;
  }

  runScan(document);
  queueRescan();
  startObserver();
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  applyScanningState(Boolean(settings.blockAutoLearningEnabled));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.blockAutoLearningEnabled) {
    return;
  }

  applyScanningState(Boolean(changes.blockAutoLearningEnabled.newValue));
});
})();
