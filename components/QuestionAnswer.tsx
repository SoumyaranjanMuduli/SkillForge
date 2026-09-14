'use client'

import type { Question } from '@/lib/types'
import { CodeWorkspace } from '@/components/CodeWorkspace'

type Props = { q: Question; value: string; onChange: (v: string) => void }

const CODE_TYPES = new Set(['sql', 'python', 'excel', 'code'])

// Grading (lib/grading.ts) does an exact, case/space-normalized string match against the
// answer key for mcq/true_false, and splits a comma-joined list for multi_select. These UI
// choices must produce exactly that shape, or a correct click would be graded wrong.
export function QuestionAnswer({ q, value, onChange }: Props) {
  if (CODE_TYPES.has(q.questionType)) {
    return <CodeWorkspace q={q} value={value} onChange={onChange} />
  }

  if (q.questionType === 'mcq') {
    const options = q.choices?.length ? q.choices : []
    return <ChoiceList options={options} multi={false} selected={value ? [value] : []} onChange={(sel) => onChange(sel[0] ?? '')} />
  }

  if (q.questionType === 'true_false') {
    const options = q.choices?.length ? q.choices : ['True', 'False']
    return <ChoiceList options={options} multi={false} selected={value ? [value] : []} onChange={(sel) => onChange(sel[0] ?? '')} />
  }

  if (q.questionType === 'multi_select') {
    const options = q.choices?.length ? q.choices : []
    const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
    return <ChoiceList options={options} multi selected={selected} onChange={(sel) => onChange(sel.join(','))} />
  }

  if (q.questionType === 'numeric') {
    return <div className="mt-8">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Your answer</span>
      <input type="number" inputMode="decimal" className="input max-w-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter a number" />
    </div>
  }

  // text, manual_review, case_study, data_engineering — free-form written response.
  const isReviewType = q.questionType === 'case_study' || q.questionType === 'data_engineering' || q.questionType === 'manual_review'
  return <div className="mt-8">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Your answer</span>
    <textarea
      className={`input font-mono ${isReviewType ? 'min-h-64' : 'min-h-32'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isReviewType ? 'Write your response. This will be reviewed by an admin rather than auto-graded.' : 'Type your answer'}
    />
    {isReviewType && <p className="mt-2 text-xs text-slate-400">This question is graded manually — your score will appear once an admin has reviewed it.</p>}
  </div>
}

function ChoiceList({ options, multi, selected, onChange }: { options: string[]; multi: boolean; selected: string[]; onChange: (selected: string[]) => void }) {
  if (!options.length) {
    return <p className="mt-8 text-sm text-rose-500">This question has no answer choices configured. Please contact an admin.</p>
  }
  function toggle(opt: string) {
    if (multi) {
      onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
    } else {
      onChange([opt])
    }
  }
  return <div className="mt-8 space-y-2.5" role={multi ? 'group' : 'radiogroup'}>
    {options.map((opt, i) => {
      const active = selected.includes(opt)
      return <button
        key={`${opt}-${i}`}
        type="button"
        role={multi ? 'checkbox' : 'radio'}
        aria-checked={active}
        onClick={() => toggle(opt)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${active ? 'border-brand bg-brand/5 font-semibold text-brand' : 'border-line text-slate-600 hover:bg-slate-50'}`}
      >
        <span className={`grid h-4 w-4 flex-shrink-0 place-items-center border ${multi ? 'rounded' : 'rounded-full'} ${active ? 'border-brand bg-brand text-white' : 'border-slate-300'}`}>
          {active && <span className={multi ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 rounded-full bg-white'} />}
        </span>
        {opt}
      </button>
    })}
  </div>
}
