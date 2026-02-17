const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadDetector() {
  const detectorPath = path.resolve(__dirname, '../src/detector.js');

  delete global.LLMPrivacyDetector;
  global.window = global;
  delete require.cache[require.resolve(detectorPath)];
  require(detectorPath);

  assert.ok(global.LLMPrivacyDetector, 'LLMPrivacyDetector should be attached to window/global');
  assert.equal(typeof global.LLMPrivacyDetector.detectSensitiveInfo, 'function');

  return global.LLMPrivacyDetector;
}

const detector = loadDetector();

function detect(text, detectionLevel = 'balanced') {
  return detector.detectSensitiveInfo(text, { detectionLevel });
}

function assertFindingType(result, type) {
  assert.ok(
    result.findings.some((finding) => finding.type === type),
    `Expected finding type "${type}". Got: ${result.findings.map((f) => f.type).join(', ')}`
  );
}

test('detects name entity', () => {
  const result = detect('My name is John Doe', 'strict');
  assertFindingType(result, 'name');
  assert.equal(result.isSensitive, true);
});

test('detects age entity', () => {
  const result = detect('My age is 42', 'strict');
  assertFindingType(result, 'age');
  assert.equal(result.isSensitive, true);
});

test('detects email entity', () => {
  const result = detect('Reach me at alice@example.com');
  assertFindingType(result, 'email');
  assert.equal(result.isSensitive, true);
});

test('detects phone entity', () => {
  const result = detect('My phone number is 415-555-2671');
  assertFindingType(result, 'phone');
  assert.equal(result.isSensitive, true);
});

test('detects ssn entity', () => {
  const result = detect('My SSN is 123-45-6789');
  assertFindingType(result, 'ssn');
  assert.equal(result.isSensitive, true);
});

test('detects address entity', () => {
  const result = detect('I live at 123 Main Street');
  assertFindingType(result, 'address');
  assert.equal(result.isSensitive, true);
});

test('detects dob entity', () => {
  const result = detect('DOB: 01/31/1990');
  assertFindingType(result, 'dob');
  assert.equal(result.isSensitive, true);
});

test('detects credit card entity', () => {
  const result = detect('Card: 4111 1111 1111 1111');
  assertFindingType(result, 'credit_card');
  assert.equal(result.isSensitive, true);
});

test('detects api key entity', () => {
  const result = detect('Key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789');
  assertFindingType(result, 'api_key');
  assert.equal(result.isSensitive, true);
});

test('detects german name entity', () => {
  const result = detect('Mein Name ist Max Mustermann', 'strict');
  assertFindingType(result, 'name');
  assert.equal(result.isSensitive, true);
});

test('detects german age entity', () => {
  const result = detect('Ich bin 34 Jahre alt', 'strict');
  assertFindingType(result, 'age');
  assert.equal(result.isSensitive, true);
});

test('detects german phone entity', () => {
  const result = detect('Meine Telefonnummer ist +49 30 12345678');
  assertFindingType(result, 'phone');
  assert.equal(result.isSensitive, true);
});

test('detects german address entity', () => {
  const result = detect('Meine Adresse ist Hauptstra\u00dfe 12');
  assertFindingType(result, 'address');
  assert.equal(result.isSensitive, true);
});

test('detects german dob entity', () => {
  const result = detect('Geburtsdatum: 31.01.1990');
  assertFindingType(result, 'dob');
  assert.equal(result.isSensitive, true);
});

test('detects german tax id as national_id entity', () => {
  const result = detect('Steuer-ID: 12345678901');
  assertFindingType(result, 'national_id');
  assert.equal(result.isSensitive, true);
});

test('detects german iban as bank_account entity', () => {
  const result = detect('Meine IBAN ist DE89 3704 0044 0532 0130 00');
  assertFindingType(result, 'bank_account');
  assert.equal(result.isSensitive, true);
});

test('balanced mode does not flag name-only prompt as sensitive', () => {
  const result = detect('My name is John Doe', 'balanced');
  assertFindingType(result, 'name');
  assert.equal(result.isSensitive, false);
});

test('still detects high-risk secrets inside code block', () => {
  const result = detect('```\nconst key = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";\n```');
  assertFindingType(result, 'api_key');
  assert.equal(result.isSensitive, true);
});

test('ignores weaker signals inside code block', () => {
  const result = detect('```\nmy age is 42\nmy name is John Doe\n```', 'strict');
  assert.equal(result.findings.some((finding) => finding.type === 'age'), false);
  assert.equal(result.findings.some((finding) => finding.type === 'name'), false);
});
