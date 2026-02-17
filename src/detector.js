(function attachDetector(global) {
  const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const PHONE_REGEX = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
  const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
  const ADDRESS_REGEX =
    /\b\d{1,5}\s+[A-Za-z0-9.\s]{3,}\s(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/gi;
  const ADDRESS_DE_REGEX =
    /\b(?:[\p{L}][\p{L}0-9.-]{1,40}(?:stra(?:\u00dfe|sse)|str\.)|[\p{L}][\p{L}0-9.\-\s]{1,40}\s(?:Weg|Platz|Allee|Gasse|Ring|Ufer))\s+\d{1,4}[A-Za-z]?\b/giu;

  const NAME_DIRECT_CONTEXT_REGEX =
    /\b(?:my name is|this is|mein name ist|das ist)\s+([\p{L}][\p{L}'-]{1,30}(?:\s+[\p{L}][\p{L}'-]{1,30}){0,2})\b/giu;

  const NAME_SELF_INTRO_REGEX =
    /\b(?:i am|i'm|ich bin|ich hei(?:\u00dfe|sse))\s+([\p{L}][\p{L}'-]{1,30}\s+[\p{L}][\p{L}'-]{1,30}(?:\s+[\p{L}][\p{L}'-]{1,30})?)\b/giu;

  const AGE_CONTEXT_REGEX =
    /\b(?:my age is|age\s*[:=]|mein alter ist|alter\s*[:=])\s*(\d{1,3})\b|\b(?:i am|i'm|ich bin)\s*(\d{1,3})\s*(?:years?\s*old|yo|jahre?\s*alt)\b/gi;

  const DOB_CONTEXT_REGEX =
    /\b(?:dob|date of birth|born on|geburtsdatum|geboren am)\b[^\n\r]{0,24}?\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/gi;

  const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
  const PHONE_DE_REGEX = /(?:\+49|0)(?:[\s\-./()]?\d){6,14}\b/g;

  const OPENAI_KEY_REGEX = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
  const ANTHROPIC_KEY_REGEX = /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g;
  const GITHUB_PAT_REGEX = /\bghp_[A-Za-z0-9]{30,}\b/g;
  const GOOGLE_KEY_REGEX = /\bAIza[0-9A-Za-z_-]{35}\b/g;
  const AWS_ACCESS_KEY_REGEX = /\bAKIA[0-9A-Z]{16}\b/g;
  const STEUER_ID_CONTEXT_REGEX =
    /\b(?:steuer(?:-|\s)?id|steueridentifikationsnummer)\b[^\n\r]{0,20}?\b((?:\d[\s-]?){11})\b/gi;
  const IBAN_DE_REGEX = /\bDE(?:\d[\s-]?){20}\b/gi;

  const STOPWORD_NAME_TOKENS = new Set([
    "a",
    "an",
    "and",
    "the",
    "or",
    "developer",
    "engineer",
    "student",
    "assistant",
    "manager",
    "founder",
    "intern"
  ]);

  const SCORE_BY_TYPE = {
    name: 1,
    age: 1,
    phone: 3,
    email: 4,
    address: 4,
    dob: 4,
    ssn: 5,
    credit_card: 5,
    api_key: 5,
    national_id: 5,
    bank_account: 5
  };

  const THRESHOLD_BY_LEVEL = {
    strict: 1,
    balanced: 3,
    lenient: 4
  };

  function normalizeLevel(level) {
    if (level === "strict" || level === "lenient") {
      return level;
    }
    return "balanced";
  }

  function luhnCheck(numberText) {
    const digits = numberText.replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 16) {
      return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  function getCodeRanges(text) {
    const ranges = [];

    const fencedRegex = /```[\s\S]*?```/g;
    let hit = fencedRegex.exec(text);
    while (hit) {
      ranges.push([hit.index, hit.index + hit[0].length]);
      hit = fencedRegex.exec(text);
    }

    const inlineRegex = /`[^`\n]+`/g;
    hit = inlineRegex.exec(text);
    while (hit) {
      ranges.push([hit.index, hit.index + hit[0].length]);
      hit = inlineRegex.exec(text);
    }

    return ranges;
  }

  function isInsideRanges(index, ranges) {
    return ranges.some(([start, end]) => index >= start && index < end);
  }

  function firstCapturedGroup(hit) {
    for (let i = 1; i < hit.length; i += 1) {
      const value = hit[i];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  function nearbyText(text, start, end, radius) {
    const from = Math.max(0, start - radius);
    const to = Math.min(text.length, end + radius);
    return text.slice(from, to).toLowerCase();
  }

  function looksLikePersonalName(value) {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.length > 3) {
      return false;
    }

    const lowercaseTokens = tokens.map((token) => token.toLowerCase());
    if (lowercaseTokens.some((token) => STOPWORD_NAME_TOKENS.has(token))) {
      return false;
    }

    return tokens.every((token) => /^[\p{L}][\p{L}'-]{1,30}$/u.test(token));
  }

  function looksLikeTitleCaseName(value) {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 3) {
      return false;
    }

    const lowercaseTokens = tokens.map((token) => token.toLowerCase());
    if (lowercaseTokens.some((token) => STOPWORD_NAME_TOKENS.has(token))) {
      return false;
    }

    return tokens.every((token) => /^\p{Lu}[\p{Ll}'-]{1,30}$/u.test(token));
  }

  function normalizeNameCandidate(value) {
    const tokens = value.split(/\s+/).filter(Boolean);
    while (tokens.length > 0) {
      const tail = tokens[tokens.length - 1].toLowerCase();
      if (!STOPWORD_NAME_TOKENS.has(tail)) {
        break;
      }
      tokens.pop();
    }
    return tokens.join(" ");
  }

  function hasPhoneContext(text, start, end) {
    const context = nearbyText(text, start, end, 24);
    return /\b(phone|mobile|call|text|contact|tel|telefon|telefonnummer|handy|rufnummer|anrufen)\b/.test(context);
  }

  function normalizeDigits(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function normalizeGermanIban(value) {
    return String(value || "").replace(/[\s-]/g, "").toUpperCase();
  }

  function isValidGermanIban(value) {
    const iban = normalizeGermanIban(value);
    if (!/^DE\d{20}$/.test(iban)) {
      return false;
    }

    const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
    let digits = "";
    for (let i = 0; i < rearranged.length; i += 1) {
      const code = rearranged.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        digits += rearranged[i];
      } else if (code >= 65 && code <= 90) {
        digits += String(code - 55);
      } else {
        return false;
      }
    }

    let remainder = 0;
    for (let i = 0; i < digits.length; i += 1) {
      remainder = (remainder * 10 + Number(digits[i])) % 97;
    }

    return remainder === 1;
  }

  function collectMatches(config) {
    const {
      text,
      regex,
      type,
      label,
      codeRanges,
      ignoreInCode = true,
      normalizeFn,
      filterFn
    } = config;

    const matches = [];
    regex.lastIndex = 0;

    let hit = regex.exec(text);
    while (hit) {
      const start = hit.index;
      const raw = hit[0] || "";
      const end = start + raw.length;

      if (ignoreInCode && isInsideRanges(start, codeRanges)) {
        hit = regex.exec(text);
        continue;
      }

      const captured = firstCapturedGroup(hit);
      const valueSource = captured || raw;
      const rawValue = valueSource.trim();
      const value = normalizeFn ? normalizeFn(valueSource) : rawValue;

      if (!value) {
        hit = regex.exec(text);
        continue;
      }

      const finding = {
        type,
        label,
        match: value,
        rawMatch: rawValue,
        score: SCORE_BY_TYPE[type] || 1,
        start,
        end
      };

      if (!filterFn || filterFn(finding, text)) {
        matches.push(finding);
      }

      hit = regex.exec(text);
    }

    return matches;
  }

  function uniqueFindings(findings) {
    const seen = new Set();
    return findings.filter((finding) => {
      const key = `${finding.type}:${finding.match.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function redactText(text, findings) {
    let output = text;

    findings.forEach((finding) => {
      const escaped = finding.rawMatch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const replaceRegex = new RegExp(escaped, "g");
      output = output.replace(replaceRegex, `[REDACTED_${finding.type.toUpperCase()}]`);
    });

    return output;
  }

  function detectSensitiveInfo(text, options) {
    const input = typeof text === "string" ? text : "";
    if (!input.trim()) {
      return {
        isSensitive: false,
        findings: [],
        redactedText: input,
        meta: {
          detectionLevel: "balanced",
          threshold: THRESHOLD_BY_LEVEL.balanced,
          totalScore: 0,
          hasCritical: false
        }
      };
    }

    const detectionLevel = normalizeLevel(options && options.detectionLevel);
    const threshold = THRESHOLD_BY_LEVEL[detectionLevel];

    const findings = [];
    const codeRanges = getCodeRanges(input);

    findings.push(
      ...collectMatches({
        text: input,
        regex: EMAIL_REGEX,
        type: "email",
        label: "Email",
        codeRanges
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: PHONE_REGEX,
        type: "phone",
        label: "Phone Number",
        codeRanges,
        filterFn: (finding, fullText) => {
          const digits = normalizeDigits(finding.rawMatch);
          if (digits.length !== 10 && digits.length !== 11) {
            return false;
          }
          return hasPhoneContext(fullText, finding.start, finding.end);
        }
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: PHONE_DE_REGEX,
        type: "phone",
        label: "Phone Number",
        codeRanges,
        filterFn: (finding, fullText) => {
          const digits = normalizeDigits(finding.rawMatch);
          const compactRaw = finding.rawMatch.replace(/[\s\-./()]/g, "");
          if (digits.length < 7 || digits.length > 15) {
            return false;
          }
          if (!/^(\+49|0)/.test(compactRaw)) {
            return false;
          }
          return hasPhoneContext(fullText, finding.start, finding.end);
        }
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: SSN_REGEX,
        type: "ssn",
        label: "SSN",
        codeRanges,
        ignoreInCode: false
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: ADDRESS_REGEX,
        type: "address",
        label: "Street Address",
        codeRanges
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: ADDRESS_DE_REGEX,
        type: "address",
        label: "Street Address",
        codeRanges
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: NAME_DIRECT_CONTEXT_REGEX,
        type: "name",
        label: "Name",
        codeRanges,
        normalizeFn: normalizeNameCandidate,
        filterFn: (finding) => looksLikePersonalName(finding.match)
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: NAME_SELF_INTRO_REGEX,
        type: "name",
        label: "Name",
        codeRanges,
        normalizeFn: normalizeNameCandidate,
        filterFn: (finding) => looksLikeTitleCaseName(finding.match)
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: AGE_CONTEXT_REGEX,
        type: "age",
        label: "Age",
        codeRanges,
        filterFn: (finding) => {
          const age = Number(finding.match);
          return Number.isFinite(age) && age > 0 && age < 120;
        }
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: DOB_CONTEXT_REGEX,
        type: "dob",
        label: "Date of Birth",
        codeRanges
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: CREDIT_CARD_REGEX,
        type: "credit_card",
        label: "Credit Card",
        codeRanges,
        ignoreInCode: false,
        filterFn: (finding) => luhnCheck(finding.rawMatch)
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: STEUER_ID_CONTEXT_REGEX,
        type: "national_id",
        label: "National ID",
        codeRanges,
        ignoreInCode: false,
        normalizeFn: normalizeDigits,
        filterFn: (finding) => finding.match.length === 11
      })
    );

    findings.push(
      ...collectMatches({
        text: input,
        regex: IBAN_DE_REGEX,
        type: "bank_account",
        label: "Bank Account",
        codeRanges,
        ignoreInCode: false,
        normalizeFn: normalizeGermanIban,
        filterFn: (finding) => isValidGermanIban(finding.match)
      })
    );

    const keyPatterns = [
      { regex: OPENAI_KEY_REGEX, label: "API Key" },
      { regex: ANTHROPIC_KEY_REGEX, label: "API Key" },
      { regex: GITHUB_PAT_REGEX, label: "API Key" },
      { regex: GOOGLE_KEY_REGEX, label: "API Key" },
      { regex: AWS_ACCESS_KEY_REGEX, label: "API Key" }
    ];

    keyPatterns.forEach((entry) => {
      findings.push(
        ...collectMatches({
          text: input,
          regex: entry.regex,
          type: "api_key",
          label: entry.label,
          codeRanges,
          ignoreInCode: false
        })
      );
    });

    const unique = uniqueFindings(findings);
    const totalScore = unique.reduce((sum, finding) => sum + finding.score, 0);
    const hasCritical = unique.some((finding) => finding.score >= 5);

    return {
      isSensitive: hasCritical || totalScore >= threshold,
      findings: unique,
      redactedText: redactText(input, unique),
      meta: {
        detectionLevel,
        threshold,
        totalScore,
        hasCritical
      }
    };
  }

  global.LLMPrivacyDetector = {
    detectSensitiveInfo
  };
})(window);
