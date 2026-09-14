/** Simulated network delay — every WestyClient method awaits this, so the
 * demo's loading states are real, not skipped. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
