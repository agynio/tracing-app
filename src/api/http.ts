import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '@/config';

export type ApiError = AxiosError<{ error?: string; message?: string } | unknown>;

function createHttp(baseURL: string): AxiosInstance {
  const inst = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    withCredentials: false,
  });

  inst.interceptors.response.use(
    (res) => res.data,
    (err) => {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (data?.error && !err.message.includes(data.error)) err.message = data.error;
        else if (data?.message && !err.message.includes(data.message)) err.message = data.message;
      }
      return Promise.reject(err);
    },
  );
  return inst;
}

export type HttpClient = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
};

export function wrap(inst: AxiosInstance): HttpClient {
  return {
    get: <T>(url: string, cfg?: AxiosRequestConfig) => inst.get(url, cfg) as unknown as Promise<T>,
    post: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.post(url, data, cfg) as unknown as Promise<T>,
    put: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.put(url, data, cfg) as unknown as Promise<T>,
    delete: <T>(url: string, cfg?: AxiosRequestConfig) =>
      inst.delete(url, cfg) as unknown as Promise<T>,
    patch: <T>(url: string, data?: unknown, cfg?: AxiosRequestConfig) =>
      inst.patch(url, data, cfg) as unknown as Promise<T>,
  };
}

export const http: HttpClient = wrap(createHttp(config.apiBaseUrl));
export const llmHttp: HttpClient = wrap(createHttp(`${config.apiBaseUrl}/apiv2/llm/v1`));

export function asData<T>(p: Promise<unknown>): Promise<T> {
  return p as Promise<T>;
}
