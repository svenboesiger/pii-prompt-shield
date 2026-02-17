(function attachGatekeeper() {
  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: "block",
    detectionLevel: "balanced",
    trustedHosts: []
  };

  const KNOWN_LLM_HOST_PATTERNS = [
    "chat.openai.com",
    "chatgpt.com",
    "claude.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
    "perplexity.ai",
    "poe.com",
    "you.com",
    "character.ai",
    "meta.ai",
    "chat.mistral.ai",
    "grok.com"
  ];

  const LLM_PATH_RULES = [
    { host: "x.com", regex: /^\/i\/grok\b/i },
    { host: "www.x.com", regex: /^\/i\/grok\b/i }
  ];

  const PROMPT_HINT_REGEX = /\b(prompt|message|chat|ask|question|assistant|composer)\b/i;
  const LLM_TITLE_HINT_REGEX = /\b(chatgpt|claude|gemini|copilot|perplexity|grok|assistant|ai chat|llm)\b/i;

  const SEND_BUTTON_HINT_REGEX = /\b(send|submit|ask|message|prompt|chat|up-arrow)\b/i;
  const SEND_BUTTON_SELECTORS = [
    "button[type='submit']",
    "input[type='submit']",
    "button[data-testid='send-button']",
    "button[data-testid*='send']",
    "button[aria-label*='Send' i]",
    "button[aria-label*='Submit' i]",
    "[role='button'][aria-label*='Send' i]",
    "button[class*='send' i]"
  ];

  let settings = { ...DEFAULT_SETTINGS };
  let skipNextGuard = false;
  let modalRoot = null;

  const ICON_SHAPES = {
    shield: [
      { tag: "path", attrs: { d: "M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" } },
      { tag: "path", attrs: { d: "M9.5 12.5l2 2 3-3" } }
    ],
    alert: [
      { tag: "circle", attrs: { cx: "12", cy: "12", r: "9" } },
      { tag: "path", attrs: { d: "M12 8v5" } },
      { tag: "path", attrs: { d: "M12 16.5h.01" } }
    ],
    close: [
      { tag: "path", attrs: { d: "M6 6l12 12" } },
      { tag: "path", attrs: { d: "M18 6L6 18" } }
    ],
    send: [
      { tag: "path", attrs: { d: "M4 12l16-8-4 8 4 8-16-8z" } },
      { tag: "path", attrs: { d: "M16 12H8" } }
    ],
    redact: [
      { tag: "path", attrs: { d: "M4 20h4l10-10-4-4L4 16v4z" } },
      { tag: "path", attrs: { d: "M13 7l4 4" } }
    ],
    trust: [
      { tag: "path", attrs: { d: "M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" } },
      { tag: "path", attrs: { d: "M9.5 12.5l2 2 3-3" } }
    ],
    user: [
      { tag: "circle", attrs: { cx: "12", cy: "8", r: "3.5" } },
      { tag: "path", attrs: { d: "M5 19c1.8-3 4.2-4.5 7-4.5s5.2 1.5 7 4.5" } }
    ],
    email: [
      { tag: "rect", attrs: { x: "3", y: "6", width: "18", height: "12", rx: "2" } },
      { tag: "path", attrs: { d: "M3 8l9 6 9-6" } }
    ],
    phone: [
      { tag: "path", attrs: { d: "M6.8 4.5h3L11 8l-2 1.3c1.6 2.8 3.9 5.1 6.7 6.7L17 14l3.5 1.2v3c0 1-.8 1.8-1.8 1.8C10.8 20 4 13.2 4 5.3 4 4.3 4.8 3.5 5.8 3.5z" } }
    ],
    calendar: [
      { tag: "rect", attrs: { x: "4", y: "5", width: "16", height: "15", rx: "2" } },
      { tag: "path", attrs: { d: "M8 3v4M16 3v4M4 10h16" } }
    ],
    card: [
      { tag: "rect", attrs: { x: "3", y: "6", width: "18", height: "12", rx: "2" } },
      { tag: "path", attrs: { d: "M3 10h18M7 15h3" } }
    ],
    key: [
      { tag: "circle", attrs: { cx: "8.5", cy: "12", r: "3.5" } },
      { tag: "path", attrs: { d: "M12 12h8M17 12v2M19 12v2" } }
    ],
    id: [
      { tag: "rect", attrs: { x: "3", y: "5", width: "18", height: "14", rx: "2" } },
      { tag: "circle", attrs: { cx: "8", cy: "12", r: "2" } },
      { tag: "path", attrs: { d: "M13 10h5M13 13h5M13 16h4" } }
    ],
    location: [
      { tag: "path", attrs: { d: "M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" } },
      { tag: "circle", attrs: { cx: "12", cy: "11", r: "2.2" } }
    ],
    number: [
      { tag: "path", attrs: { d: "M9 5L7 19M17 5l-2 14M4 9h16M3 15h16" } }
    ]
  };

  function normalizeHost(host) {
    return String(host || "").trim().toLowerCase();
  }

  function normalizeDetectionLevel(value) {
    if (value === "strict" || value === "lenient") {
      return value;
    }
    return "balanced";
  }

  function isTrustedHost(hostname) {
    const host = normalizeHost(hostname);
    return settings.trustedHosts.some((trustedHost) => {
      const trusted = normalizeHost(trustedHost);
      return host === trusted || host.endsWith(`.${trusted}`);
    });
  }

  function isKnownLLMHost(hostname) {
    const host = normalizeHost(hostname);
    return KNOWN_LLM_HOST_PATTERNS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
  }

  function isKnownLLMPath(hostname, pathname) {
    const host = normalizeHost(hostname);
    return LLM_PATH_RULES.some((rule) => rule.host === host && rule.regex.test(pathname || ""));
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function isDisabled(element) {
    if (!(element instanceof HTMLElement)) {
      return true;
    }

    const disabledProp = "disabled" in element && element.disabled;
    const ariaDisabled = element.getAttribute("aria-disabled") === "true";
    return Boolean(disabledProp || ariaDisabled);
  }

  function getElementHints(element) {
    if (!element || !(element instanceof Element)) {
      return "";
    }

    return [
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("name"),
      element.id,
      element.className,
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function isPromptInputCandidate(element) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      return false;
    }

    if (element instanceof HTMLTextAreaElement) {
      return true;
    }

    if (element instanceof HTMLInputElement) {
      const type = (element.type || "text").toLowerCase();
      if (type === "text" || type === "search") {
        return PROMPT_HINT_REGEX.test(getElementHints(element));
      }
      return false;
    }

    if (element.isContentEditable) {
      const hints = getElementHints(element);
      if (PROMPT_HINT_REGEX.test(hints)) {
        return true;
      }

      const role = (element.getAttribute("role") || "").toLowerCase();
      return role === "textbox" || element.getAttribute("aria-multiline") === "true";
    }

    return false;
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        settings = {
          enabled: Boolean(result.enabled),
          mode: result.mode === "warn" ? "warn" : "block",
          detectionLevel: normalizeDetectionLevel(result.detectionLevel),
          trustedHosts: Array.isArray(result.trustedHosts)
            ? result.trustedHosts.map((item) => normalizeHost(item)).filter(Boolean)
            : []
        };
        resolve(settings);
      });
    });
  }

  function findEditableValue(editable) {
    if (!editable) {
      return "";
    }

    if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
      return editable.value || "";
    }

    return editable.innerText || editable.textContent || "";
  }

  function setEditableValue(editable, nextValue) {
    if (!editable) {
      return;
    }

    if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
      editable.value = nextValue;
      editable.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (editable.isContentEditable) {
      editable.textContent = nextValue;
      editable.dispatchEvent(new InputEvent("input", { bubbles: true, data: nextValue }));
    }
  }

  function scorePromptCandidate(candidate, eventTarget) {
    let score = 0;
    const valueLength = findEditableValue(candidate).trim().length;
    score += Math.min(valueLength, 300);

    if (candidate === eventTarget) {
      score += 120;
    }

    if (candidate === document.activeElement) {
      score += 80;
    }

    const hints = getElementHints(candidate);
    if (PROMPT_HINT_REGEX.test(hints)) {
      score += 40;
    }

    if (candidate.closest("form")) {
      score += 15;
    }

    if (candidate.isContentEditable) {
      score += 10;
    }

    return score;
  }

  function uniqueElements(elements) {
    const seen = new Set();
    return elements.filter((element) => {
      if (!element || seen.has(element)) {
        return false;
      }
      seen.add(element);
      return true;
    });
  }

  function findBestPromptInput(scopeNode, eventTarget) {
    const scope = scopeNode instanceof Element ? scopeNode : document;

    const baseCandidates = [
      ...scope.querySelectorAll("textarea"),
      ...scope.querySelectorAll("input[type='text'], input[type='search']"),
      ...scope.querySelectorAll("[contenteditable='true']")
    ];

    const candidates = uniqueElements([
      eventTarget,
      document.activeElement,
      ...baseCandidates
    ]).filter(isPromptInputCandidate);

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => scorePromptCandidate(b, eventTarget) - scorePromptCandidate(a, eventTarget));
    return candidates[0];
  }

  function isSendButton(button) {
    if (!(button instanceof HTMLElement) || !isVisible(button) || isDisabled(button)) {
      return false;
    }

    if (SEND_BUTTON_SELECTORS.some((selector) => {
      try {
        return button.matches(selector);
      } catch (_) {
        return false;
      }
    })) {
      return true;
    }

    return SEND_BUTTON_HINT_REGEX.test(getElementHints(button));
  }

  function findLikelySendButton(promptInput) {
    const scope = promptInput && promptInput.closest
      ? promptInput.closest("form, [data-testid*='composer'], [class*='composer'], main")
      : null;

    const queryRoot = scope || document;
    const buttons = [
      ...queryRoot.querySelectorAll("button, [role='button'], input[type='submit']")
    ].filter(isSendButton);

    if (!buttons.length) {
      return null;
    }

    buttons.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const hintsA = getElementHints(a);
      const hintsB = getElementHints(b);

      if (/\bsend\b/i.test(hintsA)) {
        scoreA += 50;
      }
      if (/\bsend\b/i.test(hintsB)) {
        scoreB += 50;
      }

      if (promptInput && promptInput.closest("form") && a.closest("form") === promptInput.closest("form")) {
        scoreA += 30;
      }
      if (promptInput && promptInput.closest("form") && b.closest("form") === promptInput.closest("form")) {
        scoreB += 30;
      }

      return scoreB - scoreA;
    });

    return buttons[0];
  }

  function triggerSendForPrompt(promptInput) {
    if (!promptInput) {
      return false;
    }

    const form = promptInput.closest("form");
    if (form) {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
      return true;
    }

    const button = findLikelySendButton(promptInput);
    if (button) {
      button.click();
      return true;
    }

    return false;
  }

  function stopEvent(event) {
    if (!event) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function summarizeFindings(findings) {
    const items = findings.slice(0, 6).map((finding) => `${finding.label}: ${finding.match}`);
    if (findings.length > 6) {
      items.push(`+${findings.length - 6} more`);
    }
    return items.join("\n");
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function redactPromptWithFindings(promptText, findings) {
    let output = String(promptText || "");

    findings.forEach((finding) => {
      const source = finding && finding.rawMatch ? finding.rawMatch : finding.match;
      if (!source) {
        return;
      }

      const replaceRegex = new RegExp(escapeRegExp(source), "g");
      output = output.replace(replaceRegex, `[REDACTED_${finding.type.toUpperCase()}]`);
    });

    return output;
  }

  function iconForFindingType(type) {
    if (type === "email") return "email";
    if (type === "phone") return "phone";
    if (type === "dob") return "calendar";
    if (type === "credit_card" || type === "bank_account") return "card";
    if (type === "api_key") return "key";
    if (type === "national_id" || type === "ssn") return "id";
    if (type === "address") return "location";
    if (type === "age") return "number";
    return "user";
  }

  function createIcon(name, color, size) {
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", String(size || 16));
    icon.setAttribute("height", String(size || 16));
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", color || "#dbe8ff");
    icon.setAttribute("stroke-width", "1.8");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.style.flexShrink = "0";

    const shapes = ICON_SHAPES[name] || ICON_SHAPES.alert;
    shapes.forEach((shape) => {
      const node = document.createElementNS(ns, shape.tag);
      Object.entries(shape.attrs).forEach(([key, value]) => {
        node.setAttribute(key, String(value));
      });
      icon.appendChild(node);
    });

    return icon;
  }

  function runBypassingOnce(action) {
    if (!action) {
      return;
    }

    skipNextGuard = true;
    setTimeout(() => {
      skipNextGuard = false;
    }, 900);

    action();
  }

  function cleanupModal() {
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
  }

  function createModal(result, onSendAnyway, onRedact, onTrustSite) {
    cleanupModal();

    modalRoot = document.createElement("div");
    modalRoot.setAttribute("id", "llm-privacy-gate-modal");
    modalRoot.style.position = "fixed";
    modalRoot.style.inset = "0";
    modalRoot.style.background = "rgba(0,0,0,0.45)";
    modalRoot.style.zIndex = "2147483647";
    modalRoot.style.display = "flex";
    modalRoot.style.alignItems = "center";
    modalRoot.style.justifyContent = "center";
    modalRoot.style.backdropFilter = "blur(1px)";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 560px)";
    card.style.maxHeight = "80vh";
    card.style.overflow = "auto";
    card.style.background = "linear-gradient(180deg, #0f1729 0%, #0b1221 100%)";
    card.style.color = "#ffffff";
    card.style.border = "1px solid #2a3a58";
    card.style.borderRadius = "14px";
    card.style.padding = "18px";
    card.style.boxShadow = "0 20px 42px rgba(5, 12, 24, 0.48)";
    card.style.fontFamily = "ui-sans-serif, system-ui, -apple-system";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";
    titleRow.style.gap = "10px";
    titleRow.style.margin = "0 0 8px";
    titleRow.appendChild(createIcon("shield", "#93b9ff", 20));

    const title = document.createElement("h3");
    title.textContent = "Potential private information detected";
    title.style.margin = "0";

    titleRow.appendChild(title);

    const metaRow = document.createElement("div");
    metaRow.style.display = "flex";
    metaRow.style.alignItems = "center";
    metaRow.style.gap = "8px";
    metaRow.style.margin = "0 0 8px";

    const meta = document.createElement("p");
    meta.textContent = `Score ${result.meta.totalScore} (threshold ${result.meta.threshold}, ${result.meta.detectionLevel} mode)`;
    meta.style.margin = "0";
    meta.style.opacity = "0.9";

    metaRow.appendChild(createIcon("alert", "#7ed2ff", 16));
    metaRow.appendChild(meta);

    const desc = document.createElement("p");
    desc.textContent = "Review these findings before sending your prompt.";
    desc.style.margin = "0 0 12px";
    desc.style.opacity = "0.88";

    const findingsBox = document.createElement("pre");
    findingsBox.textContent = summarizeFindings(result.findings);
    findingsBox.style.background = "#151a22";
    findingsBox.style.border = "1px solid #313847";
    findingsBox.style.borderRadius = "8px";
    findingsBox.style.padding = "10px";
    findingsBox.style.whiteSpace = "pre-wrap";
    findingsBox.style.wordBreak = "break-word";
    findingsBox.style.margin = "0 0 12px";

    const redactSelections = new Set(result.findings.map((_, index) => index));
    const redactList = document.createElement("div");
    redactList.style.display = "grid";
    redactList.style.gap = "6px";
    redactList.style.margin = "0 0 12px";
    redactList.style.padding = "10px";
    redactList.style.background = "#101725";
    redactList.style.border = "1px solid #2d3950";
    redactList.style.borderRadius = "8px";

    const redactLabel = document.createElement("p");
    redactLabel.textContent = "Redaction suggestions (select what to mask):";
    redactLabel.style.margin = "0 0 6px";
    redactLabel.style.opacity = "0.9";
    redactLabel.style.display = "flex";
    redactLabel.style.alignItems = "center";
    redactLabel.style.gap = "8px";
    redactLabel.prepend(createIcon("redact", "#90c2ff", 15));
    redactList.appendChild(redactLabel);

    result.findings.forEach((finding, index) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.cursor = "pointer";
      row.style.padding = "4px 0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.style.accentColor = "#5f9dff";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          redactSelections.add(index);
        } else {
          redactSelections.delete(index);
        }
      });

      const text = document.createElement("span");
      text.textContent = `${finding.label}: ${finding.match}`;
      text.style.fontSize = "14px";
      text.style.lineHeight = "1.3";

      row.appendChild(createIcon(iconForFindingType(finding.type), "#aac8ff", 14));
      row.appendChild(checkbox);
      row.appendChild(text);
      redactList.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "8px";

    function button(label, styleType, iconName, onClick) {
      const styles = {
        normal: {
          border: "1px solid #4d5970",
          background: "#1a2130",
          icon: "#d8e5ff"
        },
        accent: {
          border: "1px solid #4e72b8",
          background: "#22365c",
          icon: "#d6e7ff"
        },
        danger: {
          border: "1px solid #ff7777",
          background: "#3a1212",
          icon: "#ffd9d9"
        }
      };

      const palette = styles[styleType] || styles.normal;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.gap = "7px";
      btn.style.borderRadius = "8px";
      btn.style.padding = "8px 10px";
      btn.style.border = palette.border;
      btn.style.background = palette.background;
      btn.style.color = "#ffffff";
      btn.style.cursor = "pointer";
      if (iconName) {
        btn.appendChild(createIcon(iconName, palette.icon, 14));
      }
      const btnText = document.createElement("span");
      btnText.textContent = label;
      btn.appendChild(btnText);
      btn.addEventListener("click", onClick);
      return btn;
    }

    actions.appendChild(button("Cancel", "normal", "close", cleanupModal));

    if (onRedact) {
      actions.appendChild(button("Redact Selected", "accent", "redact", () => {
        const selectedFindings = result.findings.filter((_, index) => redactSelections.has(index));
        onRedact(selectedFindings);
        cleanupModal();
      }));
    }

    if (onTrustSite) {
      actions.appendChild(button("Trust This Site", "normal", "trust", () => {
        onTrustSite();
        cleanupModal();
      }));
    }

    if (onSendAnyway) {
      actions.appendChild(button("Send Anyway Once", "danger", "send", () => {
        cleanupModal();
        onSendAnyway();
      }));
    }

    card.appendChild(titleRow);
    card.appendChild(metaRow);
    card.appendChild(desc);
    card.appendChild(findingsBox);
    card.appendChild(redactList);
    card.appendChild(actions);
    modalRoot.appendChild(card);

    modalRoot.addEventListener("click", (event) => {
      if (event.target === modalRoot) {
        cleanupModal();
      }
    });

    document.documentElement.appendChild(modalRoot);
  }

  async function trustCurrentHost() {
    const host = normalizeHost(window.location.hostname);
    if (!host || isTrustedHost(host)) {
      return;
    }

    const nextTrustedHosts = [...settings.trustedHosts, host];
    await new Promise((resolve) => {
      chrome.storage.sync.set({ trustedHosts: nextTrustedHosts }, resolve);
    });

    settings.trustedHosts = nextTrustedHosts;
  }

  function isLikelyLLMPage() {
    const host = normalizeHost(window.location.hostname);
    const path = window.location.pathname || "";

    if (isKnownLLMHost(host) || isKnownLLMPath(host, path)) {
      return true;
    }

    const hasPromptInput = !!findBestPromptInput(document, document.activeElement);
    if (!hasPromptInput) {
      return false;
    }

    const headerText = [
      document.title,
      document.querySelector("h1, h2") ? document.querySelector("h1, h2").textContent : ""
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return LLM_TITLE_HINT_REGEX.test(headerText);
  }

  function shouldCheckPrompt() {
    if (!settings.enabled) {
      return false;
    }

    const host = normalizeHost(window.location.hostname);
    if (isTrustedHost(host)) {
      return false;
    }

    return isLikelyLLMPage();
  }

  function guardAttempt(event, promptInput, resumeAction) {
    if (modalRoot) {
      stopEvent(event);
      return;
    }

    if (skipNextGuard) {
      return;
    }

    if (!promptInput || !shouldCheckPrompt()) {
      return;
    }

    const promptText = findEditableValue(promptInput).trim();
    if (!promptText) {
      return;
    }

    const detector = window.LLMPrivacyDetector;
    if (!detector || typeof detector.detectSensitiveInfo !== "function") {
      return;
    }

    const result = detector.detectSensitiveInfo(promptText, {
      detectionLevel: settings.detectionLevel
    });

    if (!result.isSensitive) {
      return;
    }

    if (settings.mode === "warn") {
      const proceed = window.confirm(
        `Potential private information was detected:\n\n${summarizeFindings(result.findings)}\n\nScore ${result.meta.totalScore} (threshold ${result.meta.threshold}).\n\nSend anyway?`
      );

      if (!proceed) {
        stopEvent(event);
      }

      return;
    }

    stopEvent(event);

    createModal(
      result,
      resumeAction
        ? () => {
            runBypassingOnce(resumeAction);
          }
        : null,
      (selectedFindings) => {
        if (!Array.isArray(selectedFindings) || !selectedFindings.length) {
          return;
        }
        const nextText = redactPromptWithFindings(findEditableValue(promptInput), selectedFindings);
        setEditableValue(promptInput, nextText);
      },
      () => {
        trustCurrentHost();
      }
    );
  }

  function handleSubmit(event) {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) {
      return;
    }

    const promptInput = findBestPromptInput(form, event.submitter || document.activeElement)
      || findBestPromptInput(document, event.submitter || document.activeElement);

    guardAttempt(event, promptInput, () => {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
    });
  }

  function handleClick(event) {
    if (modalRoot && event.target instanceof Node && modalRoot.contains(event.target)) {
      return;
    }

    const button = event.target instanceof Element
      ? event.target.closest("button, [role='button'], input[type='submit']")
      : null;

    if (!button || !isSendButton(button)) {
      return;
    }

    const form = button.closest("form");
    const promptInput = findBestPromptInput(form || document, document.activeElement)
      || findBestPromptInput(document, document.activeElement);

    guardAttempt(event, promptInput, () => {
      if (!triggerSendForPrompt(promptInput)) {
        button.click();
      }
    });
  }

  function handleEnterKey(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const isPromptInput =
      target instanceof HTMLTextAreaElement
      || target instanceof HTMLInputElement
      || target.isContentEditable;

    if (!isPromptInput) {
      return;
    }

    guardAttempt(event, target, () => {
      triggerSendForPrompt(target);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes.enabled || changes.mode || changes.trustedHosts || changes.detectionLevel) {
      loadSettings();
    }
  });

  loadSettings();
  document.addEventListener("submit", handleSubmit, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleEnterKey, true);
})();
