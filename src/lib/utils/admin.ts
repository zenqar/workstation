/**
 * Admin token utilities — uses Web Crypto API (Edge-compatible).
 *
 * SECURITY: Uses HMAC-SHA256 for signing.
 * Verification uses constant-time comparison via crypto.subtle.verify
 * to prevent timing attacks.
 */

export async function signAdminToken(payload: string, secret: string): Promise<string> {
  if (!secret) return '';

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time HMAC verification to prevent timing attacks.
 * Re-signs the payload and uses crypto.subtle.verify instead of string equality.
 */
export async function verifyAdminToken(
  signature: string,
  payload: string,
  secret: string
): Promise<boolean> {
  if (!secret || !signature) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Convert hex signature back to buffer for constant-time comparison
  let sigBytes: Uint8Array;
  try {
    const hex = signature;
    if (hex.length % 2 !== 0) return false;
    sigBytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      sigBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
  } catch {
    return false;
  }

  return crypto.subtle.verify('HMAC', cryptoKey, sigBytes.buffer as ArrayBuffer, data);
}
