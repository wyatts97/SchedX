/**
 * Admin User Cache
 * Caches the admin user ID to avoid repeated database lookups
 */

import { getDbInstance } from './db';
import logger from './logger';

interface CachedAdmin {
  id: string;
  username: string;
  cachedAt: number;
}

let cachedAdmin: CachedAdmin | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get admin user ID with caching
 * Gets the first user with role='admin'
 */
export async function getAdminUserId(): Promise<string | null> {
  // Check cache first
  if (cachedAdmin && Date.now() - cachedAdmin.cachedAt < CACHE_TTL) {
    logger.debug({ userId: cachedAdmin.id, cacheAge: Date.now() - cachedAdmin.cachedAt }, 'Admin user ID from cache');
    return cachedAdmin.id;
  }

  // Cache miss or expired - fetch from database
  try {
    const db = getDbInstance();
    // Get any admin user (not by username)
    const user = db['db'].prepare('SELECT id, username FROM users WHERE role = ? LIMIT 1').get('admin') as { id: string; username: string } | undefined;
    
    if (user) {
      cachedAdmin = {
        id: user.id,
        username: user.username,
        cachedAt: Date.now()
      };
      logger.debug({ userId: user.id }, 'Admin user ID cached');
      return user.id;
    }
    
    logger.warn('Admin user not found');
    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch admin user');
    return null;
  }
}

/**
 * Get full admin user object with caching
 */
export async function getAdminUser(): Promise<any | null> {
  const userId = await getAdminUserId();
  if (!userId) return null;

  // If we need the full user object, fetch it
  // (This is less common, so we don't cache the full object)
  const db = getDbInstance();
  const user = db['db'].prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('admin');
  return user || null;
}

/**
 * Clear the admin cache (call this if admin user is updated)
 */
export function clearAdminCache(): void {
  cachedAdmin = null;
  logger.debug('Admin cache cleared');
}
