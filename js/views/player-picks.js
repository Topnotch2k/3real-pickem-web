import { requestAction } from '../api.js?v=20260816-1';
import { getPlayerSessionToken } from '../player-auth.js?v=20260919-14';
import { createPlayerNav } from '../navigation.js?v=20260919-15';
import { createEntrySheetsCard } from './player-dashboard.js?v=20260920-6';

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
  const warning = createElement('section', { className: 'state-card compact-card pick-deadline-warning' });
  const responsibility = createElement('p', { className: 'pick-deadline-responsibility' });
  appendChildren(responsibility, [
    document.createTextNode('YOU ARE RESPONSIBLE FOR '),
    createElement('strong', { text: 'SAVING' }),
    document.createTextNode(' YOUR PICKS BEFORE EACH GAME LOCKS.'),
  ]);
  const lockTiming = createElement('p', { className: 'pick-deadline-support' });
  appendChildren(lockTiming, [
    document.createTextNode('Games lock '),
    createElement('span', { className: 'pick-deadline-hours', text: '12' }),
    document.createTextNode(' hours before kickoff.'),
  ]);
  appendChildren(warning, [
    createElement('p', { className: 'eyebrow pick-deadline-title', text: 'PICK DEADLINE ⚠️' }),
    responsibility,
    createElement('p', { className: 'pick-deadline-support', text: 'Locked games do not reopen.' }),
    lockTiming,
    createElement('p', { className: 'pick-deadline-support', text: 'Missed picks are not refundable.' }),
  ]);
  appendChildren(wrapper, [
    createPlayerNav('player-picks'),
    warning,
    entrySheets.card,
  ]);
  return wrapper;
}
