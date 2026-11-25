import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ArrowLeft, ChevronLeft, ChevronRight, PanelLeft, PanelRight, Bookmark as BookmarkIcon, Sun, Moon, BookOpen, ZoomIn, ZoomOut, Maximize2, MoveHorizontal, Highlighter, Search, FileText, ListTree, X } from 'lucide-react'
import type { Book, Bookmark, OutlineNode, ReadingMode, Snippet, ZoomMode } from '../types'
import { db, updateReadingProgress } from '../db/database'
import { extractPdfOutline, loadPdfFromBlob } from '../utils/pdf'
import { PdfPageCanvas } from './PdfPageCanvas'
import { ReaderSidebar, type SidebarTab } from './ReaderSidebar'
import { StudyNotesPanel } from './StudyNotesPanel'

interface Props { book: Book; onBack: () => void }

export const PdfReader: React.FC<Props> = ({ book, onBack }) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(book.lastReadPage || 1)
  const [pageInput, setPageInput] = useState(String(book.lastReadPage || 1))
  const [totalPages, setTotalPages] = useState(book.totalPages || 1)
  const [outline, setOutline] = useState<OutlineNode[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [readingMode, setReadingMode] = useState<ReadingMode>('light')
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width')
  const [customScale, setCustomScale] = useState(1.2)
  const [effectiveScale, setEffectiveScale] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLeft, setShowLeft] = useState(window.innerWidth >= 1024)
  const [leftTab, setLeftTab] = useState<SidebarTab>('outline')
  const [showRight, setShowRight] = useState(window.innerWidth >= 1280)
  const [rightWidth, setRightWidth] = useState(360)
  const [mobileBarsVisible, setMobileBarsVisible] = useState(true)
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'sidebar' | 'notes'>('none')
  const [selectedText, setSelectedText] = useState('')
  const [captureToast, setCaptureToast] = useState<string | null>(null)
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 700 })
  const touchStart = useRef<{ x: number; y: number; dist: number | null }>({ x: 0, y: 0, dist: null })

  const loadStudyData = useCallback(async () => {
    const [bms, snips] = await Promise.all([db.bookmarks.where('bookId').equals(book.id).sortBy('page'), db.snippets.where('bookId').equals(book.id).sortBy('page')])
    setBookmarks(bms); setSnippets(snips)
  }, [book.id])

  useEffect(() => {
    let mounted = true; let loadedPdf: PDFDocumentProxy | null = null
    const init = async () => {
      setLoading(true); setError(null)
      try {
        const fileRec = await db.bookFiles.get(book.id)
        if (!fileRec) throw new Error('PDF binary not found in local storage. Re-import the PDF file.')
        loadedPdf = await loadPdfFromBlob(fileRec.blob)
        if (!mounted) { await loadedPdf.cleanup(); return }
        setPdf(loadedPdf); setTotalPages(loadedPdf.numPages)
        const startPage = Math.max(1, Math.min(book.lastReadPage || 1, loadedPdf.numPages))
        setCurrentPage(startPage); setPageInput(String(startPage))
        const o = await extractPdfOutline(loadedPdf)
        if (mounted) setOutline(o)
        await loadStudyData()
      } catch (err) { if (mounted) setError(err instanceof Error ? err.message : 'Failed to open PDF.') }
      finally { if (mounted) setLoading(false) }
    }
    init()
    return () => { mounted = false; if (loadedPdf) loadedPdf.cleanup().catch(() => {}) }
  }, [book.id, book.lastReadPage, loadStudyData])

  useEffect(() => {
    const el = canvasViewportRef.current; if (!el) return
    const ro = new ResizeObserver(entries => { for (const e of entries) setViewportSize({ width: e.contentRect.width, height: e.contentRect.height }) })
    ro.observe(el); return () => ro.disconnect()
  }, [loading])

  const goToPage = useCallback((page: number) => {
    const target = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(target); setPageInput(String(target))
    updateReadingProgress(book.id, target, totalPages)
    canvasViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [book.id, totalPages])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if (window.innerWidth < 1024) setMobileDrawer('sidebar'); else setShowLeft(true)
        setLeftTab('search'); setTimeout(() => searchInputRef.current?.focus(), 60); return
      }
      if (isTyping) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(currentPage - 1) }
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToPage(currentPage + 1) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentPage, goToPage])

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection(); const text = sel?.toString().trim() ?? ''
      if (text.length > 2 && canvasViewportRef.current?.contains(sel?.anchorNode?.nodeType === Node.TEXT_NODE ? sel?.anchorNode?.parentElement : sel?.anchorNode as Node)) { setSelectedText(text); return }
      setSelectedText('')
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const handleQuickCapture = async () => {
    if (!selectedText) return
    await db.snippets.put({ id: crypto.randomUUID(), bookId: book.id, page: currentPage, text: selectedText, createdAt: Date.now() })
    window.getSelection()?.removeAllRanges(); setSelectedText(''); await loadStudyData()
    setCaptureToast(`Captured from Page ${currentPage}`); setTimeout(() => setCaptureToast(null), 2400)
  }

  const isBookmarked = bookmarks.some(b => b.page === currentPage)
  const handleToggleBookmark = async () => {
    const existing = bookmarks.find(b => b.page === currentPage)
    if (existing) await db.bookmarks.delete(existing.id)
    else await db.bookmarks.put({ id: crypto.randomUUID(), bookId: book.id, page: currentPage, label: `Page ${currentPage}`, createdAt: Date.now() })
    await loadStudyData()
  }

  const handleResizeMD = (e: React.MouseEvent) => {
    e.preventDefault(); const startX = e.clientX, startW = rightWidth
    const onMM = (ev: MouseEvent) => setRightWidth(Math.max(260, Math.min(640, startW + (startX - ev.clientX))))
    const onMU = () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU) }
    window.addEventListener('mousemove', onMM); window.addEventListener('mouseup', onMU)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: null }
    else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; touchStart.current = { x: 0, y: 0, dist: Math.hypot(dx, dy) } }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy), ratio = dist / touchStart.current.dist
      if (Math.abs(ratio - 1) > 0.06) { setZoomMode('custom'); setCustomScale(prev => Math.max(0.5, Math.min(3.5, Number((prev * ratio).toFixed(2))))); touchStart.current.dist = dist }
    }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1 && touchStart.current.dist === null) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x, dy = e.changedTouches[0].clientY - touchStart.current.y
      if (Math.abs(dx) > 65 && Math.abs(dy) < 45 && !window.getSelection()?.toString()) { if (dx < 0) goToPage(currentPage + 1); else goToPage(currentPage - 1) }
    }
  }

  const readerBg = readingMode === 'dark' ? 'bg-slate-950' : readingMode === 'sepia' ? 'bg-amber-50/90 dark:bg-stone-900' : 'bg-slate-200/80 dark:bg-slate-900'

  const sidebarProps = { pdf: pdf!, bookId: book.id, outline, currentPage, totalPages, activeTab: leftTab, onTabChange: setLeftTab, onJumpToPage: goToPage, bookmarks, onBookmarksChanged: loadStudyData, searchQuery, onSearchQueryChange: setSearchQuery, searchInputRef }
  const notesProps = { bookId: book.id, currentPage, onJumpToPage: (p: number) => { goToPage(p); setMobileDrawer('none') }, snippets, onSnippetsChanged: loadStudyData }

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
      <header className={`z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 transition-all ${!mobileBarsVisible ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={onBack} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Library</span></button>
          <button onClick={() => setShowLeft(v => !v)} className={`hidden lg:inline-flex p-1.5 rounded-xl transition-colors cursor-pointer ${showLeft ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}><PanelLeft className="w-4 h-4" /></button>
          <h1 className="text-sm font-semibold truncate max-w-[140px] sm:max-w-[260px] text-slate-800 dark:text-slate-100 ml-1">{book.title}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <form onSubmit={e => { e.preventDefault(); const p = parseInt(pageInput, 10); if (!isNaN(p)) goToPage(p) }} className="flex items-center gap-1 text-xs">
            <input type="text" inputMode="numeric" value={pageInput} onChange={e => setPageInput(e.target.value)} onBlur={() => { const p = parseInt(pageInput, 10); if (!isNaN(p)) goToPage(p); else setPageInput(String(currentPage)) }} className="w-11 text-center py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <span className="text-slate-400">/ {totalPages}</span>
          </form>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1">
          {selectedText && <button onClick={handleQuickCapture} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm animate-pulse cursor-pointer"><Highlighter className="w-3.5 h-3.5" /><span className="hidden sm:inline">Quick Capture</span></button>}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 mr-1">
            <button onClick={() => { setZoomMode('custom'); setCustomScale(Math.max(0.4, Number((effectiveScale - 0.15).toFixed(2)))) }} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-[11px] font-medium px-1.5 min-w-[42px] text-center">{Math.round(effectiveScale * 100)}%</span>
            <button onClick={() => { setZoomMode('custom'); setCustomScale(Math.min(3.5, Number((effectiveScale + 0.15).toFixed(2)))) }} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button onClick={() => setZoomMode('fit-width')} className={`p-1.5 rounded-lg cursor-pointer ${zoomMode === 'fit-width' ? 'bg-white dark:bg-slate-700 text-amber-500' : 'text-slate-500'}`} title="Fit Width"><MoveHorizontal className="w-3.5 h-3.5" /></button>
            <button onClick={() => setZoomMode('fit-page')} className={`p-1.5 rounded-lg cursor-pointer ${zoomMode === 'fit-page' ? 'bg-white dark:bg-slate-700 text-amber-500' : 'text-slate-500'}`} title="Fit Page"><Maximize2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="hidden sm:flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
            <button onClick={() => setReadingMode('light')} className={`p-1.5 rounded-lg cursor-pointer ${readingMode === 'light' ? 'bg-white dark:bg-slate-700 text-amber-500' : 'text-slate-500'}`} title="Light"><Sun className="w-3.5 h-3.5" /></button>
            <button onClick={() => setReadingMode('sepia')} className={`p-1.5 rounded-lg cursor-pointer ${readingMode === 'sepia' ? 'bg-amber-100 text-amber-800' : 'text-slate-500'}`} title="Sepia"><BookOpen className="w-3.5 h-3.5" /></button>
            <button onClick={() => setReadingMode('dark')} className={`p-1.5 rounded-lg cursor-pointer ${readingMode === 'dark' ? 'bg-slate-900 text-amber-400' : 'text-slate-500'}`} title="Dark"><Moon className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={handleToggleBookmark} className={`p-1.5 rounded-xl transition-colors cursor-pointer ${isBookmarked ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}><BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} /></button>
          <button onClick={() => setShowRight(v => !v)} className={`hidden lg:inline-flex p-1.5 rounded-xl transition-colors cursor-pointer ${showRight ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}><PanelRight className="w-4 h-4" /></button>
        </div>
      </header>

      {captureToast && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-amber-400 text-xs font-semibold shadow-lg">{captureToast}</div>}

      <div className="flex-1 flex min-h-0 relative">
        {showLeft && pdf && <aside className="hidden lg:block w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 h-full overflow-hidden"><ReaderSidebar {...sidebarProps} /></aside>}
        <main ref={canvasViewportRef} onClick={e => { if (window.innerWidth < 1024 && !window.getSelection()?.toString() && (e.target as HTMLElement).tagName !== 'BUTTON') setMobileBarsVisible(v => !v) }}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          className={`flex-1 overflow-auto p-3 sm:p-6 transition-colors reader-mode-${readingMode} ${readerBg}`}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading PDF from IndexedDB...</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <p className="text-sm text-rose-500 font-medium mb-4">{error}</p>
              <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium">Return to Library</button>
            </div>
          ) : pdf ? (
            <PdfPageCanvas pdf={pdf} pageNumber={currentPage} zoomMode={zoomMode} customScale={customScale} containerWidth={viewportSize.width} containerHeight={viewportSize.height} searchQuery={searchQuery} onEffectiveScaleChange={setEffectiveScale} />
          ) : null}
        </main>
        {showRight && (
          <>
            <div onMouseDown={handleResizeMD} className="hidden lg:block w-1.5 cursor-col-resize bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 transition-colors shrink-0" />
            <aside className="hidden lg:block shrink-0 h-full overflow-hidden border-l border-slate-200 dark:border-slate-800" style={{ width: rightWidth }}><StudyNotesPanel {...notesProps} onJumpToPage={goToPage} /></aside>
          </>
        )}
      </div>

      {mobileBarsVisible && (
        <nav className="lg:hidden z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
          <button onClick={() => { setLeftTab('outline'); setMobileDrawer('sidebar') }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300"><ListTree className="w-4 h-4" /><span>Contents</span></button>
          <button onClick={() => { setLeftTab('search'); setMobileDrawer('sidebar') }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300"><Search className="w-4 h-4" /><span>Search</span></button>
          <button onClick={() => setMobileDrawer('notes')} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold"><FileText className="w-4 h-4" /><span>Notes</span></button>
          <button onClick={() => setReadingMode(m => m === 'light' ? 'sepia' : m === 'sepia' ? 'dark' : 'light')} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300">
            {readingMode === 'dark' ? <Moon className="w-4 h-4" /> : readingMode === 'sepia' ? <BookOpen className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span className="capitalize">{readingMode}</span>
          </button>
        </nav>
      )}

      {mobileDrawer !== 'none' && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end" onClick={() => setMobileDrawer('none')}>
          <div className="h-[78vh] rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />
              <button onClick={() => setMobileDrawer('none')} className="p-1 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0">
              {mobileDrawer === 'sidebar' && pdf ? <ReaderSidebar {...sidebarProps} onJumpToPage={p => { goToPage(p); setMobileDrawer('none') }} /> : <StudyNotesPanel {...notesProps} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
