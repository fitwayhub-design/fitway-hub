/**
 * Production-safe logger.
 * In production builds all methods are no-ops — nothing leaks to the browser console.
 * In development, output goes through normally.
 */
const IS_DEV = import.meta.env.DEV;

const noop = () => {};

export const logger = {
  log:   IS_DEV ? (...a: unknown[]) => console.log(...a)   : noop,
  warn:  IS_DEV ? (...a: unknown[]) => console.warn(...a)  : noop,
  error: IS_DEV ? (...a: unknown[]) => console.error(...a) : noop,
  info:  IS_DEV ? (...a: unknown[]) => console.info(...a)  : noop,
};
