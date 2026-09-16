declare module 'alasql' {
  type AlasqlFn = ((query: string, params?: unknown[] | Record<string, unknown>) => unknown) & {
    promise?: (...args: unknown[]) => Promise<unknown>
  }
  const alasql: AlasqlFn
  export default alasql
}
