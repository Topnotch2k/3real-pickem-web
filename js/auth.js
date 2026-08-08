import { requestAction } from './api.js?v=20260807-2';

const MANAGER_SESSION_KEY = '3real_pickem_manager_session_token';
let postLoginManagerValidationHandoff = null;

function clearPostLoginManagerValidationHandoff() {
  postLoginManagerValidationHandoff = null;
}

export function saveManagerSessionToken(sessionToken) {
  if (sessionToken) {
    window.sessionStorage.setItem(MANAGER_SESSION_KEY, sessionToken);
  }
}

export function getManagerSessionToken() {
  return window.sessionStorage.getItem(MANAGER_SESSION_KEY) || '';
}

export function clearManagerSessionToken() {
  clearPostLoginManagerValidationHandoff();
  window.sessionStorage.removeItem(MANAGER_SESSION_KEY);
}

export async function loginManager(identifier, password) {
  clearPostLoginManagerValidationHandoff();
  try {
    const result = await requestAction('manager.login', { identifier, password });
    const data = result && result.data;
    if (data && typeof data.sessionToken === 'string' && data.sessionToken) {
      saveManagerSessionToken(data.sessionToken);
      postLoginManagerValidationHandoff = {
        manager: data.manager,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
      };
    }
    return data;
  } catch (error) {
    clearPostLoginManagerValidationHandoff();
    throw error;
  }
}

export function consumePostLoginManagerValidation() {
  const handoff = postLoginManagerValidationHandoff;
  clearPostLoginManagerValidationHandoff();
  if (!handoff) {
    return null;
  }

  const storedToken = getManagerSessionToken();
  const manager = handoff.manager;
  const expiresAt = new Date(handoff.expiresAt);
  if (
    !storedToken
    || typeof handoff.sessionToken !== 'string'
    || storedToken !== handoff.sessionToken
    || !manager
    || typeof manager !== 'object'
    || Array.isArray(manager)
    || typeof manager.managerId !== 'string'
    || !manager.managerId
    || typeof manager.username !== 'string'
    || !manager.username
    || typeof manager.email !== 'string'
    || !manager.email
    || manager.role !== 'owner'
    || Number.isNaN(expiresAt.getTime())
    || expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return { manager, expiresAt: handoff.expiresAt };
}

export async function validateStoredManagerSession() {
  const sessionToken = getManagerSessionToken();
  if (!sessionToken) {
    return null;
  }
  try {
    const result = await requestAction('manager.session', { sessionToken });
    return result.data;
  } catch (error) {
    clearManagerSessionToken();
    throw error;
  }
}

export async function logoutManager() {
  const sessionToken = getManagerSessionToken();
  try {
    if (sessionToken) {
      await requestAction('manager.logout', { sessionToken });
    }
  } finally {
    clearManagerSessionToken();
  }
}
