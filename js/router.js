import { clearManagerSessionToken, consumePostLoginManagerValidation, validateStoredManagerSession } from './auth.js?v=20260814-5';
import { clearPlayerSessionToken, validateStoredPlayerSession } from './player-auth.js?v=20260814-5';

const routes = new Map();

export function registerRoute(name, renderer, options = {}) {
  routes.set(name, { renderer, options });
}

export function getCurrentRoute() {
  const route = window.location.hash.replace(/^#\/?/, '');
  return (route.split('?')[0] || 'home');
}

export function navigateTo(route) {
  window.location.hash = `#/${route}`;
}

function createLoadingView(message) {
  const wrapper = document.createElement('main');
  wrapper.className = 'page-container';
  const card = document.createElement('section');
  card.className = 'state-card';
  card.setAttribute('aria-busy', 'true');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Loading';
  const heading = document.createElement('h1');
  heading.textContent = '3Real Pick\'em';
  const body = document.createElement('p');
  body.textContent = message;
  card.appendChild(eyebrow);
  card.appendChild(heading);
  card.appendChild(body);
  wrapper.appendChild(card);
  return wrapper;
}

export function startRouter(root) {
  var renderVersion = 0;

  async function render() {
    renderVersion += 1;
    const currentVersion = renderVersion;
    const routeName = getCurrentRoute();
    const route = routes.get(routeName) || routes.get('home');
    const postLoginManagerValidation = consumePostLoginManagerValidation();
    let context = { routeName };

    root.replaceChildren();
    root.appendChild(createLoadingView('Loading route...'));
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    if (route.options.requiresManagerSession) {
      try {
        const session = postLoginManagerValidation || await validateStoredManagerSession();
        if (!session) {
          clearManagerSessionToken();
          navigateTo('manager-login');
          return;
        }
        context = { ...context, manager: session.manager, session };
      } catch (error) {
        clearManagerSessionToken();
        navigateTo('manager-login');
        return;
      }
    }

    if (route.options.requiresPlayerSession) {
      try {
        const session = await validateStoredPlayerSession();
        if (!session) {
          clearPlayerSessionToken();
          navigateTo('player-login');
          return;
        }
        context = { ...context, player: session.player, session };
      } catch (error) {
        clearPlayerSessionToken();
        navigateTo('player-login');
        return;
      }
    }

    if (currentVersion !== renderVersion) {
      return;
    }

    root.replaceChildren();
    root.appendChild(route.renderer(context));
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  window.addEventListener('hashchange', render);
  render();
}

