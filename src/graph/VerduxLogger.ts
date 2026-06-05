/**
 * Pluggable diagnostics sink for a graph. Pass it to `createGraph({ logger })`
 * to redirect verdux's `[verdux] … threw` diagnostics (the contained effect-op
 * skips and the fail-fast graph halt) somewhere other than the console — a real
 * logger, a monitoring sink, etc.
 *
 * Every method is **optional** and falls back to the matching `console` method,
 * so a partial logger is valid and a `console`-shaped object (including `console`
 * itself) satisfies the interface. Keeping methods optional also means verdux can
 * call a new one in a future version without breaking loggers that predate it.
 */
export interface VerduxLogger {
   error?: (message: string, error?: unknown) => void
   // Future optional methods (warn?, info?, …) will each fall back to console.
}

/**
 * Emit an error-level diagnostic through the configured logger, falling back to
 * `console.error` when no logger (or no `error` method) was provided. Internal —
 * this is the single seam every diagnostic site routes through.
 */
export const reportError = (
   logger: VerduxLogger | undefined,
   message: string,
   error: unknown
): void => {
   if (logger?.error) logger.error(message, error)
   else console.error(message, error)
}
