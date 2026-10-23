import { requestAction } from './api.js?v=20260920-24';

const PLAYER_SESSION_KEY = '3real_pickem_player_session_token';
const PLAYER_LOGIN_SESSION_KEY = '3real_pickem_player_login_session';
const PLAYER_LOGIN_HANDOFF_TTL_MS = 30000;
let postLoginPlayerValidationHandoff = null;
let playerLoginStartedAt = null;

function clearPostLoginPlayerValidationHandoff() {
  postLoginPlayerValidationHandoff = null;
}

function createLoginSessionMarker() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getPlayerLoginSessionMarker() {
  try {
    let marker = window.sessionStorage.getItem(PLAYER_LOGIN_SESSION_KEY);
    if (!marker) {
      marker = createLoginSessionMarker();
      window.sessionStorage.setItem(PLAYER_LOGIN_SESSION_KEY, marker);
    }
    return marker;
  } catch {
    return '';
  }
}

function clearPlayerLoginSessionMarker() {
  try {
    window.sessionStorage.removeItem(PLAYER_LOGIN_SESSION_KEY);
  } catch {
    // Storage failure should not block logout.
  }
}

export function getPlayerSessionToken() {
  return window.sessionStorage.getItem(PLAYER_SESSION_KEY) || '';
}

export function savePlayerSessionToken(token) {
  if (token) {
    window.sessionStorage.setItem(PLAYER_SESSION_KEY, token);
  }
}

export function clearPlayerSessionToken() {
  clearPostLoginPlayerValidationHandoff();
  playerLoginStartedAt = null;
  window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

export async function loginPlayer(displayName, pin) {
  clearPostLoginPlayerValidationHandoff();
  playerLoginStartedAt = performance.now();
  try {
    const result = await requestAction('player.login', { displayName, pin });
    const data = result && result.data;
    const token = data && data.sessionToken;
    if (!token) {
      throw new Error('Login did not return a player session. Try again.');
    }
    savePlayerSessionToken(token);
    getPlayerLoginSessionMarker();
    postLoginPlayerValidationHandoff = {
      player: data.player,
      sessionToken: token,
      expiresAt: data.expiresAt,
      createdAt: Date.now(),
    };
    return data;
  } catch (error) {
    clearPostLoginPlayerValidationHandoff();
    playerLoginStartedAt = null;
    throw error;
  }
}

export function consumePostLoginPlayerValidation() {
  const handoff = postLoginPlayerValidationHandoff;
  clearPostLoginPlayerValidationHandoff();
  if (!handoff) return null;

  const storedToken = getPlayerSessionToken();
  const player = handoff.player;
  const expiresAt = new Date(handoff.expiresAt);
  if (
    !storedToken
    || typeof handoff.sessionToken !== 'string'
    || storedToken !== handoff.sessionToken
    || !player
    || typeof player !== 'object'
    || Array.isArray(player)
    || typeof player.playerId !== 'string'
    || !player.playerId
    || !Number.isFinite(handoff.createdAt)
    || Date.now() - handoff.createdAt > PLAYER_LOGIN_HANDOFF_TTL_MS
    || Number.isNaN(expiresAt.getTime())
    || expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return { player, expiresAt: handoff.expiresAt };
}

export function consumePlayerLoginStartedAt() {
  const startedAt = playerLoginStartedAt;
  playerLoginStartedAt = null;
  return startedAt;
}

export async function validateStoredPlayerSession() {
  const token = getPlayerSessionToken();
  if (!token) {
    return null;
  }
  const result = await requestAction('player.session', { sessionToken: token });
  return result.data;
}

export async function logoutPlayer() {
  const token = getPlayerSessionToken();
  try {
    if (token) {
      await requestAction('player.logout', { sessionToken: token });
    }
  } finally {
    clearPlayerSessionToken();
    clearPlayerLoginSessionMarker();
  }
}

