import { APP_CONFIG } from './config.js?v=20260813-2';

const READ_ONLY_ACTIONS = new Set([
  'public.health',
  'manager.session',
  'manager.players.list',
  'manager.invite.get',
  'manager.messages.list',
  'manager.payments.list',
  'manager.week.get',
  'manager.week.picksBoard',
  'player.session',
  'player.dashboard.bootstrap',
  'player.invite.get',
  'player.messages.list',
  'player.payment.options',
  'player.payments.list',
  'player.week.entrySheets',
  'player.week.picksBoard',
  'player.entry.picks.get',
]);
const READ_RECOVERY_DELAY_MS = 350;

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code || 'API_ERROR';
    this.details = options.details || {};
    this.status = options.status || 0;
  }
}

function logRequestPerformance(action, startedAt, status, outcome, attempt, recovered) {
  try {
    console.log('[3REAL_PERF] request', JSON.stringify({
      action: String(action || ''),
      durationMs: Math.round(performance.now() - startedAt),
      status: status || 0,
      outcome,
      attempt,
      recovered,
    }));
  } catch (error) {
    // Performance logging must never affect request behavior.
  }
}

function waitForReadRecovery() {
  return new Promise((resolve) => window.setTimeout(resolve, READ_RECOVERY_DELAY_MS));
}

function isExpectedApiEnvelope(body) {
  return Boolean(body && typeof body === 'object' && !Array.isArray(body) && typeof body.ok === 'boolean');
}

export async function requestAction(action, payload = {}) {
  if (!APP_CONFIG.appsScriptWebAppUrl) {
    throw new ApiError('Apps Script Web App URL is not configured yet.', {
      code: 'CONFIG_MISSING',
    });
  }

  const canRecoverRead = READ_ONLY_ACTIONS.has(action);
  const maximumAttempts = canRecoverRead ? 2 : 1;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const startedAt = performance.now();
    let response;
    try {
      response = await fetch(APP_CONFIG.appsScriptWebAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, payload }),
      });
    } catch (error) {
      logRequestPerformance(action, startedAt, 0, 'network_error', attempt, false);
      throw new ApiError('Could not reach the league backend.', {
        code: 'NETWORK_ERROR',
        details: { message: error.message },
      });
    }

    let body;
    let parseError = null;
    try {
      body = await response.json();
    } catch (error) {
      parseError = error;
    }

    if (parseError || !isExpectedApiEnvelope(body)) {
      if (attempt < maximumAttempts) {
        logRequestPerformance(action, startedAt, response.status, 'transport_recovery', attempt, false);
        await waitForReadRecovery();
        continue;
      }
      logRequestPerformance(action, startedAt, response.status, 'parse_error', attempt, false);
      throw new ApiError('The league backend returned an unreadable response.', {
        code: 'PARSE_ERROR',
        status: response.status,
        details: { message: parseError ? parseError.message : 'Response envelope is invalid.' },
      });
    }

    if (!response.ok || !body.ok) {
      logRequestPerformance(action, startedAt, response.status, 'backend_error', attempt, false);
      const apiError = body.error || {};
      throw new ApiError(apiError.message || 'The league backend rejected the request.', {
        code: apiError.code || 'BACKEND_ERROR',
        status: response.status,
        details: apiError.details || {},
      });
    }

    logRequestPerformance(action, startedAt, response.status, 'success', attempt, attempt === 2);
    return body;
  }

  throw new ApiError('The league backend returned an unreadable response.', { code: 'PARSE_ERROR' });
}

