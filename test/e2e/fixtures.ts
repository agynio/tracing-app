import { test as base } from '@playwright/test';

export const test = base.extend<Record<string, never>>({});
export { expect } from '@playwright/test';
export const isMocked = !process.env.E2E_BASE_URL;
