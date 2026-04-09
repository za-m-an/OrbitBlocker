const REFRESH_INTERVAL_MS = 6000;

const totalBlockedValue = document.getElementById("totalBlockedValue");
const lastUpdatedValue = document.getElementById("lastUpdatedValue");
const listenerStatusValue = document.getElementById("listenerStatusValue");
const rulesetTableBody = document.getElementById("rulesetTableBody");
const recentSummary = document.getElementById("recentSummary");
const recentRulesetList = document.getElementById("recentRulesetList");
const statusText = document.getElementById("statusText");
const openSettingsButton = document.getElementById("openSettingsButton");
const refreshButton = document.getElementById("refreshButton");
const resetButton = document.getElementById("resetButton");

let refreshTimer = null;
let statusTimer = null;

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatTimestamp(value) {
  if (typeof value !== "number" || value <= 0) {
    return "No data yet";
  }

  return new Date(value).toLocaleString();
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b91c1c" : "#0f766e";

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(() => {
    statusText.textContent = "";
    statusTimer = null;
  }, 1700);
}

function setLoadingState() {
  totalBlockedValue.textContent = "...";
  lastUpdatedValue.textContent = "...";
  listenerStatusValue.textContent = "...";
  refreshButton.disabled = true;
  resetButton.disabled = true;
}

function clearLoadingState() {
  refreshButton.disabled = false;
  resetButton.disabled = false;
}

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function renderRulesetTable(snapshot) {
  rulesetTableBody.innerHTML = "";

  for (const ruleset of snapshot.rulesets) {
    const row = document.createElement("tr");

    row.appendChild(createCell(ruleset.label));
    row.appendChild(createCell(ruleset.enabled ? "Yes" : "No"));
    row.appendChild(
      createCell(
        ruleset.staticRuleCount === null ? "Unknown" : formatNumber(ruleset.staticRuleCount)
      )
    );
    row.appendChild(createCell(formatNumber(ruleset.blockedCount)));

    rulesetTableBody.appendChild(row);
  }

  if (snapshot.totals.blockedByUnknownRuleset > 0) {
    const row = document.createElement("tr");
    row.appendChild(createCell("Unknown ruleset"));
    row.appendChild(createCell("-"));
    row.appendChild(createCell("-"));
    row.appendChild(createCell(formatNumber(snapshot.totals.blockedByUnknownRuleset)));
    rulesetTableBody.appendChild(row);
  }
}

function renderRecentRules(snapshot) {
  const recent = snapshot.recentMatchedRules;
  recentRulesetList.innerHTML = "";

  if (!recent.available) {
    recentSummary.textContent =
      recent.error ||
      "Recent matched-rule queries are not currently available in this browser context.";
    return;
  }

  recentSummary.textContent = `Total matched in last 24h: ${formatNumber(recent.total)}`;

  const entries = Object.entries(recent.byRuleset).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No matched rule events captured in the selected window.";
    recentRulesetList.appendChild(emptyItem);
    return;
  }

  for (const [rulesetId, count] of entries) {
    const item = document.createElement("li");
    item.textContent = `${rulesetId}: ${formatNumber(count)}`;
    recentRulesetList.appendChild(item);
  }
}

function renderSnapshot(snapshot) {
  totalBlockedValue.textContent = formatNumber(snapshot.totals.totalBlockedRequests);
  lastUpdatedValue.textContent = formatTimestamp(snapshot.totals.updatedAt);

  if (snapshot.listener.available) {
    listenerStatusValue.textContent = snapshot.listener.attached ? "Active" : "Available";
  } else {
    listenerStatusValue.textContent = "Unavailable";
  }

  renderRulesetTable(snapshot);
  renderRecentRules(snapshot);
}

async function requestSnapshot(messageType) {
  const response = await chrome.runtime.sendMessage({
    type: messageType
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Diagnostics request failed");
  }

  return response.snapshot;
}

async function refreshSnapshot(showMessage = false) {
  setLoadingState();

  try {
    const snapshot = await requestSnapshot("GET_DIAGNOSTICS_SNAPSHOT");
    renderSnapshot(snapshot);

    if (showMessage) {
      setStatus("Diagnostics refreshed");
    }
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    clearLoadingState();
  }
}

async function resetCounters() {
  setLoadingState();

  try {
    const snapshot = await requestSnapshot("RESET_DIAGNOSTICS_COUNTERS");
    renderSnapshot(snapshot);
    setStatus("Diagnostics counters reset");
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    clearLoadingState();
  }
}

async function openSettingsPage() {
  const settingsUrl = chrome.runtime.getURL("src/options/options.html");

  if (chrome.tabs?.create) {
    try {
      await chrome.tabs.create({ url: settingsUrl });
      return;
    } catch {
      // Fallback below for restricted contexts.
    }
  }

  window.location.href = settingsUrl;
}

openSettingsButton.addEventListener("click", () => {
  openSettingsPage();
});

refreshButton.addEventListener("click", () => {
  refreshSnapshot(true);
});

resetButton.addEventListener("click", () => {
  resetCounters();
});

refreshTimer = setInterval(() => {
  refreshSnapshot(false);
}, REFRESH_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
});

refreshSnapshot(false);