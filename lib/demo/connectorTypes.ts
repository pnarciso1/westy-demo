import type { Connector } from "@westy/shared";

/**
 * Temporary demo-only connector discovery types. These interfaces should
 * ultimately come from @westy/shared once the product contract for connector
 * discovery, provider metadata, and auth capabilities is settled.
 *
 * TODO: Replace this file with `import type { ConnectorOption } from "@westy/shared"`
 * once the interface is added there.
 */
export interface ConnectorOption {
  id: string;
  connectorType: Connector["type"];
  vendor: string;
}
