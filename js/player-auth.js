import { requestAction } from './api.js?v=20260807-3';

const PLAYER_SESSION_KEY = '3real_pickem_player_session_token';

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
  }
}
