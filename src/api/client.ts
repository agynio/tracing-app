import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { NotificationsGateway } from '@/gen/agynio/api/gateway/v1/notifications_pb';
import { OrganizationsGateway } from '@/gen/agynio/api/gateway/v1/organizations_pb';
import { TracingGateway } from '@/gen/agynio/api/gateway/v1/tracing_pb';
import { config } from '@/config';

const transport = createConnectTransport({
  baseUrl: config.apiBaseUrl,
});

export const tracingClient = createClient(TracingGateway, transport);
export const notificationsClient = createClient(NotificationsGateway, transport);
export const organizationsClient = createClient(OrganizationsGateway, transport);
