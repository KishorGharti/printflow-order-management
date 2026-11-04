'use strict';

/**
 * In-memory presence tracking for the Developer Console.
 *
 * A client shop counts as online when its owner or any of its staff made an
 * authenticated API request within ONLINE_WINDOW_MS. Nothing is written to the
 * database, so presence resets when the backend restarts.
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const lastSeenByClient = new Map();
const lastSeenByBusiness = new Map();

function markActive({ clientId, businessId } = {}) {
  const now = Date.now();
  if (clientId) lastSeenByClient.set(String(clientId), now);
  if (businessId) lastSeenByBusiness.set(String(businessId), now);
}

/** Most recent activity (ms epoch) for a client's own account or its business, or null. */
function getLastSeen(clientId, businessId) {
  const byClient = clientId ? lastSeenByClient.get(String(clientId)) || 0 : 0;
  const byBusiness = businessId ? lastSeenByBusiness.get(String(businessId)) || 0 : 0;
  return Math.max(byClient, byBusiness) || null;
}

function isOnline(lastSeenAt, now = Date.now()) {
  return Boolean(lastSeenAt) && now - lastSeenAt <= ONLINE_WINDOW_MS;
}

module.exports = { ONLINE_WINDOW_MS, markActive, getLastSeen, isOnline };
