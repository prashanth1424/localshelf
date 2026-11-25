import React, { useState } from 'react'
import { X, Trash2, Save } from 'lucide-react'
import { DEFAULT_CATEGORIES, type Book } from '../types'
import { db, deleteBook } from '../db/database'

interface Props { book: Book | null; onClose: () => void; onUpdated: () => void }

export const BookMetadataModal: React.FC<Props> = ({ book, onClose, onUpdated }) => {
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [category, setCategory] = useState(book?.category ?? 'Reading List')
  const [tagsText, setTagsText] = useState(book?.tags.join(', ') ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!book) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean)
    await db.books.update(book.id, { title: title.trim() || book.title, author: author.trim() || 'Unknown', category: category.trim() || 'Reading List', tags: Array.from(new Set(tags)) })
    onUpdated(); onClose()
  }
  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteBook(book.id); onUpdated(); onClose()
  }

  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Edit Book Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Author</label><input type="text" value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} /></div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Collection</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DEFAULT_CATEGORIES.map(cat => (
                <button type="button" key={cat} onClick={() => setCategory(cat)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${category === cat ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{cat}</button>
              ))}
            </div>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Custom category..." className={inputCls} />
          </div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tags (comma-separated)</label><input type="text" value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="algorithms, math, exam" className={inputCls} /></div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={handleDelete} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${confirmDelete ? 'bg-rose-600 text-white hover:bg-rose-500' : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'}`}>
              <Trash2 className="w-4 h-4" />{confirmDelete ? 'Confirm Delete' : 'Delete Book'}
            </button>
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"><Save className="w-4 h-4" />Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
