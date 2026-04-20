export const signedOutStorageKey = 'tracing.signedOut';

export function readSignedOutFlag(): boolean {
  return window.sessionStorage.getItem(signedOutStorageKey) === 'true';
}

export function setSignedOutFlag(): void {
  window.sessionStorage.setItem(signedOutStorageKey, 'true');
}

export function clearSignedOutFlag(): void {
  window.sessionStorage.removeItem(signedOutStorageKey);
}
