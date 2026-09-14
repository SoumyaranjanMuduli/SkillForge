import { BarChart3, Code2, Database, FileSpreadsheet, type LucideIcon } from 'lucide-react'

export function programVisual(name: string): { Icon: LucideIcon; bg: string; text: string; bar: string } {
  const n = name.toLowerCase()
  if (n.includes('sql')) return { Icon: Database, bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' }
  if (n.includes('python')) return { Icon: Code2, bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' }
  if (n.includes('excel')) return { Icon: FileSpreadsheet, bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' }
  return { Icon: BarChart3, bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' }
}

export function difficultyBadgeClass(d?: string) {
  if (d === 'easy') return 'badge-easy'
  if (d === 'hard') return 'badge-hard'
  return 'badge-medium'
}
