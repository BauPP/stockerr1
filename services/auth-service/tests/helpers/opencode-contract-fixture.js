const fs = require('node:fs');
const path = require('node:path');

const FIXTURES_ROOT = path.join(__dirname, '..', 'fixtures', 'opencode-contract');

function normalizeFixtureName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Contract fixture name must be a non-empty string');
  }

  const normalized = name.replace(/\\/g, '/');

  if (path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`Invalid opencode contract fixture path: ${name}`);
  }

  return normalized;
}

function resolveFixturePath(name) {
  return path.join(FIXTURES_ROOT, ...normalizeFixtureName(name).split('/'));
}

function readContract(name) {
  const normalizedName = normalizeFixtureName(name);
  const fixturePath = resolveFixturePath(normalizedName);

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing repo-owned opencode contract fixture: ${normalizedName}`);
  }

  return fs.readFileSync(fixturePath, 'utf8');
}

function contractExists(name) {
  try {
    return fs.existsSync(resolveFixturePath(name));
  } catch {
    return false;
  }
}

module.exports = {
  readContract,
  contractExists,
};
