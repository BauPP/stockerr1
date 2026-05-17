/**
 * EAN-13 checksum validation and generation utilities.
 *
 * Algorithm:
 *   1. Take 12 digits (positions 1-12, 1-indexed)
 *   2. Sum odd positions (1,3,5,7,9,11) × 1
 *   3. Sum even positions (2,4,6,8,10,12) × 3
 *   4. checksum = (10 - (total % 10)) % 10
 */

const EAN13_LENGTH = 13;

/**
 * Compute the EAN-13 checksum digit for the first 12 digits.
 * @param {string} digits - 12-digit string
 * @returns {number} checksum digit (0-9)
 */
function computeChecksum(digits) {
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      // odd position (1-indexed: 1,3,5,7,9,11) → ×1
      sum += digit;
    } else {
      // even position (1-indexed: 2,4,6,8,10,12) → ×3
      sum += digit * 3;
    }
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a full EAN-13 code including checksum.
 * @param {string} code
 * @returns {{ valid: boolean, checksum?: number, message?: string }}
 */
function validate(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'formato EAN-13 inválido' };
  }

  if (!/^\d{13}$/.test(code)) {
    return { valid: false, message: 'formato EAN-13 inválido' };
  }

  const expectedChecksum = computeChecksum(code.slice(0, 12));
  const actualChecksum = parseInt(code[12], 10);

  if (actualChecksum !== expectedChecksum) {
    return { valid: false, checksum: actualChecksum, message: 'checksum inválido' };
  }

  return { valid: true, checksum: actualChecksum };
}

/**
 * Generate a valid EAN-13 code from an optional prefix.
 * Prefix must be 1-12 digits long. If omitted, 12 random digits are used.
 * @param {object} options
 * @param {string} [options.prefix] - prefix digits (1-12)
 * @returns {string} 13-digit EAN-13 code
 */
function generate({ prefix } = {}) {
  let digits = '';

  if (prefix) {
    const cleaned = prefix.replace(/\D/g, '');
    digits = cleaned;
  }

  // Fill remaining digits randomly (up to 12 total before checksum)
  while (digits.length < 12) {
    digits += Math.floor(Math.random() * 10).toString();
  }

  // Truncate if prefix was too long
  digits = digits.slice(0, 12);

  const checksum = computeChecksum(digits);
  return digits + checksum.toString();
}

module.exports = {
  computeChecksum,
  validate,
  generate,
  EAN13_LENGTH,
};
