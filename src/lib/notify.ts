import { toast } from 'sonner';

export function notifySuccess(msg: string) {
  console.info('[SUCCESS]', msg);
  toast.success(msg);
}

export function notifyError(msg: string) {
  console.error('[ERROR]', msg);
  toast.error(msg);
}
