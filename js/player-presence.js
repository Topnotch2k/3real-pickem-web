import { requestAction } from './api.js?v=20260815-1';
import { getPlayerSessionToken } from './player-auth.js?v=20260815-1';

const HEARTBEAT_INTERVAL_MS = 60000;

let started = false;
let heartbeatTimer = null;
let pingInFlight = false;

function clearHeartbeatTimer() {
  if (heartbeatTimer !== null) {
    window.clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleHeartbeat() {
  clearHeartbeatTimer();
  heartbeatTimer = window.setTimeout(() => {
    heartbeatTimer = null;
    if (document.visibilityState !== 'visible') {
      return;
    }
    void pingPresence();
    scheduleHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

async function pingPresence() {
  const sessionToken = getPlayerSessionToken();
  if (!sessionToken) {
    stopPlayerPresenceHeartbeat();
    return;
  }
  if (pingInFlight) {
    return;
  }
  pingInFlight = true;
  try {
    await requestAction('player.presence.ping', { sessionToken });
  } catch {
    // Presence is best-effort and must not interrupt gameplay.
  } finally {
    pingInFlight = false;
  }
}

function pingIfVisible() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  void pingPresence();
  scheduleHeartbeat();
}

export function startPlayerPresenceHeartbeat() {
  if (started) {
    return;
  }
  started = true;
  document.addEventListener('visibilitychange', pingIfVisible);
  window.addEventListener('focus', pingIfVisible);
  pingIfVisible();
}

export function stopPlayerPresenceHeartbeat() {
  if (!started) {
    return;
  }
  started = false;
  clearHeartbeatTimer();
  document.removeEventListener('visibilitychange', pingIfVisible);
  window.removeEventListener('focus', pingIfVisible);
}
