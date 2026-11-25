import Dexie, { type Table } from 'dexie';
import type { Book, BookFile, Bookmark, BookNote, Snippet } from '../types';
import { extractPdfMetadataAndCover } from '../utils/pdf';

export class LocalShelfDB extends Dexie {
  books!: Table<Book, string>;
  bookFiles!: Table<BookFile, string>;
  bookmarks!: Table<Bookmark, string>;
  snippets!: Table<Snippet, string>;
  notes!: Table<BookNote, string>;
  constructor() {
    super('LocalShelfDB');
    this.version(1).stores({
      books: 'id, title, author, category, dateAdded, lastReadAt, favorite, *tags',
      bookFiles: 'bookId',
      bookmarks: 'id, bookId, page, createdAt',
      snippets: 'id, bookId, page, createdAt',
      notes: 'bookId, updatedAt',
    });
  }
}
export const db = new LocalShelfDB();

export async function importPdfFile(file: File, category = 'Reading List'): Promise<Book> {
  const id = crypto.randomUUID();
  const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
  const { title, author, totalPages, coverDataUrl } = await extractPdfMetadataAndCover(blob, file.name);
  const book: Book = {
    id, title, author, category, tags: [], coverDataUrl, totalPages,
    lastReadPage: 1, readingProgress: totalPages > 0 ? Math.round((1 / totalPages) * 100) : 0,
    fileSize: file.size, dateAdded: Date.now(), favorite: false,
  };
  await db.transaction('rw', db.books, db.bookFiles, async () => {
    await db.books.put(book);
    await db.bookFiles.put({ bookId: id, blob });
  });
  return book;
}

export async function deleteBook(bookId: string): Promise<void> {
  await db.transaction('rw', [db.books, db.bookFiles, db.bookmarks, db.snippets, db.notes], async () => {
    await db.books.delete(bookId);
    await db.bookFiles.delete(bookId);
    await db.bookmarks.where('bookId').equals(bookId).delete();
    await db.snippets.where('bookId').equals(bookId).delete();
    await db.notes.delete(bookId);
  });
}

export async function updateReadingProgress(bookId: string, page: number, totalPages: number): Promise<void> {
  const clamped = Math.max(1, Math.min(page, totalPages || page));
  await db.books.update(bookId, {
    lastReadPage: clamped,
    readingProgress: totalPages > 0 ? Math.min(100, Math.round((clamped / totalPages) * 100)) : 0,
    lastReadAt: Date.now(),
  });
}

export async function getStorageEstimate() {
  let usage = 0, quota = 0, persisted = false;
  if (navigator.storage?.estimate) { try { const e = await navigator.storage.estimate(); usage = e.usage ?? 0; quota = e.quota ?? 0; } catch { /* ignore */ } }
  if (navigator.storage?.persisted) { try { persisted = await navigator.storage.persisted(); } catch { /* ignore */ } }
  return { usage, quota, persisted };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
