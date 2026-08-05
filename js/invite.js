export const INVITE_SHARE_TEXT = "Join my 3Real Pick'em league. Create your profile and save your PIN.";

export function captureInviteParamsFromHash() {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return { inviteToken: '', referralCode: '' };
  }
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return {
    inviteToken: params.get('invite') || '',
    referralCode: params.get('ref') || '',
  };
}

export function clearInviteParamsFromHash() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#/player-register') || !hash.includes('?')) {
    return;
  }
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/player-register`);
}

export function buildInviteLink(inviteToken, referralCode = '') {
  if (!inviteToken) {
    return '';
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({ invite: inviteToken });
  if (referralCode) {
    params.set('ref', referralCode);
  }
  return `${base}#/player-register?${params.toString()}`;
}

export async function copyInviteLink(inviteLink) {
  await navigator.clipboard.writeText(inviteLink);
}

export async function shareInviteLink(inviteLink) {
  if (!navigator.share) {
    await copyInviteLink(inviteLink);
    return 'copied';
  }
  await navigator.share({ text: INVITE_SHARE_TEXT, url: inviteLink });
  return 'shared';
}