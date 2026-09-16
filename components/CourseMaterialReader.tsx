'use client'

import Link from 'next/link'
import { ArrowRight, Check, Copy, List, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CourseSection } from '@/lib/course-library'

type Props = {
  sections: CourseSection[]
  courseTitle: string
  courseSlug: string
}

export default function CourseMaterialReader({ sections, courseTitle, courseSlug }: Props) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const searchable = useMemo(() => sections.map(section => ({ section, text: `${section.title} ${section.blocks.map(block => block.text).join(' ')}`.toLowerCase() })), [sections])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return searchable.filter(item => item.text.includes(q)).map(item => item.section)
  }, [query, searchable, sections])

  const copyCode = async (id: string, text: string) => {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied(null), 1400)
    } catch {
      // Clipboard permissions can be denied by the browser.
    }
  }

  const firstVisibleId = visible[0]?.id

  return (
    <div className="course-reader">
      <aside className="course-reader-topics">
        <div className="course-rail-card">
          <div className="course-rail-heading">
            <span className="course-rail-icon"><List size={16} /></span>
            <span>Course topics</span>
            <span className="course-topic-count">{sections.length}</span>
          </div>

          <label className="course-topic-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find a topic..."
              aria-label="Find a topic"
            />
          </label>

          <nav className="course-topic-list" aria-label="Course topics">
            {visible.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`course-topic-link ${section.id === firstVisibleId ? 'course-topic-link-active' : ''}`}
              >
                <span className="course-topic-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{section.title}</span>
              </a>
            ))}
            {visible.length === 0 && <p className="course-empty">No matching topics.</p>}
          </nav>
        </div>
      </aside>

      <main className="course-reader-content" aria-label={`${courseTitle} study material`}>
        <details className="course-mobile-topics">
          <summary>
            <span className="course-mobile-summary-left"><List size={17} /> Course topics</span>
            <span>{sections.length} topics</span>
          </summary>
          <div className="course-mobile-topic-body">
            <label className="course-topic-search">
              <Search size={15} aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Find a topic..."
                aria-label="Find a topic"
              />
            </label>
            <nav className="course-mobile-topic-list" aria-label="Mobile course topics">
              {visible.map((section, index) => (
                <a key={section.id} href={`#${section.id}`} className="course-topic-link">
                  <span className="course-topic-number">{String(index + 1).padStart(2, '0')}</span>
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </details>

        <div className="course-mobile-progress">
          <span><Sparkles size={15} /> Self-paced study</span>
          <strong>{sections.length} topics</strong>
        </div>

        {visible.map((section, sectionIndex) => (
          <section id={section.id} key={section.id} className="course-lesson-card">
            <div className="course-lesson-heading">
              <div className="course-lesson-number">{String(sectionIndex + 1).padStart(2, '0')}</div>
              <div className="min-w-0">
                <div className="course-kicker">Lesson {sectionIndex + 1}</div>
                <h2>{section.title}</h2>
              </div>
            </div>

            <div className="course-blocks">
              {section.blocks.map((block, index) => {
                if (block.type === 'subheading') {
                  return <h3 key={index}>{block.text}</h3>
                }

                if (block.type === 'code') {
                  const id = `${section.id}-${index}`
                  return (
                    <div key={index} className="course-code-block">
                      <button
                        type="button"
                        onClick={() => void copyCode(id, block.text)}
                        className="course-copy-button"
                        aria-label={copied === id ? 'Code copied' : 'Copy code'}
                      >
                        {copied === id ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copied === id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <pre><code>{block.text}</code></pre>
                    </div>
                  )
                }

                return <p key={index}>{block.text}</p>
              })}
            </div>
          </section>
        ))}

        {visible.length === 0 && (
          <div className="course-no-results">
            No material matches “{query}”. Try another topic or clear the search.
          </div>
        )}

        <div className="course-reader-next">
          <div>
            <span>Keep learning</span>
            <strong>Practice what you studied</strong>
          </div>
          <Link href={`/practice?course=${encodeURIComponent(courseSlug)}`} className="btn-primary">
            Start practice <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <aside className="course-reader-rail">
        <div className="course-rail-card course-progress-card">
          <div className="course-progress-top">
            <span>Course progress</span>
            <strong>Study</strong>
          </div>
          <div className="course-progress-bar"><span /></div>
          <p>Work through each topic at your own pace.</p>
        </div>

        <div className="course-rail-card">
          <div className="course-rail-heading"><span className="course-rail-icon"><List size={16} /></span><span>In this course</span></div>
          <div className="course-mini-list">
            {sections.slice(0, 6).map((section, index) => (
              <a href={`#${section.id}`} key={section.id}>
                <span>{index + 1}</span>
                <span>{section.title}</span>
              </a>
            ))}
            {sections.length > 6 && <span className="course-more-topics">+ {sections.length - 6} more topics</span>}
          </div>
        </div>

        <div className="course-rail-card course-practice-card">
          <span className="course-practice-icon"><Sparkles size={18} /></span>
          <h3>Related practice</h3>
          <p>Test your knowledge with hands-on questions for this course.</p>
          <Link href={`/practice?course=${encodeURIComponent(courseSlug)}`} className="btn-primary w-full">
            Start practice <ArrowRight size={15} />
          </Link>
        </div>
      </aside>
    </div>
  )
}
