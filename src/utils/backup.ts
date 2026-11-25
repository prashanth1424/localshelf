import JSZip from 'jszip';
import { db } from '../db/database';
import type { LibraryBackupData } from '../types';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

async function gatherBackupData(): Promise<LibraryBackupData> {
  const [books, bookmarks, snippets, notes] = await Promise.all([
    db.books.toArray(), db.bookmarks.toArray(), db.snippets.toArray(), db.notes.toArray(),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), app: 'LocalShelf', books, bookmarks, snippets, notes };
}

export async function exportLibraryJson() {
  const data = await gatherBackupData();
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `localshelf-backup-${stamp()}.json`);
}

export async function exportLibraryZip(onProgress?: (pct: number) => void) {
  const data = await gatherBackupData();
  const zip = new JSZip();
  zip.file('library.json', JSON.stringify(data, null, 2));
  const pdfFolder = zip.folder('pdfs');
  if (pdfFolder) {
    for (const f of await db.bookFiles.toArray()) pdfFolder.file(`${f.bookId}.pdf`, f.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } }, m => onProgress?.(Math.round(m.percent)));
  triggerDownload(zipBlob, `localshelf-full-archive-${stamp()}.zip`);
}

export async function importLibraryBackup(file: File) {
  let backup: LibraryBackupData;
  const pdfMap = new Map<string, Blob>();
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = zip.file('library.json');
    if (!jsonFile) throw new Error('Invalid archive: missing library.json');
    backup = JSON.parse(await jsonFile.async('string')) as LibraryBackupData;
    for (const path of Object.keys(zip.files).filter(n => n.startsWith('pdfs/') && n.endsWith('.pdf'))) {
      const entry = zip.file(path);
      if (entry) pdfMap.set(path.replace(/^pdfs\//, '').replace(/\.pdf$/, ''), new Blob([await entry.async('blob')], { type: 'application/pdf' }));
    }
  } else {
    backup = JSON.parse(await file.text()) as LibraryBackupData;
  }
  if (backup.app !== 'LocalShelf' || !Array.isArray(backup.books)) throw new Error('Invalid LocalShelf backup format');
  await db.transaction('rw', [db.books, db.bookFiles, db.bookmarks, db.snippets, db.notes], async () => {
    if (backup.books.length) await db.books.bulkPut(backup.books);
    if (backup.bookmarks?.length) await db.bookmarks.bulkPut(backup.bookmarks);
    if (backup.snippets?.length) await db.snippets.bulkPut(backup.snippets);
    if (backup.notes?.length) await db.notes.bulkPut(backup.notes);
    for (const [bookId, blob] of pdfMap) await db.bookFiles.put({ bookId, blob });
  });
  return { booksRestored: backup.books.length, pdfsRestored: pdfMap.size, notesRestored: backup.notes?.length ?? 0, bookmarksRestored: backup.bookmarks?.length ?? 0 };
}
