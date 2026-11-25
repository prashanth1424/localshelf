import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Plus, Search, Settings, LayoutGrid, List, Heart, MoreVertical, Upload, WifiOff, CheckCircle2, Clock, Sparkles, FileText } from 'lucide-react'
import { DEFAULT_CATEGORIES, type Book, type SortOption, type ViewMode } from '../types'
import { db, formatBytes, importPdfFile } from '../db/database'
import { BookMetadataModal } from './BookMetadataModal'

interface Props { onOpenBook: (b: Book) => void; onOpenSettings: () => void; refreshTrigger: number }

export const LibraryDashboard: React.FC<Props> = ({ onOpenBook, onOpenSettings, refreshTrigger }) => {
  const [books, setBooks] = useState<Book[]>([])
  const [studyIndex, setStudyIndex] = useState<Map<string, string>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState<{ current: number; total: number; name: string } | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadLibrary = useCallback(async () => {
    const [allBooks, bms, snips, notes] = await Promise.all([db.books.toArray(), db.bookmarks.toArray(), db.snippets.toArray(), db.notes.toArray()])
    setBooks(allBooks)
    const map = new Map<string, string>()
    const app = (id: string, text: string) => map.set(id, `${map.get(id) ?? ''} ${text.toLowerCase()}`)
    bms.forEach(b => app(b.bookId, b.label))
    snips.forEach(s => app(s.bookId, `${s.text} ${s.note ?? ''}`))
    notes.forEach(n => app(n.bookId, n.content))
    setStudyIndex(map)
  }, [])

  useEffect(() => { loadLibrary() }, [loadLibrary, refreshTrigger])
  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const handleFilesImport = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) return
    const cat = selectedCategory !== 'All' && selectedCategory !== 'Favorites' ? selectedCategory : 'Reading List'
    for (let i = 0; i < pdfs.length; i++) {
      setImporting({ current: i + 1, total: pdfs.length, name: pdfs[i].name })
      try { await importPdfFile(pdfs[i], cat) } catch (e) { console.error(e) }
    }
    setImporting(null); await loadLibrary()
  }

  const toggleFavorite = async (e: React.MouseEvent, book: Book) => {
    e.stopPropagation(); await db.books.update(book.id, { favorite: !book.favorite }); await loadLibrary()
  }

  const categories = useMemo(() => {
    const s = new Set<string>(['All', 'Favorites', ...DEFAULT_CATEGORIES])
    books.forEach(b => { if (b.category) s.add(b.category) })
    return Array.from(s)
  }, [books])

  const continueReading = useMemo(() =>
    [...books].filter(b => b.lastReadAt !== undefined).sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0)).slice(0, 3)
  , [books])

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return books.filter(book => {
      if (selectedCategory === 'Favorites' && !book.favorite) return false
      if (selectedCategory !== 'All' && selectedCategory !== 'Favorites' && book.category !== selectedCategory) return false
      if (!q) return true
      return book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q) ||
        book.tags.some(t => t.toLowerCase().includes(q)) || (studyIndex.get(book.id) ?? '').includes(q)
    }).sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title)
        case 'progress': return b.readingProgress - a.readingProgress
        case 'added': return b.dateAdded - a.dateAdded
        default: return (b.lastReadAt ?? b.dateAdded) - (a.lastReadAt ?? a.dateAdded)
      }
    })
  }, [books, selectedCategory, searchQuery, sortBy, studyIndex])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950"
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={e => { if (e.currentTarget === e.target) setIsDragging(false) }}
      onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) handleFilesImport(e.dataTransfer.files) }}>

      {isDragging && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="border-2 border-dashed border-amber-400 rounded-3xl p-10 text-center max-w-md bg-slate-900/90 text-white">
            <Upload className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-xl font-semibold">Drop PDFs to Import</p>
            <p className="text-sm text-slate-300 mt-1">Stored 100% locally in IndexedDB.</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-500 flex items-center justify-center text-amber-400 dark:text-slate-950">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">LocalShelf</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'}`}>
                  {isOnline ? <><CheckCircle2 className="w-3 h-3" />Offline Ready</> : <><WifiOff className="w-3 h-3" />Offline Mode</>}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Personal Offline PDF Library & Study Reader</p>
            </div>
          </div>
          <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search titles, tags, notes, bookmarks..." className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 text-sm focus:outline-none transition-all" />
          </div>
          <div className="order-2 sm:order-3 flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple onChange={e => { if (e.target.files?.length) handleFilesImport(e.target.files); e.target.value = '' }} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /><span>Import PDFs</span>
            </button>
            <button onClick={onOpenSettings} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {importing && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm"><span className="font-semibold">Importing {importing.current}/{importing.total}:</span> {importing.name}</span>
          </div>
        )}

        {continueReading.length > 0 && !searchQuery && selectedCategory === 'All' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Clock className="w-4 h-4 text-amber-500" /><h2>Continue Reading</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {continueReading.map(book => (
                <div key={book.id} onClick={() => onOpenBook(book)} className="group flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 shadow-sm hover:shadow-md transition-all cursor-pointer">
                  <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                    {book.coverDataUrl ? <img src={book.coverDataUrl} alt={book.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><FileText className="w-6 h-6" /></div>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-amber-500 transition-colors">{book.title}</h3>
                    <p className="text-xs text-slate-500">Page {book.lastReadPage} of {book.totalPages} ({book.readingProgress}%)</p>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${book.readingProgress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === cat ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{cat}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="recent">Recently Read</option><option value="title">Title A-Z</option>
                <option value="progress">Progress</option><option value="added">Date Added</option>
              </select>
              <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-amber-500' : 'text-slate-400'}`} aria-label="Grid"><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-800 text-amber-500' : 'text-slate-400'}`} aria-label="List"><List className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {books.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-12 text-center max-w-xl mx-auto my-10">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Offline Shelf is Empty</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">Drag and drop PDF books or textbooks here, or click Import PDFs. Everything stays 100% on your device — works offline, no server needed.</p>
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />Import Your First PDF
              </button>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No books match "{searchQuery || selectedCategory}".</div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBooks.map(book => (
                <div key={book.id} onClick={() => onOpenBook(book)} className="group flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer">
                  <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {book.coverDataUrl ? <img src={book.coverDataUrl} alt={book.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" /> : <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400"><FileText className="w-10 h-10 mb-2" /><span className="text-xs line-clamp-3">{book.title}</span></div>}
                    <div className="absolute top-2 inset-x-2 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-950/75 text-white backdrop-blur-sm">{book.category}</span>
                      <button onClick={e => toggleFavorite(e, book)} className="p-1.5 rounded-full bg-slate-950/60 text-white hover:bg-slate-950/85 backdrop-blur-sm transition-colors" aria-label="Favorite">
                        <Heart className={`w-3.5 h-3.5 ${book.favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-950/30"><div className="h-full bg-amber-500" style={{ width: `${book.readingProgress}%` }} /></div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">{book.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{book.author}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>p.{book.lastReadPage}/{book.totalPages} · {formatBytes(book.fileSize)}</span>
                      <button onClick={e => { e.stopPropagation(); setEditingBook(book) }} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><MoreVertical className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredBooks.map(book => (
                <div key={book.id} onClick={() => onOpenBook(book)} className="flex items-center gap-4 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 transition-all cursor-pointer">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                    {book.coverDataUrl ? <img src={book.coverDataUrl} alt={book.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><FileText className="w-5 h-5" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{book.title}</h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{book.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{book.author} · {book.totalPages} pages · {formatBytes(book.fileSize)}</p>
                    <div className="mt-2 flex items-center gap-2 max-w-xs">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${book.readingProgress}%` }} /></div>
                      <span className="text-[11px] text-slate-500">{book.readingProgress}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => toggleFavorite(e, book)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><Heart className={`w-4 h-4 ${book.favorite ? 'fill-rose-500 text-rose-500' : ''}`} /></button>
                    <button onClick={e => { e.stopPropagation(); setEditingBook(book) }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BookMetadataModal key={editingBook?.id ?? 'none'} book={editingBook} onClose={() => setEditingBook(null)} onUpdated={loadLibrary} />
    </div>
  )
}
