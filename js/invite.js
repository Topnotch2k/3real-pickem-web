export const INVITE_SHARE_TEXT = "Join my 3Real Pick'em league. Create your profile and save your PIN.";

const INVITE_PARAM_NAMES = ['invite', 'ref', 'i'];

function inviteParamsFromLocation() {
  const hash = window.location.hash || '';
  const hashQueryIndex = hash.indexOf('?');
  const searchParams = new URLSearchParams(window.location.search || '');
  const hashParams = hashQueryIndex === -1
    ? new URLSearchParams()
    : new URLSearchParams(hash.slice(hashQueryIndex + 1));
  return { searchParams, hashParams, hashQueryIndex, hash };
}

export function captureInviteParamsFromHash() {
  const { searchParams, hashParams } = inviteParamsFromLocation();
  const value = (name) => hashParams.get(name) || searchParams.get(name) || '';
  return {
    inviteToken: value('invite'),
    referralCode: value('ref'),
    inviteCode: value('i'),
  };
}

export function clearInviteParamsFromHash() {
  const { searchParams, hashParams, hashQueryIndex, hash } = inviteParamsFromLocation();
  if (!hash.startsWith('#/player-register')) {
    return;
  }
  INVITE_PARAM_NAMES.forEach((name) => {
    searchParams.delete(name);
    hashParams.delete(name);
  });
  const nextSearch = searchParams.toString();
  const hashRoute = hashQueryIndex === -1 ? hash : hash.slice(0, hashQueryIndex);
  const nextHashQuery = hashParams.toString();
  const nextHash = `${hashRoute}${nextHashQuery ? `?${nextHashQuery}` : ''}`;
  window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`);
}

export function buildInviteLink(inviteToken, referralCode = '') {
  if (referralCode) {
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({ i: referralCode });
    return `${base}#/player-register?${params.toString()}`;
  }
  if (!inviteToken) {
    return '';
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({ invite: inviteToken });
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

