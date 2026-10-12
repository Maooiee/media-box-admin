/**
 * @typedef {Object} QrCode
 * @property {string} code
 * @property {string} valid_from
 * @property {string} valid_until
 */

export function createQrCode(raw) {
  if (!raw) return null;
  return {
    code: raw.code,
    validFrom: raw.valid_from,
    validUntil: raw.valid_until,
  };
}
