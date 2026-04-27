import { signAdminToken, verifyAdminToken } from '@/lib/utils/admin';

/**
 * signAdminSession(secret: string): string
 * HMAC SHA-256 (Web Crypto API)
 */
export async function signAdminSession(payload: string, secret: string): Promise<string> {
  return signAdminToken(payload, secret);
}

/**
 * verifyAdminSession(token: string, secret: string): boolean
 */
export async function verifyAdminSession(token: string, payload: string, secret: string): Promise<boolean> {
  return verifyAdminToken(token, payload, secret);
}
