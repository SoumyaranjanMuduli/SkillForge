import Link from 'next/link'
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Cloud, Code2, Database, FileSpreadsheet, Sigma } from 'lucide-react'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import CourseMaterialReader from '@/components/CourseMaterialReader'
import { courseLibrary, getCourseMaterial } from '@/lib/course-library'

export const dynamic = 'force-static'
export const dynamicParams = false

const icons = {
  sql: Database,
  excel: FileSpreadsheet,
  analytics: BarChart3,
  pandas: BarChart3,
  numpy: Sigma,
  python: Code2,
  aws: Cloud,
} as const

const themes = {
  sql: 'course-theme-sql',
  excel: 'course-theme-excel',
  analytics: 'course-theme-analytics',
  pandas: 'course-theme-pandas',
  numpy: 'course-theme-numpy',
  python: 'course-theme-python',
  aws: 'course-theme-aws',
} as const

export function generateStaticParams() {
  return courseLibrary.map(course => ({ slug: course.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = courseLibrary.find(item => item.slug === slug)
  return {
    title: course ? `${course.title} | SkillForge` : 'Study Material | SkillForge',
    description: course?.description,
  }
}

export default async function CourseMaterialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await getCourseMaterial(slug)
  if (!course) notFound()

  const Icon = icons[course.icon as keyof typeof icons] ?? BarChart3
  const theme = themes[course.icon as keyof typeof themes] ?? 'course-theme-analytics'
  const firstTopic = course.sections[0]

  return (
    <AppShell>
      <div className="course-page">
        <Link href="/courses" className="course-back-link">
          <ArrowLeft size={15} /> Back to courses
        </Link>

        <header className={`course-hero ${theme}`}>
          <div className="course-hero-glow" />
          <div className="course-hero-main">
            <div className="course-logo-box"><Icon size={42} strokeWidth={2} /></div>
            <div className="course-hero-copy">
              <span className="course-hero-badge"><BookOpen size={14} /> Web study course</span>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
              <div className="course-hero-meta">
                <span><BookOpen size={15} /> {course.sections.length} topics</span>
                <span><Code2 size={15} /> Code examples</span>
                <span><ArrowRight size={15} /> Hands-on practice</span>
                <span><Sigma size={15} /> Beginner to advanced</span>
              </div>
            </div>
          </div>

          <div className="course-hero-action">
            <a href={firstTopic ? `#${firstTopic.id}` : '#'} className="course-continue">
              <span className="course-play">▶</span>
              Continue learning
            </a>
            <div className="course-progress-mini">
              <div className="course-progress-mini-top"><span>Your course</span><strong>0%</strong></div>
              <div className="course-progress-bar"><span /></div>
              <small>Start with topic 01</small>
            </div>
          </div>
        </header>

        <CourseMaterialReader
          sections={course.sections}
          courseTitle={course.title}
          courseSlug={course.slug}
        />

        <div className="course-bottom-action">
          <Link href="/courses" className="btn-secondary">Choose another course <ArrowRight size={15} /></Link>
        </div>
      </div>
    </AppShell>
  )
}
