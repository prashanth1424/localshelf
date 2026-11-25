import React, { useEffect, useRef, useState } from 'react'
import { X, HardDrive, ShieldCheck, Download, Upload, Archive, FileJson, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react'
import { formatBytes, getStorageEstimate, requestPersistentStorage } from '../db/database'
import { exportLibraryJson, exportLibraryZip, importLibraryBackup } from '../utils/backup'

interface Props { isOpen: boolean; onClose: () => void; onLibraryChanged: () => void; canInstallPwa: boolean; onInstallPwa: () => void }

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onLibraryChanged, canInstallPwa, onInstallPwa }) => {
  const [storage, setStorage] = useState({ usage: 0, quota: 0, persisted: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [zipProgress, setZipProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshStorage = async () => setStorage(await getStorageEstimate())
  useEffect(() => { if (isOpen) { refreshStorage(); setStatusMsg(null) } }, [isOpen])
  if (!isOpen) return null

  const handlePersist = async () => {
    const granted = await requestPersistentStorage()
    await refreshStorage()
    setStatusMsg({ type: granted ? 'success' : 'error', text: granted ? 'Persistent storage enabled! Browser will not auto-evict your books.' : 'Browser denied persistent storage (try after installing PWA).' })
  }

  const handleExportJson = async () => {
    setBusy('json'); setStatusMsg(null)
    try { await exportLibraryJson(); setStatusMsg({ type: 'success', text: 'Exported notes, bookmarks & metadata (.json).' }) }
    catch (err) { setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Export failed.' }) }
    finally { setBusy(null) }
  }

  const handleExportZip = async () => {
    setBusy('zip'); setZipProgress(0); setStatusMsg(null)
    try { await exportLibraryZip(pct => setZipProgress(pct)); setStatusMsg({ type: 'success', text: 'Exported full library archive with all PDFs (.zip).' }) }
    catch (err) { setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Export failed.' }) }
    finally { setBusy(null); setZipProgress(0) }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusy('import'); setStatusMsg(null)
    try {
      const res = await importLibraryBackup(file)
      await refreshStorage(); onLibraryChanged()
      setStatusMsg({ type: 'success', text: `Restored ${res.booksRestored} book(s), ${res.pdfsRestored} PDF(s), ${res.notesRestored} note(s), ${res.bookmarksRestored} bookmark(s).` })
    } catch (err) { setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Restore failed.' }) }
    finally { setBusy(null); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const usagePct = storage.quota > 0 ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Library Settings & Backup</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {statusMsg && (
            <div className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><HardDrive className="w-4 h-4 text-amber-500" /><span>Offline IndexedDB Storage</span></div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${storage.persisted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{storage.persisted ? 'Persistent' : 'Best-Effort'}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Used: {formatBytes(storage.usage)}</span>
                <span>Quota: {storage.quota > 0 ? formatBytes(storage.quota) : 'Unknown'}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.max(usagePct, storage.usage > 0 ? 2 : 0)}%` }} />
              </div>
              {!storage.persisted && (
                <button onClick={handlePersist} className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 transition-colors">
                  <ShieldCheck className="w-4 h-4" />Request Persistent Storage
                </button>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><Archive className="w-4 h-4 text-blue-500" /><span>Backup & Device Transfer</span></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Export study notes, bookmarks & progress as JSON, or export a full ZIP archive including PDFs to transfer between PC and mobile.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button onClick={handleExportJson} disabled={busy !== null} className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors">
                <FileJson className="w-4 h-4 text-amber-500" /><span>{busy === 'json' ? 'Exporting...' : 'Export Notes (.json)'}</span>
              </button>
              <button onClick={handleExportZip} disabled={busy !== null} className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                <Download className="w-4 h-4" /><span>{busy === 'zip' ? `Zipping ${zipProgress}%` : 'Full Archive (.zip)'}</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json,.zip" onChange={handleImportFile} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={busy !== null} className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors">
              <Upload className="w-4 h-4 text-emerald-500" /><span>{busy === 'import' ? 'Restoring...' : 'Restore Backup (.json or .zip)'}</span>
            </button>
          </section>

          {canInstallPwa && (
            <section className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={onInstallPwa} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                <Smartphone className="w-4 h-4" />Install LocalShelf as Offline App
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
