import { fabric } from 'fabric'
import type { Page } from '../types/index'

// 單例 canvas 實例
let canvasInstance: fabric.Canvas | null = null
let lastUsedScale = 1

/**
 * 初始化 canvas，創建 fabric.Canvas 實例
 */
export function initCanvas(el: HTMLCanvasElement): fabric.Canvas {
  canvasInstance = new fabric.Canvas(el, {
    backgroundColor: '#fff',
    preserveObjectStacking: true,
    enableRetinaScaling: true,
  })
  return canvasInstance
}

/**
 * 銷毀當前 canvas 實例
 */
export function destroyCanvas(): void {
  if (canvasInstance) {
    canvasInstance.dispose()
    canvasInstance = null
  }
}

/**
 * 獲取當前 canvas 實例
 */
export function getCanvas(): fabric.Canvas | null {
  return canvasInstance
}

/**
 * 獲取 HTMLCanvasElement 實例
 */
export function getCanvasElement(): HTMLCanvasElement | null {
  return canvasInstance?.getElement() || null
}

/**
 * 獲取當前縮放比例
 */
export function getCanvasScale(): number {
  return lastUsedScale
}

/**
 * 獲取背景圖相對於原圖的縮放比例和偏移量
 */
export function getCanvasToImageInfo() {
  const canvas = canvasInstance
  if (!canvas) return null
  const bg = canvas.backgroundImage as fabric.Image
  if (!bg) return null
  return {
    scaleX: bg.scaleX || 1,
    scaleY: bg.scaleY || 1,
    left: bg.left || 0,
    top: bg.top || 0,
    width: bg.width || 0,
    height: bg.height || 0
  }
}

/**
 * 加載頁面背景圖
 */
export async function loadPageBackground(page: Page, isViewingOriginal: boolean = false): Promise<void> {
  const canvas = canvasInstance
  if (!canvas) return

  return new Promise((resolve) => {
    const src = isViewingOriginal ? page.originalSnapshot : page.canvasSnapshot
    fabric.Image.fromURL(src, (img) => {
      const canvasWidth = canvas.getWidth()
      const canvasHeight = canvas.getHeight()
      const scale = Math.min(canvasWidth / (img.width || 1), canvasHeight / (img.height || 1))
      
      img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        selectable: false,
        evented: false,
      })

      lastUsedScale = scale
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
      resolve()
    })
  })
}

/**
 * 清除畫布上的所有對象（不含背景）
 */
export function clearObjects(): void {
  const canvas = canvasInstance
  if (!canvas) return
  const objects = canvas.getObjects()
  objects.forEach((obj: fabric.Object) => canvas.remove(obj))
}

/**
 * 將頁面的 textObjects 和 masks 同步至 Fabric canvas
 */
export async function syncObjectsToCanvas(page: Page, selectedObjectId: string | null = null, showMasks: boolean = true): Promise<void> {
  const canvas = canvasInstance
  if (!canvas) return

  clearObjects()

  const { useToolStore } = await import('../stores/toolStore')
  const activeTool = useToolStore().activeTool
  const isTextMode = activeTool === 'text'

  // 1. 建立 Masks
  for (const mask of page.masks) {
    const isSelected = mask.id === selectedObjectId
    const path = new fabric.Path(mask.pathData, {
      fill: mask.fillColor || '#ffffff',
      stroke: showMasks ? (isSelected ? 'red' : 'rgba(255,0,0,0.5)') : 'transparent',
      strokeWidth: showMasks ? 1 : 0,
      selectable: !isTextMode, 
      evented: !isTextMode,
      hasControls: !isTextMode,
      opacity: showMasks ? 0.8 : 1,
      left: mask.transform?.left ?? undefined,
      top: mask.transform?.top ?? undefined,
      scaleX: mask.transform?.scaleX ?? 1,
      scaleY: mask.transform?.scaleY ?? 1,
      angle: mask.transform?.angle ?? 0,
    })
    ;(path as any).data = { maskId: mask.id }
    canvas.add(path)
  }

  // 2. 添加文字對象
  const { renderVerticalTextToObjects } = await import('./textRender')

  for (const textObj of page.textObjects) {
    let textFabricObj: fabric.Object

    if (textObj.direction === 'horizontal') {
      // 關鍵：使用 IText 替代 Textbox 以禁用自動折行
      textFabricObj = new fabric.IText(textObj.content, {
        left: textObj.transform.left,
        top: textObj.transform.top,
        scaleX: textObj.transform.scaleX,
        scaleY: textObj.transform.scaleY,
        angle: textObj.transform.angle,
        fontFamily: textObj.fontFamily,
        fontSize: textObj.fontSize,
        fontWeight: textObj.fontWeight,
        fill: textObj.color,
        stroke: textObj.strokeColor,
        strokeWidth: textObj.strokeWidth,
        textAlign: textObj.textAlign,
        lineHeight: textObj.lineHeight,
        selectable: true,
        originX: 'left',
        originY: 'top',
        editable: false, // 統一在面板編輯
      })
    } else {
      // 豎排：逐字生成
      const charObjects = renderVerticalTextToObjects({
        content: textObj.content,
        fontFamily: textObj.fontFamily,
        fontSize: textObj.fontSize,
        fontWeight: textObj.fontWeight,
        color: textObj.color,
        strokeColor: textObj.strokeColor,
        strokeWidth: textObj.strokeWidth,
        lineHeight: textObj.lineHeight,
        letterSpacing: 0,
        textAlign: textObj.textAlign
      })
      
      textFabricObj = new fabric.Group(charObjects, {
        left: textObj.transform.left,
        top: textObj.transform.top,
        scaleX: textObj.transform.scaleX,
        scaleY: textObj.transform.scaleY,
        angle: textObj.transform.angle,
        selectable: true,
        originX: 'center',
        originY: 'center',
        centeredScaling: true,
        centeredRotation: true,
      })
    }
    
    ;(textFabricObj as any).data = { textObjectId: textObj.id, balloonMaskId: textObj.balloonMaskId }
    canvas.add(textFabricObj)
    textFabricObj.bringToFront()
  }

  canvas.renderAll()
}

/**
 * 導出當前畫布為 base64 字符串
 */
export function getCanvasSnapshot(): string {
  const canvas = canvasInstance
  if (!canvas) return ''
  return canvas.toDataURL({ format: 'png' })
}

/**
 * 調整 canvas 尺寸
 */
export function resizeCanvas(width: number, height: number): void {
  const canvas = canvasInstance
  if (!canvas) return
  canvas.setWidth(width)
  canvas.setHeight(height)
  canvas.renderAll()
}
