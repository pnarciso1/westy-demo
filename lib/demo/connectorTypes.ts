import type { Connector as SharedConnector } from "@westy/shared";

/**
 * Temporary demo-only connector discovery types. These interfaces should
 * ultimately come from @westy/shared once the product contract for connector
 * discovery, provider metadata, auth capabilities, and option-backed
 * connectors is settled.
 *
 * TODO: Replace this file with `import type { Connector, ConnectorOption } from "@westy/shared"`
 * once both interfaces exist there.
 */
export interface ConnectorOption {
  id: string;
  connectorType: SharedConnector["type"];
  vendor: string;
}

export interface Connector extends SharedConnector {
  connectorOptionId: ConnectorOption["id"];
}
