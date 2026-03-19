import type { TemplateSchema } from '@/api/types/graph';
import { buildTemplates } from './store';

export const mockGraphTemplates: TemplateSchema[] = buildTemplates();
