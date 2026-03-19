import type { TemplateSchema } from '@/api/types/graph';
import { buildTemplates } from './store.ts';

export const mockGraphTemplates: TemplateSchema[] = buildTemplates();
