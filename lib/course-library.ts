import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { courseLibrary } from './course-catalog'

export { courseLibrary }

export type CourseBlock = {
  type: 'text' | 'code' | 'subheading'
  text: string
}

export type CourseSection = {
  id: string
  title: string
  blocks: CourseBlock[]
}

export type CourseMaterial = {
  slug: string
  title: string
  description: string
  icon: string
  sourceFile: string
  sections: CourseSection[]
}

export async function getCourseMaterial(slug: string): Promise<CourseMaterial | null> {
  const meta = courseLibrary.find(course => course.slug === slug)
  if (!meta) return null

  const file = path.join(process.cwd(), 'data', 'course-library', `${slug}.json`)

  try {
    const raw = await readFile(file, 'utf8')
    const material = JSON.parse(raw) as CourseMaterial
    if (!Array.isArray(material.sections)) return null
    return material
  } catch {
    console.error('[course-library] failed to load course material')
    return null
  }
}
