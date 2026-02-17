const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "block",
  detectionLevel: "balanced",
  trustedHosts: []
};

const enabledInput = document.getElementById("enabled");
const modeSelect = document.getElementById("mode");
const detectionLevelSelect = document.getElementById("detectionLevel");
const trustCurrentButton = document.getElementById("trustCurrent");
const trustedHostsList = document.getElementById("trustedHosts");
const statusNode = document.getElementById("status");

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase();
}

function normalizeDetectionLevel(value) {
  if (value === "strict" || value === "lenient") {
    return value;
  }
  return "balanced";
}

function setStatus(text) {
  statusNode.textContent = text || "";
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve({
        enabled: Boolean(result.enabled),
        mode: result.mode === "warn" ? "warn" : "block",
        detectionLevel: normalizeDetectionLevel(result.detectionLevel),
        trustedHosts: Array.isArray(result.trustedHosts)
          ? result.trustedHosts.map((entry) => normalizeHost(entry)).filter(Boolean)
          : []
      });
    });
  });
}

function saveSettings(nextSettings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(nextSettings, resolve);
  });
}

function removeHost(hostname) {
  getSettings().then((settings) => {
    const nextTrustedHosts = settings.trustedHosts.filter((host) => host !== hostname);
    saveSettings({ trustedHosts: nextTrustedHosts }).then(render);
  });
}

function renderTrustedHosts(hosts) {
  trustedHostsList.innerHTML = "";

  if (!hosts.length) {
    const li = document.createElement("li");
    li.textContent = "No trusted sites";
    trustedHostsList.appendChild(li);
    return;
  }

  hosts.forEach((host) => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = host;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeHost(host));

    li.appendChild(label);
    li.appendChild(removeButton);
    trustedHostsList.appendChild(li);
  });
}

function getCurrentTabHost() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        resolve("");
        return;
      }

      try {
        resolve(normalizeHost(new URL(tab.url).hostname));
      } catch (_) {
        resolve("");
      }
    });
  });
}

async function addCurrentSiteToTrusted() {
  const host = await getCurrentTabHost();
  if (!host) {
    setStatus("Unable to detect current site.");
    return;
  }

  const settings = await getSettings();
  if (settings.trustedHosts.includes(host)) {
    setStatus(`${host} is already trusted.`);
    return;
  }

  const nextTrustedHosts = [...settings.trustedHosts, host];
  await saveSettings({ trustedHosts: nextTrustedHosts });
  setStatus(`Added ${host} to trusted sites.`);
  render();
}

async function render() {
  const settings = await getSettings();
  enabledInput.checked = settings.enabled;
  modeSelect.value = settings.mode;
  detectionLevelSelect.value = settings.detectionLevel;
  renderTrustedHosts(settings.trustedHosts);
}

enabledInput.addEventListener("change", async () => {
  await saveSettings({ enabled: enabledInput.checked });
  setStatus("Updated extension status.");
});

modeSelect.addEventListener("change", async () => {
  await saveSettings({ mode: modeSelect.value });
  setStatus("Updated gate behavior.");
});

detectionLevelSelect.addEventListener("change", async () => {
  await saveSettings({ detectionLevel: detectionLevelSelect.value });
  setStatus("Updated detection sensitivity.");
});

trustCurrentButton.addEventListener("click", addCurrentSiteToTrusted);

render();
