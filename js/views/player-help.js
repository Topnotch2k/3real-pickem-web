import { createPlayerNav } from '../navigation.js?v=20260813-5';

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

function helpSection(title, body) {
  const section = createElement('article', { className: 'player-card compact-card' });
  appendChildren(section, [
    createElement('h3', { text: title }),
    createElement('p', { className: 'muted', text: body }),
  ]);
  return section;
}

export function createPlayerHelpView() {
  const wrapper = createElement('main', { className: 'page-container' });
  const card = createElement('section', { className: 'state-card compact-card' });
  const list = createElement('section', { className: 'player-list' });
  [
    ['Getting an Entry', 'Request a paid entry from Payments or redeem an earned free entry when one is available. Paid entries are created after the Manager verifies payment and marks the request Paid.'],
    ['Making Your Picks', 'Open Picks, choose an entry sheet, make or edit your picks, enter the tiebreaker when required, and save before the relevant games lock.'],
    ['Game Locks', "Every game has its own lock time. Once a game locks, that game's pick cannot be changed. Later games may remain editable until their own lock times."],
    ['Purchase Cutoff', 'New entries and payment requests close at the earliest game lock for that Week.'],
    ["Everybody's Picks", "Everybody's Picks becomes visible according to the current reveal and lock behavior. Locked, scored, or archived weeks may show more pick details."],
    ['Tiebreaker', 'The tiebreaker is the designated latest-kickoff game. Enter the predicted combined score as a whole number from 0-200.'],
    ['Referrals / Free Entries', 'Share your invite link from Referrals. Qualified referrals count toward the existing league reward milestones and may earn free entries or badges.'],
    ['Preseason', 'Preseason is free to play. Real-money prize pots begin with the regular season.'],
    ['Messages', 'Use Messages to contact the Manager and reply in your league thread.'],
    ['Email Notifications', 'Email alerts are optional. Add an email and opt in from Messages when you want league updates by email.'],
  ].forEach(([title, body]) => list.appendChild(helpSection(title, body)));
  const responsibility = createElement('article', { className: 'player-card compact-card' });
  appendChildren(responsibility, [
    createElement('p', { className: 'eyebrow', text: 'Important' }),
    createElement('h3', { text: 'Paid Entry Responsibility' }),
    createElement('p', { text: "Once your payment has been marked Paid and your entry is created, it is your responsibility to make and save your picks before each game's lock time." }),
    createElement('p', { text: 'Locked games will not reopen because you forgot, waited too long, did not return to the app, or did not see a notification.' }),
    createElement('p', { text: 'Missed picks caused by failing to submit before the lock are not refundable.' }),
  ]);
  list.appendChild(responsibility);
  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: 'Help / Rules' }),
    createElement('h1', { text: 'Help / Rules' }),
    list,
  ]);
  appendChildren(wrapper, [createPlayerNav('player-help'), card]);
  return wrapper;
}
