import React, { useEffect, useRef, useState } from 'react'
import { Quote, Eye, Edit3, Trash2, BookmarkCheck, FileText, ExternalLink } from 'lucide-react'
import type { Snippet } from '../types'
import { db } from '../db/database'

interface Props { bookId: string; currentPage: number; onJumpToPage: (page: number) => void; snippets: Snippet[]; onSnippetsChanged: () => void }

function renderMd(text: string, onJump: (p: number) => void): React.ReactNode {
  if (!text.trim()) return <p className="text-sm text-slate-400 italic">No study notes yet. Click "+ Cite Current Page" to start taking page-linked notes.</p>
  return (
    <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
      {text.split('\n').map((line, i) => {
        const parts = line.split(/(\[(?:Page|p\.?)\s*\d+\])/gi)
        const inline = parts.map((p, idx) => {
          const m = p.match(/^\[(?:Page|p\.?)\s*(\d+)\]$/i)
          if (m) return <button key={idx} type="button" onClick={() => onJump(parseInt(m[1], 10))} className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 cursor-pointer transition-colors"><ExternalLink className="w-2.5 h-2.5" />Page {m[1]}</button>
          if (p.startsWith('`') && p.endsWith('`') && p.length >= 2) return <code key={idx} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-amber-700 dark:text-amber-300">{p.slice(1,-1)}</code>
          if (p.startsWith('**') && p.endsWith('**') && p.length >= 4) return <strong key={idx}>{p.slice(2,-2)}</strong>
          return p
        })
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg text-slate-900 dark:text-white pt-2">{inline}</h2>
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-base text-slate-900 dark:text-white pt-2">{inline}</h3>
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm text-slate-900 dark:text-white pt-1">{inline}</h4>
        if (line.startsWith('> ')) return <blockquote key={i} className="pl-3 border-l-2 border-amber-500 text-slate-600 dark:text-slate-400 italic">{inline}</blockquote>
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="flex items-start gap-2 pl-1"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" /><span>{inline}</span></div>
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{inline}</p>
      })}
    </div>
  )
}

export const StudyNotesPanel: React.FC<Props> = ({ bookId, currentPage, onJumpToPage, snippets, onSnippetsChanged }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'snippets'>('notes')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeout = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    db.notes.get(bookId).then(note => { if (mounted) { setContent(note?.content ?? ''); setSaveState('saved') } })
    return () => { mounted = false }
  }, [bookId])

  const persistNote = (nextContent: string) => {
    setSaveState('saving')
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current)
    saveTimeout.current = window.setTimeout(async () => {
      await db.notes.put({ bookId, content: nextContent, updatedAt: Date.now() }); setSaveState('saved')
    }, 300)
  }

  const handleChange = (val: string) => { setContent(val); persistNote(val) }

  const handleCitePage = () => {
    const citation = `[Page ${currentPage}] `
    const el = textareaRef.current
    if (mode === 'preview' || !el) { handleChange(content ? `${content}\n${citation}` : citation); setMode('edit'); return }
    const start = el.selectionStart ?? content.length, end = el.selectionEnd ?? content.length
    const next = content.slice(0, start) + citation + content.slice(end)
    handleChange(next)
    requestAnimationFrame(() => { el.focus(); const pos = start + citation.length; el.setSelectionRange(pos, pos) })
  }

  const tabCls = (active: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${active ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <button onClick={() => setActiveTab('notes')} className={tabCls(activeTab === 'notes')}><FileText className="w-3.5 h-3.5" />Study Notes</button>
          <button onClick={() => setActiveTab('snippets')} className={tabCls(activeTab === 'snippets')}><BookmarkCheck className="w-3.5 h-3.5" />Captures ({snippets.length})</button>
        </div>
        {activeTab === 'notes' && <span className="text-[11px] text-slate-400">{saveState === 'saving' ? 'Saving...' : 'Saved'}</span>}
      </div>

      {activeTab === 'notes' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60">
            <button onClick={handleCitePage} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer">
              <Quote className="w-3.5 h-3.5" />+ Cite Current Page (p.{currentPage})
            </button>
            <div className="flex items-center rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5">
              <button onClick={() => setMode('edit')} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${mode === 'edit' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500'}`}><Edit3 className="w-3 h-3" />Edit</button>
              <button onClick={() => setMode('preview')} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${mode === 'preview' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500'}`}><Eye className="w-3 h-3" />Links</button>
            </div>
          </div>
          {mode === 'edit' ? (
            <textarea ref={textareaRef} value={content} onChange={e => handleChange(e.target.value)} placeholder={`Write Markdown notes here...\nTip: Click "+ Cite Current Page" to insert [Page ${currentPage}] links.`} className="flex-1 w-full p-3.5 resize-none bg-transparent text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed" />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">{renderMd(content, onJumpToPage)}</div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {snippets.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-slate-400">Select text on a PDF page and click <span className="font-semibold text-amber-500">Quick Capture</span> in the toolbar to save key takeaways here.</div>
          ) : snippets.map(s => (
            <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed border-l-2 border-amber-500 pl-2.5">"{s.text}"</p>
              <div className="flex items-center justify-between">
                <button onClick={() => onJumpToPage(s.page)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 hover:bg-amber-200 cursor-pointer"><ExternalLink className="w-2.5 h-2.5" />Page {s.page}</button>
                <button onClick={async () => { await db.snippets.delete(s.id); onSnippetsChanged() }} className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
