import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineNode, SearchResult } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
export { pdfjsLib };

export async function loadPdfFromBlob(blob: Blob): Promise<PDFDocumentProxy> {
  const arrayBuffer = await blob.arrayBuffer();
  return pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
}

export async function extractPdfMetadataAndCover(blob: Blob, fallbackTitle: string) {
  const pdf = await loadPdfFromBlob(blob);
  try {
    const totalPages = pdf.numPages;
    let title = fallbackTitle.replace(/\.pdf$/i, '');
    let author = 'Unknown Author';
    try {
      const meta = await pdf.getMetadata();
      const info = meta?.info as Record<string, unknown> | undefined;
      if (info) {
        if (typeof info.Title === 'string' && info.Title.trim()) title = info.Title.trim();
        if (typeof info.Author === 'string' && info.Author.trim()) author = info.Author.trim();
      }
    } catch { /* optional */ }

    let coverDataUrl: string | undefined;
    try {
      const page = await pdf.getPage(1);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 320 / unscaled.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        coverDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      }
      page.cleanup();
    } catch { /* optional */ }
    return { title, author, totalPages, coverDataUrl };
  } finally {
    await pdf.cleanup();
  }
}

async function resolveDestToPage(pdf: PDFDocumentProxy, dest: string | unknown[] | null): Promise<number | null> {
  if (!dest) return null;
  try {
    let explicitDest: unknown[] | null = null;
    if (typeof dest === 'string') explicitDest = await pdf.getDestination(dest);
    else if (Array.isArray(dest)) explicitDest = dest;
    if (!explicitDest?.length) return null;
    const ref = explicitDest[0];
    if (typeof ref === 'number') return ref + 1;
    if (ref && typeof ref === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await pdf.getPageIndex(ref as any)) + 1;
    }
  } catch { return null; }
  return null;
}

export async function extractPdfOutline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  try {
    const rawOutline = await pdf.getOutline();
    if (!rawOutline?.length) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapNodes = async (nodes: any[]): Promise<OutlineNode[]> => {
      const result: OutlineNode[] = [];
      for (const item of nodes) {
        const page = await resolveDestToPage(pdf, item.dest);
        result.push({ title: item.title || 'Untitled', page, items: item.items?.length ? await mapNodes(item.items) : [] });
      }
      return result;
    };
    return await mapNodes(rawOutline);
  } catch { return []; }
}

export async function searchPdfText(pdf: PDFDocumentProxy, query: string, onProgress?: (c: number, t: number) => void): Promise<SearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const results: SearchResult[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const fullText = content.items.map(i => ('str' in i ? i.str : '')).join(' ').replace(/\s+/g, ' ');
    const lower = fullText.toLowerCase();
    if (lower.includes(trimmed)) {
      let count = 0, pos = 0;
      while ((pos = lower.indexOf(trimmed, pos)) !== -1) { count++; pos += trimmed.length; }
      const idx = lower.indexOf(trimmed);
      const start = Math.max(0, idx - 45), end = Math.min(fullText.length, idx + trimmed.length + 75);
      results.push({ page: p, snippet: `${start > 0 ? '...' : ''}${fullText.slice(start, end)}${end < fullText.length ? '...' : ''}`, matchCount: count });
    }
    page.cleanup();
  }
  return results;
}
