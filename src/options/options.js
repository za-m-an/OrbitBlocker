const DEFAULT_SETTINGS = Object.freeze({
  blockYoutubeNetworkEnabled: true,
  blockGlobalTrackersEnabled: true,
  blockGlobalAdsEnabled: true,
  blockOemGoogleTrackingEnabled: true,
  blockRedirectPopupsEnabled: true,
  blockFlashBannersEnabled: true,
  cleanupUiAdsEnabled: true
});

const coreShieldToggle = document.getElementById("coreShieldToggle");
const youtubeShieldToggle = document.getElementById("youtubeShieldToggle");
const oemGoogleShieldToggle = document.getElementById("oemGoogleShieldToggle");
const visualShieldToggle = document.getElementById("visualShieldToggle");
const adaptiveShieldToggle = document.getElementById("adaptiveShieldToggle");
const openDiagnosticsButton = document.getElementById("openDiagnosticsButton");
const mobileModeText = document.getElementById("mobileModeText");
const statusText = document.getElementById("statusText");

const TOGGLE_GROUPS = Object.freeze([
  {
    element: coreShieldToggle,
    keys: [
      "blockGlobalTrackersEnabled",
      "blockGlobalAdsEnabled",
      "blockRedirectPopupsEnabled"
    ]
  },
  {
    element: youtubeShieldToggle,
    keys: ["blockYoutubeNetworkEnabled", "cleanupUiAdsEnabled"]
  },
  {
    element: oemGoogleShieldToggle,
    keys: ["blockOemGoogleTrackingEnabled"]
  },
  {
    element: visualShieldToggle,
    keys: ["blockFlashBannersEnabled", "blockRedirectPopupsEnabled"]
  },
  {
    element: adaptiveShieldToggle,
    keys: ["blockAutoLearningEnabled"]
  }
]);

let statusTimer = null;

function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b42318" : "#1b7d72";

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(() => {
    statusText.textContent = "";
    statusText.style.color = "#1b7d72";
    statusTimer = null;
  }, 1400);
}

function updateMobileModeText() {
  const isMobileLayout = window.matchMedia("(max-width: 760px)").matches;

  mobileModeText.textContent = isMobileLayout
    ? "Mobile layout active: compact cards and larger touch controls are enabled."
    : "Desktop layout active: full feature cards and expanded settings detail are enabled.";
}

async function openDiagnosticsPage() {
  const diagnosticsUrl = chrome.runtime.getURL("src/diagnostics/diagnostics.html");

  if (chrome.tabs?.create) {
    try {
      await chrome.tabs.create({ url: diagnosticsUrl });
      return;
    } catch {
      // Fallback below for limited mobile contexts.
    }
  }

  window.location.href = diagnosticsUrl;
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  for (const group of TOGGLE_GROUPS) {
    if (!group.element) {
      continue;
    }

    group.element.checked = group.keys.every((key) => Boolean(settings[key]));
  }
}

function wireSettingGroup(toggle, settingKeys) {
  if (!toggle) {
    return;
  }

  toggle.addEventListener("change", async () => {
    const nextValue = toggle.checked;
    const nextSettings = {};

    for (const key of settingKeys) {
      nextSettings[key] = nextValue;
    }

    try {
      await chrome.storage.sync.set(nextSettings);
      await loadSettings();

      showStatus("Settings saved");
    } catch {
      showStatus("Unable to save settings", true);
    }
  });
}

for (const group of TOGGLE_GROUPS) {
  wireSettingGroup(group.element, group.keys);
}

openDiagnosticsButton.addEventListener("click", () => {
  openDiagnosticsPage();
});

window.addEventListener("resize", updateMobileModeText);

updateMobileModeText();
loadSettings();