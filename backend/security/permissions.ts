// backend/security/permissions.service.ts
import { getWindowsUserName } from './identity.ts';
import { getPermissions } from '../db.ts';
import { ensureUserExists } from '../db.ts';

// Typage des droits/flags
export type FeatureFlags = {
  canUseApp: boolean;
  canImportFiles: boolean;
};

export async function getPermissionsForCurrentUser(): Promise<FeatureFlags> {
  const username = getWindowsUserName();

  const denyAll: FeatureFlags = {
    canUseApp: false,
    canImportFiles : false,
  };

  if (!username) return denyAll;

  try {
    // S’assurer que l’utilisateur est présent en base :
    await ensureUserExists(username);

    // Lecture encapsulée (une seule fonction côté DB)
    const flags = await getPermissions(username);

    return flags;
  } catch (err) {
    console.error('getPermissionsForCurrentUser error:', err);
    return denyAll; // secure by default si la DB est down
  }

}