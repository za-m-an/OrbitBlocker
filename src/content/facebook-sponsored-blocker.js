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
  "div[aria-posinset]",
  "div[role='gridcell']"
].join(",");

const RIGHT_RAIL_SCOPE_SELECTORS = [
  "div[data-pagelet='RightRail']",
  "div[role='complementary']",
  "aside[role='complementary']"
].join(",");

const SPONSORED_MARKER_SELECTORS = [
  "[aria-label='Sponsored']",
  "span[aria-label='Sponsored']",
  "a[aria-label='Sponsored']",
  "a[href*='/ads/about/']",
  "a[href*='about/ads']",
  "a[href*='ad_preferences']",
  "a[href*='why_am_i_seeing_this']",
  "a[href*='/ads/preferences']"
].join(",");

const CARD_CONTAINER_HINT_SELECTORS = [
  "div[role='article']",
  "div[data-pagelet*='FeedUnit']",
  "div[aria-posinset]",
  "div[role='gridcell']",
  "div[data-visualcompletion='ignore-dynamic']"
].join(",");

const SPONSORED_TEXT_REGEX = /\bsponsored\b/i;
const MAX_SCAN_CANDIDATES = 700;

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

function isFacebookOwnedHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  if (!host) {
    return false;
  }

  return (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net") ||
    host === "messenger.com" ||
    host.endsWith(".messenger.com")
  );
}

function parseHttpUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl, window.location.href);

    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hasAdDisclosureLink(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  return Boolean(container.querySelector(SPONSORED_MARKER_SELECTORS));
}

function hasExternalDestinationLink(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  const anchors = container.querySelectorAll("a[href]");
  let inspected = 0;

  for (const anchor of anchors) {
    inspected += 1;

    if (inspected > 40) {
      break;
    }

    const rawHref = anchor.getAttribute("href") || anchor.href;

    if (!rawHref) {
      continue;
    }

    if (rawHref.includes("l.facebook.com/l.php") || rawHref.includes("/l.php?u=")) {
      return true;
    }

    const parsed = parseHttpUrl(rawHref);

    if (!parsed) {
      continue;
    }

    if (!isFacebookOwnedHost(parsed.hostname)) {
      return true;
    }
  }

  return false;
}

function hasMediaCreative(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  return Boolean(container.querySelector("img, video, canvas, picture"));
}

function hasLeadingSponsoredText(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  const text = normalizeText(container.textContent || "").slice(0, 220);

  if (!text) {
    return false;
  }

  if (/^sponsored(?:\b|\s|\u00b7|\.|:)/i.test(text)) {
    return true;
  }

  return SPONSORED_TEXT_REGEX.test(text);
}

function findLikelyCardContainer(node) {
  if (!(node instanceof Element)) {
    return null;
  }

  let current = node;
  let depth = 0;

  while (current && depth < 9) {
    if (current.matches(CARD_CONTAINER_HINT_SELECTORS)) {
      return current;
    }

    if (current.matches(RIGHT_RAIL_SCOPE_SELECTORS)) {
      return current;
    }

    current = current.parentElement;
    depth += 1;
  }

  return node.closest(CARD_CONTAINER_HINT_SELECTORS) || node.closest(RIGHT_RAIL_SCOPE_SELECTORS);
}

function isLikelySponsoredFeedUnit(unit) {
  if (!(unit instanceof Element)) {
    return false;
  }

  if (hasAdDisclosureLink(unit)) {
    return true;
  }

  if (!hasLeadingSponsoredText(unit)) {
    return false;
  }

  if (!(hasExternalDestinationLink(unit) || hasAdDisclosureLink(unit))) {
    return false;
  }

  if (hasMediaCreative(unit)) {
    return true;
  }

  if (unit.closest(RIGHT_RAIL_SCOPE_SELECTORS)) {
    return true;
  }

  return false;
}

function hideSponsoredFeedUnits(root = document) {
  const candidates = queryAllIncludingRoot(root, FEED_CANDIDATE_SELECTORS);
  let scanned = 0;

  for (const candidate of candidates) {
    scanned += 1;

    if (scanned > MAX_SCAN_CANDIDATES) {
      break;
    }

    if (!isLikelySponsoredFeedUnit(candidate)) {
      continue;
    }

    hideElement(candidate);
  }
}

function hideSponsoredByMarkers(root = document) {
  const markers = queryAllIncludingRoot(root, SPONSORED_MARKER_SELECTORS);

  for (const marker of markers) {
    const container = findLikelyCardContainer(marker);

    if (!container) {
      continue;
    }

    if (container.matches(RIGHT_RAIL_SCOPE_SELECTORS)) {
      hideSponsoredFeedUnits(container);
      continue;
    }

    if (isLikelySponsoredFeedUnit(container)) {
      hideElement(container);
    }
  }
}

function hideSponsoredRightRail(root = document) {
  const scopes = queryAllIncludingRoot(root, RIGHT_RAIL_SCOPE_SELECTORS);

  for (const scope of scopes) {
    const blocks = queryAllIncludingRoot(scope, CARD_CONTAINER_HINT_SELECTORS);
    let scanned = 0;

    for (const block of blocks) {
      scanned += 1;

      if (scanned > 180) {
        break;
      }

      if (isLikelySponsoredFeedUnit(block)) {
        hideElement(block);
      }
    }

    hideSponsoredByMarkers(scope);
  }
}

function runFacebookCleanup(root = document) {
  hideSponsoredByMarkers(root);
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
