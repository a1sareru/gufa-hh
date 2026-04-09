import JSZip from 'jszip'
import type { Page } from '../types/index'
import { getCanvasScale, getCanvasToImageInfo } from './canvas'

/**
 * 將頁面導出為 Blob（通過離屏 canvas 渲染至原始分辨率）
 */
export async function exportPageAsBlob(
  page: Page,
  format: 'png' | 'jpeg',
  quality?: number
): Promise<Blob> {
  const originalImg = await loadImage(page.originalSnapshot)
  const imgWidth = originalImg.naturalWidth
  const imgHeight = originalImg.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = imgWidth
  canvas.height = imgHeight
  const ctx = canvas.getContext('2d')!

  // 1. 繪製底圖
  ctx.drawImage(originalImg, 0, 0)

  const canvasInfo = getCanvasToImageInfo()
  const scale = getCanvasScale()
  
  if (!canvasInfo || !scale) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(), format === 'jpeg' ? 'image/jpeg' : 'image/png')
    })
  }

  const offsetX = canvasInfo.left - (canvasInfo.width * scale) / 2
  const offsetY = canvasInfo.top - (canvasInfo.height * scale) / 2

  // 2. 繪製氣泡背景 (Masks)
  for (const mask of page.masks) {
    ctx.save()
    const mLeft = ( (mask.transform?.left ?? 0) - offsetX ) / scale
    const mTop = ( (mask.transform?.top ?? 0) - offsetY ) / scale
    const mScaleX = (mask.transform?.scaleX ?? 1) / scale
    const mScaleY = (mask.transform?.scaleY ?? 1) / scale
    const mAngle = mask.transform?.angle ?? 0

    ctx.translate(mLeft, mTop)
    ctx.rotate((mAngle * Math.PI) / 180)
    ctx.scale(mScaleX, mScaleY)

    const path = new Path2D(mask.pathData)
    ctx.fillStyle = mask.fillColor || '#ffffff'
    ctx.fill(path)
    ctx.restore()
  }

  // 3. 繪製文字
  const { convertToFullWidth, isPunctuationForRotation } = await import('./textRender')
  const { convertToVerticalPunctuation } = await import('../utils/text')
  
  for (const textObj of page.textObjects) {
    ctx.save()

    const tLeft = ( textObj.transform.left - offsetX ) / scale
    const tTop = ( textObj.transform.top - offsetY ) / scale
    const tScaleX = textObj.transform.scaleX / scale
    const tScaleY = textObj.transform.scaleY / scale
    const tAngle = textObj.transform.angle

    ctx.translate(tLeft, tTop)
    ctx.rotate((tAngle * Math.PI) / 180)
    ctx.scale(tScaleX, tScaleY)

    const fontSize = textObj.fontSize
    const fontWeight = textObj.fontWeight || '400'
    ctx.font = `${fontWeight} ${fontSize}px "${textObj.fontFamily}"`
    ctx.fillStyle = textObj.color
    
    if (textObj.strokeWidth > 0) {
      ctx.strokeStyle = textObj.strokeColor
      ctx.lineWidth = textObj.strokeWidth * 2
      ctx.lineJoin = 'round'
    }

    if (textObj.direction === 'horizontal') {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const lines = textObj.content.split('\n')
      const lineHeight = fontSize * textObj.lineHeight
      lines.forEach((line, i) => {
        if (textObj.strokeWidth > 0) ctx.strokeText(line, 0, i * lineHeight)
        ctx.fillText(line, 0, i * lineHeight)
      })
    } else {
      // 豎排標點自動處理
      const verticalContent = convertToVerticalPunctuation(textObj.content)
      const processedContent = convertToFullWidth(verticalContent)
      
      const lines = processedContent.split('\n')
      const colWidth = fontSize * textObj.lineHeight
      const charHeight = fontSize
      
      const maxChars = Math.max(...lines.map(l => l.length))
      const totalHeight = maxChars * charHeight
      const totalWidth = lines.length * colWidth

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      lines.forEach((line, colIndex) => {
        const x = totalWidth / 2 - (colIndex * colWidth + colWidth / 2)
        let startY = -totalHeight / 2
        
        if (textObj.textAlign === 'center') {
          startY = -(line.length * charHeight) / 2
        } else if (textObj.textAlign === 'right') { // 底部對齊
          startY = totalHeight / 2 - (line.length * charHeight)
        }

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          const y = startY + i * charHeight + fontSize / 2
          const isPunct = isPunctuationForRotation(char)

          ctx.save()
          ctx.translate(x, y)
          if (isPunct) {
            ctx.rotate(Math.PI / 2)
            ctx.translate(fontSize * 0.05, -fontSize * 0.05)
          }
          
          if (textObj.strokeWidth > 0) ctx.strokeText(char, 0, 0)
          ctx.fillText(char, 0, 0)
          ctx.restore()
        }
      })
    }
    ctx.restore()
  }

  return new Promise<Blob>((resolve, reject) => {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const q = format === 'jpeg' && quality !== undefined ? quality / 100 : undefined
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, mimeType, q)
  })
}

export async function exportAllAsZip(
  pages: Page[],
  format: 'png' | 'jpeg',
  onProgress: (current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const blob = await exportPageAsBlob(page, format)
    const filename = getExportFilename(page.fileName, format)
    zip.file(filename, blob)
    onProgress(i + 1, pages.length)
  }
  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.style.display = 'none'
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function getExportFilename(originalFileName: string, format: 'png' | 'jpeg'): string {
  const dotIndex = originalFileName.lastIndexOf('.')
  const nameWithoutExt = dotIndex !== -1 ? originalFileName.slice(0, dotIndex) : originalFileName
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  return `${nameWithoutExt}_edited.${ext}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
