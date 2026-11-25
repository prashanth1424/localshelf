import React, { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ListTree, Grid, Bookmark as BookmarkIcon, Search, ChevronRight, ChevronDown, Trash2, Plus } from 'lucide-react'
import type { Bookmark, OutlineNode, SearchResult } from '../types'
import { searchPdfText } from '../utils/pdf'
import { db } from '../db/database'

export type SidebarTab = 'outline' | 'thumbnails' | 'bookmarks' | 'search'

interface Props { pdf: PDFDocumentProxy; bookId: string; outline: OutlineNode[]; currentPage: number; totalPages: number; activeTab: SidebarTab; onTabChange: (t: SidebarTab) => void; onJumpToPage: (p: number) => void; bookmarks: Bookmark[]; onBookmarksChanged: () => void; searchQuery: string; onSearchQueryChange: (q: string) => void; searchInputRef?: React.RefObject<HTMLInputElement | null> }

const ThumbnailItem: React.FC<{ pdf: PDFDocumentProxy; pageNum: number; isActive: boolean; onClick: () => void }> = ({ pdf, pageNum, isActive, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const itemRef = useRef<HTMLButtonElement>(null)
  const [rendered, setRendered] = useState(false)
  useEffect(() => {
    const el = itemRef.current; if (!el || rendered) return
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return
      observer.disconnect()
      ;(async () => {
        try {
          const page = await pdf.getPage(pageNum)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 140 / base.width })
          const canvas = canvasRef.current; if (!canvas) return
          canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: ctx, viewport, canvas }).promise; setRendered(true) }
          page.cleanup()
        } catch { /* ignore */ }
      })()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pdf, pageNum, rendered])
  return (
    <button ref={itemRef} onClick={onClick} className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${isActive ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
      <canvas ref={canvasRef} className="w-full rounded bg-white shadow-xs min-h-[90px]" />
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{pageNum}</span>
    </button>
  )
}

const OutlineItem: React.FC<{ node: OutlineNode; depth?: number; onJump: (p: number) => void }> = ({ node, depth = 0, onJump }) => {
  const [expanded, setExpanded] = useState(depth < 1)
  return (
    <div>
      <div className="flex items-center gap-1 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
        {node.items.length > 0 ? <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-slate-400 shrink-0">{expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button> : <span className="w-4 shrink-0" />}
        <button onClick={() => node.page && onJump(node.page)} disabled={!node.page} className="flex-1 text-left truncate text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50 cursor-pointer">{node.title}</button>
        {node.page && <span className="text-[10px] text-slate-400 shrink-0 pr-2">{node.page}</span>}
      </div>
      {node.items.length > 0 && expanded && node.items.map((child, idx) => <OutlineItem key={idx} node={child} depth={depth + 1} onJump={onJump} />)}
    </div>
  )
}

export const ReaderSidebar: React.FC<Props> = ({ pdf, bookId, outline, currentPage, totalPages, activeTab, onTabChange, onJumpToPage, bookmarks, onBookmarksChanged, searchQuery, onSearchQueryChange, searchInputRef }) => {
  const [newBmLabel, setNewBmLabel] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchProgress, setSearchProgress] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    await db.bookmarks.put({ id: crypto.randomUUID(), bookId, page: currentPage, label: newBmLabel.trim() || `Page ${currentPage}`, createdAt: Date.now() })
    setNewBmLabel(''); onBookmarksChanged()
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault(); if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true); setSearchProgress(0)
    try { setSearchResults(await searchPdfText(pdf, searchQuery, (c, t) => setSearchProgress(Math.round((c / t) * 100)))) }
    finally { setSearching(false) }
  }

  const tabs: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'outline', icon: <ListTree className="w-4 h-4" />, label: 'Contents' },
    { id: 'thumbnails', icon: <Grid className="w-4 h-4" />, label: 'Pages' },
    { id: 'bookmarks', icon: <BookmarkIcon className="w-4 h-4" />, label: 'Marks' },
    { id: 'search', icon: <Search className="w-4 h-4" />, label: 'Search' },
  ]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)} className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium border-b-2 transition-colors cursor-pointer ${activeTab === t.id ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {activeTab === 'outline' && (outline.length === 0 ? <p className="text-xs text-slate-400 text-center py-8 px-3">This PDF has no internal Table of Contents.</p> : outline.map((n, i) => <OutlineItem key={i} node={n} onJump={onJumpToPage} />))}
        {activeTab === 'thumbnails' && <div className="grid grid-cols-2 gap-2">{Array.from({ length: totalPages }, (_, i) => i + 1).map(p => <ThumbnailItem key={p} pdf={pdf} pageNum={p} isActive={p === currentPage} onClick={() => onJumpToPage(p)} />)}</div>}
        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            <form onSubmit={handleAddBookmark} className="flex gap-1.5">
              <input type="text" value={newBmLabel} onChange={e => setNewBmLabel(e.target.value)} placeholder={`Label p.${currentPage}...`} className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-amber-500 focus:outline-none" />
              <button type="submit" className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0 cursor-pointer"><Plus className="w-4 h-4" /></button>
            </form>
            {bookmarks.length === 0 ? <p className="text-xs text-slate-400 text-center py-6">No bookmarks yet.</p> : (
              <div className="space-y-1.5">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <button onClick={() => onJumpToPage(bm.page)} className="flex-1 text-left min-w-0 cursor-pointer">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{bm.label}</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">Page {bm.page}</div>
                    </button>
                    <button onClick={async () => { await db.bookmarks.delete(bm.id); onBookmarksChanged() }} className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'search' && (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-1.5">
              <input ref={searchInputRef} type="search" value={searchQuery} onChange={e => onSearchQueryChange(e.target.value)} placeholder="Search inside PDF..." className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-amber-500 focus:outline-none" />
              <button type="submit" disabled={searching} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 cursor-pointer">Go</button>
            </form>
            {searching && <div className="text-xs text-slate-500 text-center py-2">Scanning pages... {searchProgress}%</div>}
            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 px-1">Found on {searchResults.length} page(s)</div>
                {searchResults.map(r => (
                  <button key={r.page} onClick={() => onJumpToPage(r.page)} className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1"><span>Page {r.page}</span><span>{r.matchCount} match(es)</span></div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">{r.snippet}</p>
                  </button>
                ))}
              </div>
            )}
            {!searching && searchQuery && searchResults.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No matches. Press Go to search.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
