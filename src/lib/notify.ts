export function notifySuccess(msg: string) {
  console.info('[SUCCESS]', msg);
}
export function notifyError(msg: string) {
  console.error('[ERROR]', msg);
  try {
    alert(msg);
  } catch {
    /* no-op */
  }
}
