import { requestAction } from '../api.js?v=20260813-6';
import { getPlayerSessionToken } from '../player-auth.js?v=20260813-6';
import { createPlayerNav } from '../navigation.js?v=20260813-6';
import { createEntrySheetsCard } from './player-dashboard.js?v=20260813-6';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  }
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function playerAction(action, payload = {}) {
  return requestAction(action, { ...payload, sessionToken: getPlayerSessionToken() });
}

export function createPlayerPicksView() {
  const wrapper = createElement('main', { className: 'page-container' });
  const bootstrapRequest = playerAction('player.dashboard.bootstrap');
  const entrySheets = createEntrySheetsCard(bootstrapRequest);
  const warning = createElement('section', { className: 'state-card compact-card' });
  appendChildren(warning, [
    createElement('p', { className: 'eyebrow', text: 'Pick Deadline' }),
    createElement('p', { className: 'muted', text: "Paid entry ready: make and save your picks before each game locks. Locked games do not reopen, and missed picks are not refundable." }),
  ]);
  appendChildren(wrapper, [
    createPlayerNav('player-picks'),
    warning,
    entrySheets.card,
  ]);
  return wrapper;
}
