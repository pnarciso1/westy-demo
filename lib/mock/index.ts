export { MockWestyClient } from "./client";
export * from "./seed";

import { MockWestyClient } from "./client";

/**
 * A single shared instance for the whole app session — mirrors how a real
 * client would be instantiated once (e.g. in a context provider) rather
 * than per-component. Import this rather than `new MockWestyClient()`
 * directly, so every screen shares the same in-memory state and the
 * rep-only reset control actually resets what everyone's looking at.
 */
export const mockWestyClient = new MockWestyClient();
