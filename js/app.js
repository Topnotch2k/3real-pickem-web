import { APP_CONFIG } from './config.js';
import { requestAction } from './api.js';
import { registerRoute, startRouter } from './router.js';
import { createManagerLoginView } from './views/manager-login.js';
import { createManagerDashboardView } from './views/manager-dashboard.js';
import { createManagerPlayersView } from './views/manager-players.js';
import { createManagerPaymentsView } from './views/manager-payments.js';
import { createManagerWeekView } from './views/manager-week.js';
import { createPlayerRegisterView } from './views/player-register.js';
import { createPlayerLoginView } from './views/player-login.js';
import { createPlayerDashboardView } from './views/player-dashboard.js';
import { createPlayerEntryPicksView } from './views/player-entry-picks.js';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
  }
  return element;
}

function appendChildren(parent, children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}

function createFeatureCard(eyebrow, title, body) {
  const card = createElement('article', { className: 'feature-card' });
  appendChildren(card, [
    createElement('p', { className: 'eyebrow', text: eyebrow }),
    createElement('h2', { text: title }),
    createElement('p', { text: body }),
  ]);
  return card;
}

function createShell() {
  const wrapper = createElement('main', { className: 'page-container' });
  const header = createElement('header', { className: 'site-header' });
  const brand = createElement('div', { className: 'brand-lockup' });
  appendChildren(brand, [
    createElement('p', { className: 'eyebrow', text: "Private NFL Pick'em" }),
    createElement('h1', { text: APP_CONFIG.appName }),
    createElement('p', { className: 'muted', text: "Football first. Built for a clean Sunday pick'em experience." }),
  ]);
  header.appendChild(brand);

  const grid = createElement('section', {
    className: 'card-grid',
    attributes: { 'aria-label': 'Foundation status' },
  });
  appendChildren(grid, [
    createFeatureCard('Frontend', 'GitHub Pages shell', 'Static, mobile-first, and public. No secrets, private picks, payment records, or lock authority live here.'),
    createFeatureCard('Backend', 'Apps Script authority', 'Google Apps Script will own authorization, privacy, payment approval, lock checks, grading, and audits.'),
    createFeatureCard('Database', 'Google Sheets', 'League records will live in private sheets managed through backend-only setup helpers.'),
  ]);

  const healthCard = createElement('section', {
    className: 'state-card',
    attributes: { id: 'health-card' },
  });
  const buttonRow = createElement('div', { className: 'button-row' });
  const button = createElement('button', {
    className: 'primary-button',
    text: 'Check backend health',
    attributes: { type: 'button', id: 'health-check-button' },
  });
  const createProfileLink = createElement('button', {
    className: 'primary-button',
    text: 'Create Profile',
    attributes: { type: 'button' },
  });
  const playerLoginLink = createElement('button', {
    className: 'secondary-button',
    text: 'Player Login',
    attributes: { type: 'button' },
  });
  const managerLink = createElement('button', {
    className: 'secondary-button',
    text: 'League Manager Login',
    attributes: { type: 'button' },
  });
  createProfileLink.addEventListener('click', () => {
    window.location.hash = '#/player-register';
  });
  playerLoginLink.addEventListener('click', () => {
    window.location.hash = '#/player-login';
  });
  managerLink.addEventListener('click', () => {
    window.location.hash = '#/manager-login';
  });
  appendChildren(buttonRow, [button, createProfileLink, playerLoginLink, managerLink]);
  const status = createElement('p', {
    className: 'muted',
    text: 'Backend URL is configured after Apps Script deployment.',
    attributes: { id: 'health-status' },
  });
  appendChildren(healthCard, [
    createElement('p', { className: 'eyebrow', text: 'Foundation' }),
    createElement('h2', { text: 'Ready for backend setup' }),
    createElement('p', { text: 'This foundation supports manager sign-in and player profiles. Payments, entries, picks, locks, grading, and live polling are intentionally not implemented yet.' }),
    buttonRow,
    status,
  ]);

  button.addEventListener('click', async () => {
    status.classList.remove('error-text');
    status.textContent = 'Checking backend health...';
    button.disabled = true;
    try {
      const result = await requestAction('public.health');
      status.classList.remove('error-text');
      status.textContent = `Backend healthy at ${result.meta.serverTime}`;
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error-text');
    } finally {
      button.disabled = false;
    }
  });

  appendChildren(wrapper, [header, grid, healthCard]);
  return wrapper;
}

const root = document.getElementById('app');
registerRoute('home', createShell);
registerRoute('manager-login', createManagerLoginView);
registerRoute('manager-dashboard', createManagerDashboardView, { requiresManagerSession: true });
registerRoute('manager-players', createManagerPlayersView, { requiresManagerSession: true });
registerRoute('manager-payments', createManagerPaymentsView, { requiresManagerSession: true });
registerRoute('manager-week', createManagerWeekView, { requiresManagerSession: true });
registerRoute('player-register', createPlayerRegisterView);
registerRoute('player-login', createPlayerLoginView);
registerRoute('player-dashboard', createPlayerDashboardView, { requiresPlayerSession: true });
registerRoute('player-entry-picks', createPlayerEntryPicksView, { requiresPlayerSession: true });
startRouter(root);
