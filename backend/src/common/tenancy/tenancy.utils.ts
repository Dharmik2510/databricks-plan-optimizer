import { v5 as uuidv5, validate as uuidValidate } from 'uuid';

const DEFAULT_ORG_NAMESPACE = 'a9f6b404-1f8b-4e88-9d35-4f92b2b8cb1b';
const DEFAULT_USER_NAMESPACE = '0ad3ef77-71db-4e2c-85c8-4e0de6d0d6a3';

export function deriveOrgId(userId: string, explicitOrgId?: string): string {
  if (explicitOrgId && uuidValidate(explicitOrgId)) {
    return explicitOrgId;
  }

  const namespace = process.env.ORG_NAMESPACE_UUID || DEFAULT_ORG_NAMESPACE;
  return uuidv5(explicitOrgId || userId, namespace);
}

export function deriveUserUuid(userId: string): string {
  if (uuidValidate(userId)) {
    return userId;
  }
  const namespace = process.env.USER_NAMESPACE_UUID || DEFAULT_USER_NAMESPACE;
  return uuidv5(userId, namespace);
}

export function resolveOrgIdFromSettings(settings?: any, userId?: string): string | null {
  const raw = settings?.orgId || settings?.org_id;
  if (raw && typeof raw === 'string') {
    return uuidValidate(raw) ? raw : deriveOrgId(userId || raw, raw);
  }
  return userId ? deriveOrgId(userId) : null;
}
