import { requestAction } from '../api.js?v=20260813-5';
import { getPlayerSessionToken } from '../player-auth.js?v=20260813-5';
import { createPlayerNav } from '../navigation.js?v=20260813-5';
import { createPaymentWorkspace } from './player-dashboard.js?v=20260813-5';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function playerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getPlayerSessionToken() });
}

export function createPlayerPaymentsView() {
  const wrapper = createElement('main', { className: 'page-container' });
  const bootstrapRequest = playerAction('player.dashboard.bootstrap');
  const paymentWorkspace = createPaymentWorkspace(bootstrapRequest);
  appendChildren(wrapper, [
    createPlayerNav('player-payments'),
    paymentWorkspace.requestCard,
    paymentWorkspace.historyCard,
  ]);
  return wrapper;
}
