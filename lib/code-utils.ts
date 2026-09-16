export function normalizeSqlStarter(value: string) {
  return value.replaceAll('\\n', ' ').replace(/\s+/g, ' ').trim()
}
