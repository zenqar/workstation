/**
 * Signs a payload using the ADMIN_SECRET.
 * This version uses the Web Crypto API (supported in Edge/Middleware).
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
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    data
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies if the signature matches the signed payload.
 */
export async function verifyAdminToken(signature: string, payload: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  const expectedSignature = await signAdminToken(payload, secret);
  return signature === expectedSignature;
}
