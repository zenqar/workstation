import 'server-only';

import { cookies } from 'next/headers';

export const ACTIVE_BUSINESS_COOKIE = 'zenqar_active_business';

export async function pickActiveMembership<T extends { business_id: string }>(memberships: T[] | null | undefined) {
  if (!memberships?.length) return undefined;
  const preferredId = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  return memberships.find(membership => membership.business_id === preferredId) ?? memberships[0];
}

export async function orderBusinessesByPreference<T extends { business: { id: string } }>(businesses: T[]) {
  const preferredId = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  if (!preferredId) return businesses;
  return [...businesses].sort((left, right) => Number(right.business.id === preferredId) - Number(left.business.id === preferredId));
}
