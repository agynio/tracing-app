// Graph-related DTOs
export interface TemplateSchema {
  name: string;
  title: string;
  kind: string;
  description?: string;
  sourcePorts: Record<string, unknown> | string[] | undefined;
  targetPorts: Record<string, unknown> | string[] | undefined;
  capabilities?: {
    pausable?: boolean;
    provisionable?: boolean;
    dynamicConfigurable?: boolean;
    staticConfigurable?: boolean;
  };
  staticConfigSchema?: unknown;
}
