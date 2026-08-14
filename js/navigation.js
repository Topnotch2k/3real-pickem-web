import { getCurrentRoute, navigateTo } from './router.js?v=20260814-4';

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
  }
  return element;
}

function createTopNav(items, currentRoute) {
  const nav = createElement('nav', { className: 'top-route-nav', attributes: { 'aria-label': 'Section navigation' } });
  items.forEach((item) => {
    const active = item.route === currentRoute;
    const button = createElement('button', {
      className: active ? 'primary-button' : 'secondary-button',
      text: item.label,
      attributes: { type: 'button', 'aria-current': active ? 'page' : 'false' },
    });
    button.addEventListener('click', () => {
      if (!active) navigateTo(item.route);
    });
    nav.appendChild(button);
  });
  return nav;
}

export function createPlayerNav(currentRoute = getCurrentRoute()) {
  return createTopNav([
    { label: 'Home', route: 'player-dashboard' },
    { label: 'Picks', route: 'player-picks' },
    { label: 'Messages', route: 'player-messages' },
    { label: 'Payments', route: 'player-payments' },
    { label: 'Referrals', route: 'player-referrals' },
    { label: "Everybody's Picks", route: 'player-everybodys-picks' },
    { label: 'Results', route: 'player-weekly-results' },
    { label: 'Help / Rules', route: 'player-help' },
  ], currentRoute);
}

export function createManagerNav(currentRoute = getCurrentRoute()) {
  return createTopNav([
    { label: 'Dashboard', route: 'manager-dashboard' },
    { label: 'Players', route: 'manager-players' },
    { label: 'Messages', route: 'manager-messages' },
    { label: 'Payments', route: 'manager-payments' },
    { label: 'Week', route: 'manager-week' },
    { label: 'Referrals', route: 'manager-referrals' },
    { label: "Everybody's Picks", route: 'manager-everybodys-picks' },
  ], currentRoute);
}
