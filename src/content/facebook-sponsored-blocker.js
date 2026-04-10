(() => {
if (globalThis.__znBlockerFacebookSponsoredLoaded) {
  return;
}

globalThis.__znBlockerFacebookSponsoredLoaded = true;

const DEFAULT_SETTINGS = Object.freeze({
  blockFacebookShieldEnabled: true
});

const FEED_CANDIDATE_SELECTORS = [
  "div[role='feed'] > div",
  "div[data-pagelet*='FeedUnit']",
  "div[role='article']",
  "div[aria-posinset]"
].join(",");

const SPONSORED_MARKER_SELECTORS = [
  "span[aria-label='Sponsored']",
  "a[aria-label='Sponsored']",
  "a[href*='/ads/']",
  "a[href*='about/ads']",
  "a[href*='adpreferences']"
].join(",");

const RIGHT_RAIL_SPONSORED_SELECTORS = [
  "div[data-pagelet='RightRail'] a[href*='/ads/']",
  "div[data-pagelet='RightRail'] span[aria-label='Sponsored']",
  "div[data-pagelet='Stories'] a[href*='/ads/']"
].join(",");

const SPONSORED_TEXT_REGEX = /\bsponsored\b/i;

let shieldEnabled = true;
let observer = null;
let queued = false;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hideElement(element) {
  if (!(element instanceof Element)) {
    return;
  }

  element.style.setProperty("display", "none", "important");
  element.setAttribute("data-zn-blocker-facebook-hidden", "true");
}

function queryAllIncludingRoot(root, selector) {
  const nodes = [];

  if (root instanceof Element && root.matches(selector)) {
    nodes.push(root);
  }

  if (!(root instanceof Element) && !(root instanceof Document)) {
    return nodes;
  }

  nodes.push(...root.querySelectorAll(selector));
  return nodes;
}

function isLikelySponsoredFeedUnit(unit) {
  if (!(unit instanceof Element)) {
    return false;
  }

  if (unit.querySelector(SPONSORED_MARKER_SELECTORS)) {
    return true;
  }

  const text = normalizeText(unit.textContent || "");

  if (!text || !SPONSORED_TEXT_REGEX.test(text)) {
    return false;
  }

  if (unit.querySelector("a[href*='/ads/'], a[href*='about/ads']")) {
    return true;
  }

  const shortText = text.slice(0, 120);
  if (/^\s*sponsored(?:\b|\s|\u00b7|\.|:)/i.test(shortText)) {
    return true;
  }

  return false;
}

function hideSponsoredFeedUnits(root = document) {
  const candidates = queryAllIncludingRoot(root, FEED_CANDIDATE_SELECTORS);

  for (const candidate of candidates) {
    if (!isLikelySponsoredFeedUnit(candidate)) {
      continue;
    }

    hideElement(candidate);
  }
}

function hideSponsoredRightRail(root = document) {
  const candidates = queryAllIncludingRoot(root, RIGHT_RAIL_SPONSORED_SELECTORS);

  for (const candidate of candidates) {
    const container = candidate.closest("div[data-pagelet='RightRail'], div[role='complementary']");

    if (container) {
      hideElement(container);
      continue;
    }

    hideElement(candidate);
  }
}

function runFacebookCleanup(root = document) {
  hideSponsoredFeedUnits(root);
  hideSponsoredRightRail(root);
}

function queueCleanup() {
  if (queued || !shieldEnabled) {
    return;
  }

  queued = true;

  queueMicrotask(() => {
    queued = false;
    runFacebookCleanup(document);
  });
}

function startObserver() {
  if (observer || !document.documentElement) {
    return;
  }

  observer = new MutationObserver((mutations) => {
    if (!shieldEnabled) {
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }

        runFacebookCleanup(node);
      }
    }

    queueCleanup();
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

function applyShieldState(enabled) {
  shieldEnabled = Boolean(enabled);

  if (shieldEnabled) {
    runFacebookCleanup(document);
    startObserver();
    return;
  }

  stopObserver();
}

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  applyShieldState(Boolean(settings.blockFacebookShieldEnabled));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.blockFacebookShieldEnabled) {
    return;
  }

  applyShieldState(Boolean(changes.blockFacebookShieldEnabled.newValue));
});
})();
