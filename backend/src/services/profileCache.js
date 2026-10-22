import {
  CACHE_HEADER,
  cacheResponse,
  invalidateCacheNamespace,
} from '../middleware/cacheLayer.js';

export const PROFILE_CACHE_NAMESPACE =
  'user-profile';

export const PROFILE_CACHE_TTL_SECONDS =
  120;

const profileCache = cacheResponse({
  namespace: PROFILE_CACHE_NAMESPACE,
  ttlSeconds: PROFILE_CACHE_TTL_SECONDS,
  scopeBuilder: (req) =>
    req.params.uid ?? req.user.uid,
});

/**
 * Cache profile reads only when the route receives no query parameters.
 *
 * The profile handlers ignore req.query, so allowing query variants would
 * create multiple equivalent Redis entries for the same profile.
 */
export const cacheProfileResponse = (
  req,
  res,
  next,
) => {
  // Campus material is private and must be read fresh, including /:uid.
  // Bypass before cache lookup so cached public-route data cannot skip auth.
  if (req.campusRequest) return next();
  // Public and owner payloads are not equivalent. Never serve a cached owner
  // response (or an older public projection) to another authenticated account.
  if (req.params.uid && req.params.uid !== req.user.uid) {
    res.set(CACHE_HEADER, 'BYPASS');
    return next();
  }
  if (
    Object.keys(
      req.query ?? {},
    ).length > 0
  ) {
    res.set(
      CACHE_HEADER,
      'BYPASS',
    );

    return next();
  }

  return profileCache(
    req,
    res,
    next,
  );
};

/**
 * Invalidate every cached profile representation for a UID.
 *
 * @param {string} uid Profile UID.
 * @returns {Promise<object>} Invalidation result.
 */
export const invalidateProfileCache = (
  uid,
) =>
  invalidateCacheNamespace({
    namespace:
      PROFILE_CACHE_NAMESPACE,
    scope: uid,
  });
