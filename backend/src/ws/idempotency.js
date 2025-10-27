function ensureLimit(cache, limit) {
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

export function createIdempotencyCache({ limit = 500 } = {}) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError('Idempotency cache limit must be a positive integer');
  }

  const store = new Map();

  function getUserCache(userKey) {
    if (!store.has(userKey)) {
      store.set(userKey, new Map());
    }

    return store.get(userKey);
  }

  return {
    get(userKey, rid) {
      if (!userKey || !rid) {
        return null;
      }

      const cache = store.get(userKey);
      if (!cache) {
        return null;
      }

      if (!cache.has(rid)) {
        return null;
      }

      const value = cache.get(rid);
      cache.delete(rid);
      cache.set(rid, value);
      return value;
    },
    set(userKey, rid, value) {
      if (!userKey || !rid) {
        return value;
      }

      const cache = getUserCache(userKey);
      cache.delete(rid);
      cache.set(rid, value);
      ensureLimit(cache, limit);
      return value;
    },
    remember(userKey, rid, factory) {
      const cached = this.get(userKey, rid);
      if (cached) {
        return cached;
      }

      const value = factory();
      this.set(userKey, rid, value);
      return value;
    },
    clear(userKey) {
      if (!userKey) {
        store.clear();
        return;
      }

      store.delete(userKey);
    },
  };
}

export default createIdempotencyCache;
