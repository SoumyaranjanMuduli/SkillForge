export interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  runPython: (code: string) => unknown
  loadPackage: (packages: string | string[]) => Promise<void>
  globals: {
    get: (name: string) => unknown
    set: (name: string, value: unknown) => void
  }
  FS?: {
    writeFile: (path: string, data: string | Uint8Array) => void
    readFile: (path: string, opts?: { encoding?: string }) => string | Uint8Array
  }
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
    pyodide?: PyodideInterface
  }
}
export {}
