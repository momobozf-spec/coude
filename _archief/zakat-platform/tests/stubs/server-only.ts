/**
 * Stand-in for the `server-only` marker package.
 *
 * The real module throws on import outside a React Server Component, which is
 * the point of it — but Node-environment tests import the server services
 * deliberately. Next resolves `server-only` to an empty module under its
 * `react-server` condition; `vitest.config.ts` aliases it to this file for the
 * same effect. The marker keeps doing its job in the application build.
 */
export {}
