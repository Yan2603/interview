import { debounce } from 'lodash-es';

export function getErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'isAxiosError' in err) {
    const axiosErr = err as { response?: { data?: { message?: unknown } }; message?: string };
    const msg = axiosErr.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg as string ?? axiosErr.message ?? '请求失败');
  }
  return err instanceof Error ? err.message : '请求失败';
}

export const createDebouncedSearch = (callback: () => void | Promise<void>, delay = 500) => {
  return debounce(callback, delay);
};
