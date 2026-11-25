import React, { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import type { ZoomMode } from '../types'

interface Props { pdf: PDFDocumentProxy; pageNumber: number; zoomMode: ZoomMode; customScale: number; containerWidth: number; containerHeight: number; searchQuery?: string; onEffectiveScaleChange?: (s: number) => void }

export const PdfPageCanvas: React.FC<Props> = ({ pdf, pageNumber, zoomMode, customScale, containerWidth, containerHeight, searchQuery, onEffectiveScaleChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 800 })

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayerInstance: TextLayer | null = null

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const availW = Math.max(280, containerWidth - 32)
        const availH = Math.max(320, containerHeight - 32)
        let scale = customScale
        if (zoomMode === 'fit-width') scale = availW / base.width
        else if (zoomMode === 'fit-page') scale = Math.min(availW / base.width, availH / base.height)
        scale = Math.max(0.3, Math.min(4, scale))
        onEffectiveScaleChange?.(scale)
        const viewport = page.getViewport({ scale })
        const dpr = window.devicePixelRatio || 1
        setDimensions({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) })
        const canvas = canvasRef.current; const textDiv = textLayerRef.current
        if (!canvas || !textDiv || cancelled) return
        canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`; canvas.style.height = `${Math.floor(viewport.height)}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, viewport.width, viewport.height)
        renderTask = page.render({ canvasContext: ctx, viewport, canvas })
        await renderTask.promise
        if (cancelled) return
        textDiv.innerHTML = ''
        textDiv.style.width = `${Math.floor(viewport.width)}px`; textDiv.style.height = `${Math.floor(viewport.height)}px`
        textDiv.style.setProperty('--scale-factor', String(viewport.scale))
        const textContent = await page.getTextContent()
        if (cancelled) return
        textLayerInstance = new TextLayer({ textContentSource: textContent, container: textDiv, viewport })
        await textLayerInstance.render()
        if (!cancelled && searchQuery?.trim()) {
          const q = searchQuery.trim().toLowerCase()
          textDiv.querySelectorAll('span').forEach(span => {
            if (span.textContent?.toLowerCase().includes(q)) span.classList.add('search-highlight')
          })
        }
      } catch (err) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') return
      }
    }
    renderPage()
    return () => {
      cancelled = true
      if (renderTask) { try { renderTask.cancel() } catch { /* ignore */ } }
      if (textLayerInstance) { try { textLayerInstance.cancel() } catch { /* ignore */ } }
    }
  }, [pdf, pageNumber, zoomMode, customScale, containerWidth, containerHeight, searchQuery, onEffectiveScaleChange])

  return (
    <div className="pdf-page-container rounded-sm overflow-hidden" style={{ width: dimensions.width, height: dimensions.height }}>
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  )
}
