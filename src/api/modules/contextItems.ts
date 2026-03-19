import { getContextItems } from '@/api/mock-data/store';
import type { ContextItem } from '@/api/types/agents';

export const contextItems = {
  async getMany(ids: string[]): Promise<ContextItem[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    return getContextItems(ids);
  },
};
