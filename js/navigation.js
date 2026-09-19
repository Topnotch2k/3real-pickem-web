import { getCurrentRoute, navigateTo } from './router.js?v=20260816-1';

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

function keepActivePlayerNavItemVisible(nav) {
  const activeButton = nav.querySelector('[aria-current="page"]');
  if (!activeButton) return;
  const visibleLeft = nav.scrollLeft;
  const visibleRight = visibleLeft + nav.clientWidth;
  const itemLeft = activeButton.offsetLeft;
  const itemRight = itemLeft + activeButton.offsetWidth;
  if (itemLeft < visibleLeft) {
    nav.scrollLeft = itemLeft;
  } else if (itemRight > visibleRight) {
    nav.scrollLeft = itemRight - nav.clientWidth;
  }
}

export function createPlayerNav(currentRoute = getCurrentRoute()) {
  const items = [
    { label: 'Home', route: 'player-dashboard' },
    { label: 'Payments', route: 'player-payments' },
    { label: 'Picks', route: 'player-picks' },
    { label: "Everybody's Picks", route: 'player-everybodys-picks' },
    { label: 'Results', route: 'player-weekly-results' },
    { label: 'Referrals', route: 'player-referrals' },
    { label: 'Messages', route: 'player-messages' },
    { label: 'Help / Rules', route: 'player-help' },
  ].filter((item) => currentRoute !== 'player-dashboard' || item.route !== 'player-dashboard');
  const nav = createTopNav(items, currentRoute);
  window.requestAnimationFrame(() => keepActivePlayerNavItemVisible(nav));
  return nav;
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
