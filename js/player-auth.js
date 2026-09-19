import { requestAction } from './api.js?v=20260816-1';

const PLAYER_SESSION_KEY = '3real_pickem_player_session_token';
const PLAYER_LOGIN_SESSION_KEY = '3real_pickem_player_login_session';

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
  window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

export async function loginPlayer(displayName, pin) {
  const result = await requestAction('player.login', { displayName, pin });
  const token = result.data.sessionToken;
  if (!token) {
    throw new Error('Login did not return a player session. Try again.');
  }
  savePlayerSessionToken(token);
  getPlayerLoginSessionMarker();
  return result.data;
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

