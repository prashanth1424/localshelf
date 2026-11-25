export type ReadingMode = 'light' | 'sepia' | 'dark';
export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';
export type SortOption = 'recent' | 'title' | 'progress' | 'added';
export type ViewMode = 'grid' | 'list';

export const DEFAULT_CATEGORIES = ['Technical','Textbooks','Reference','Reading List'] as const;

export interface Book {
  id: string; title: string; author: string; category: string; tags: string[];
  coverDataUrl?: string; totalPages: number; lastReadPage: number;
  readingProgress: number; fileSize: number; dateAdded: number;
  lastReadAt?: number; favorite: boolean;
}
export interface BookFile { bookId: string; blob: Blob; }
export interface Bookmark { id: string; bookId: string; page: number; label: string; createdAt: number; }
export interface Snippet { id: string; bookId: string; page: number; text: string; note?: string; createdAt: number; }
export interface BookNote { bookId: string; content: string; updatedAt: number; }
export interface OutlineNode { title: string; page: number | null; items: OutlineNode[]; }
export interface SearchResult { page: number; snippet: string; matchCount: number; }
export interface LibraryBackupData {
  version: number; exportedAt: string; app: 'LocalShelf';
  books: Book[]; bookmarks: Bookmark[]; snippets: Snippet[]; notes: BookNote[];
}
