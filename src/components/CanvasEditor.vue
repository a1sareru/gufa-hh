<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { fabric } from 'fabric'
import { useEditorStore } from '../stores/editorStore'
import { useToolStore } from '../stores/toolStore'
import { initCanvas, destroyCanvas, loadPageBackground, syncObjectsToCanvas, getCanvas } from '../services/canvas'
import { generateId } from '../services/projectManager'

const editorStore = useEditorStore()
const toolStore = useToolStore()

const canvasContainer = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let fabricCanvas: fabric.Canvas | null = null
let isInternalUpdate = false
let clipboard: any = null

// 套索工具狀態
const lassoPoints = ref<{ x: number, y: number }[]>([])
let lassoPreviewLine: fabric.Polyline | null = null

const clearLasso = () => {
  if (lassoPreviewLine && fabricCanvas) fabricCanvas.remove(lassoPreviewLine)
  lassoPreviewLine = null; lassoPoints.value = []
}

const finalizeLasso = async () => {
  if (lassoPoints.value.length < 3 || !editorStore.activePage) { clearLasso(); return }
  const points = lassoPoints.value
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`
  d += ' Z'
  const xs = points.map((p: any) => p.x), ys = points.map((p: any) => p.y)
  const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys) }
  
  const { getCanvasElement } = await import('../services/canvas')
  const { sampleDominantColor } = await import('../services/inpaint')
  const canvasEl = getCanvasElement()
  
  let fillColor = toolStore.preferences.maskDefaults.fillColor
  if (canvasEl) {
    const ctx = canvasEl.getContext('2d')
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
      const color = sampleDominantColor(imageData, bounds)
      fillColor = `rgb(${color.r},${color.g},${color.b})`
    }
  }
  const mask = { id: generateId(), type: 'lasso' as const, pathData: d, bounds, fillColor }
  await editorStore.addMask(editorStore.activePage.id, mask)
  clearLasso()
  updateCanvasContent(true) // 強制重繪以顯示新遮蓋
}

// 初始化畫布
onMounted(async () => {
  if (canvasEl.value && canvasContainer.value) {
    await nextTick()
    fabricCanvas = initCanvas(canvasEl.value)
    
    const updateSize = () => {
      if (canvasContainer.value && fabricCanvas) {
        const { width, height } = canvasContainer.value.getBoundingClientRect()
        if (width > 0 && height > 0) {
          fabricCanvas.setWidth(width)
          fabricCanvas.setHeight(height)
          fabricCanvas.calcOffset()
          updateCanvasContent(true)
        }
      }
    }

    updateSize()
    const resizeObserver = new ResizeObserver(() => updateSize())
    resizeObserver.observe(canvasContainer.value)
    setupCanvasEvents()
    setupClipboard()
  }
})

onUnmounted(() => {
  destroyCanvas()
})

// 更新內容並保持選中狀態
const updateCanvasContent = async (force = false) => {
  if (!fabricCanvas || !editorStore.activePage) return
  // 如果是內部觸發且不是強制更新，則跳過（防止死循環）
  if (isInternalUpdate && !force) return
  
  const selectedId = toolStore.selectedObjectId
  await loadPageBackground(editorStore.activePage, editorStore.isViewingOriginal)
  await syncObjectsToCanvas(editorStore.activePage, toolStore.selectedObjectId, editorStore.showMasks)

  // 恢復選中邏輯
  const objects = fabricCanvas.getObjects()
  for (const obj of objects) {
    const data = (obj as any).data
    if (selectedId && (data?.textObjectId === selectedId || data?.maskId === selectedId)) {
      fabricCanvas.setActiveObject(obj)
    }
  }
  fabricCanvas.renderAll()
}

watch(() => editorStore.activePage?.id, () => {
  clipboard = null 
  updateCanvasContent(true)
})
watch(() => editorStore.isViewingOriginal, () => updateCanvasContent(true))
watch(() => editorStore.showMasks, () => updateCanvasContent(true))
watch(() => toolStore.activeTool, () => updateCanvasContent(true))

// 深度監聽
watch(() => editorStore.activePage?.masks, () => updateCanvasContent(), { deep: true })
watch(() => editorStore.activePage?.textObjects, () => updateCanvasContent(), { deep: true })

// 輕量更新選中樣式
watch(() => toolStore.selectedObjectId, (newId, oldId) => {
  if (!fabricCanvas) return
  fabricCanvas.forEachObject((obj: any) => {
    const data = obj.data
    const isNowSelected = (data?.textObjectId === newId || data?.maskId === newId)
    const wasSelected = (data?.textObjectId === oldId || data?.maskId === oldId)
    if (isNowSelected || wasSelected) {
      if (data?.maskId) {
        obj.set({
          stroke: editorStore.showMasks ? (isNowSelected ? 'red' : 'rgba(255,0,0,0.5)') : 'transparent',
          strokeWidth: editorStore.showMasks ? 1 : 0
        })
      }
    }
  })
  fabricCanvas.renderAll()
})

// 複製貼上
const setupClipboard = () => {
  window.addEventListener('copy', () => {
    const canvas = getCanvas()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && (active as any).data?.textObjectId) {
      active.clone((cloned: any) => { clipboard = cloned })
    }
  })

  window.addEventListener('paste', async () => {
    const canvas = getCanvas()
    if (!canvas || !clipboard || !editorStore.activePage) return
    clipboard.clone(async (clonedObj: any) => {
      canvas.discardActiveObject()
      clonedObj.set({ left: clonedObj.left + 20, top: clonedObj.top + 20, evented: true })
      const newId = generateId()
      const sourceObj = editorStore.activePage!.textObjects.find(t => t.id === (clipboard as any).data.textObjectId)
      if (sourceObj) {
        const newText = {
          ...JSON.parse(JSON.stringify(sourceObj)),
          id: newId,
          transform: { left: clonedObj.left, top: clonedObj.top, scaleX: clonedObj.scaleX, scaleY: clonedObj.scaleY, angle: clonedObj.angle }
        }
        await editorStore.addTextObject(editorStore.activePage!.id, newText)
        toolStore.setSelectedObjectId(newId)
        updateCanvasContent(true)
      }
    })
  })
}

const setupCanvasEvents = () => {
  if (!fabricCanvas) return

  fabricCanvas.on('object:modified', async (opt: fabric.IEvent) => {
    const obj = opt.target
    if (!obj || !editorStore.activePage) return
    const data = (obj as any).data
    isInternalUpdate = true
    try {
      const transform = { left: obj.left || 0, top: obj.top || 0, scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1, angle: obj.angle || 0 }
      if (data?.textObjectId) {
        await editorStore.updateTextObject(editorStore.activePage.id, data.textObjectId, { transform })
      } else if (data?.maskId) {
        await editorStore.updateMask(editorStore.activePage.id, data.maskId, { transform })
      }
    } finally {
      setTimeout(() => { isInternalUpdate = false }, 50)
    }
  })

  fabricCanvas.on('selection:created', (opt: fabric.IEvent) => {
    const obj = opt.selected?.[0]
    if (obj) toolStore.setSelectedObjectId((obj as any).data?.textObjectId || (obj as any).data?.maskId || null)
  })
  fabricCanvas.on('selection:updated', (opt: fabric.IEvent) => {
    const obj = opt.selected?.[0]
    if (obj) toolStore.setSelectedObjectId((obj as any).data?.textObjectId || (obj as any).data?.maskId || null)
  })
  fabricCanvas.on('selection:cleared', () => toolStore.setSelectedObjectId(null))

  let isDraggingRect = false, rectStart = { x: 0, y: 0 }, activeRect: fabric.Rect | null = null, isPanning = false, lastPosX = 0, lastPosY = 0

  fabricCanvas.on('mouse:down', async (opt: fabric.IEvent) => {
    const pointer = fabricCanvas!.getPointer(opt.e as MouseEvent)
    if (toolStore.activeTool === 'lasso' && editorStore.activePage) {
      if (lassoPoints.value.length > 2) {
        const start = lassoPoints.value[0]
        if (Math.sqrt(Math.pow(pointer.x - start.x, 2) + Math.pow(pointer.y - start.y, 2)) < 10) { await finalizeLasso(); return }
      }
      lassoPoints.value.push({ x: pointer.x, y: pointer.y })
      if (lassoPreviewLine) fabricCanvas?.remove(lassoPreviewLine)
      lassoPreviewLine = new fabric.Polyline(lassoPoints.value, { fill: 'rgba(255,0,0,0.1)', stroke: 'red', strokeWidth: 1, selectable: false, evented: false })
      fabricCanvas?.add(lassoPreviewLine)
      return
    }
    if (toolStore.activeTool === 'rect' && editorStore.activePage) {
      isDraggingRect = true; rectStart = { x: pointer.x, y: pointer.y }
      activeRect = new fabric.Rect({ left: rectStart.x, top: rectStart.y, width: 0, height: 0, fill: toolStore.preferences.maskDefaults.fillColor, stroke: 'red', strokeWidth: 1, selectable: false, evented: false })
      fabricCanvas?.add(activeRect); return
    }
    if (toolStore.activeTool === 'text' && !opt.target && editorStore.activePage) {
      const prefs = toolStore.preferences.textDefaults
      const newText = {
        id: generateId(), content: '新文字', direction: prefs.direction, textAlign: prefs.textAlign,
        fontFamily: prefs.fontFamily, fontSize: prefs.fontSize, fontWeight: prefs.fontWeight, color: prefs.color, strokeColor: prefs.strokeColor, strokeWidth: prefs.strokeWidth, lineHeight: prefs.lineHeight, letterSpacing: 0,
        transform: { left: pointer.x, top: pointer.y, scaleX: 1, scaleY: 1, angle: 0 }
      }
      await editorStore.addTextObject(editorStore.activePage.id, newText)
      updateCanvasContent(true) // 強制同步以確保文字出現
    }
    if (toolStore.activeTool === 'pan') {
      isPanning = true; fabricCanvas!.defaultCursor = 'grabbing'
      lastPosX = (opt.e as MouseEvent).clientX; lastPosY = (opt.e as MouseEvent).clientY
    }
  })

  fabricCanvas.on('mouse:move', (opt: fabric.IEvent) => {
    const pointer = fabricCanvas!.getPointer(opt.e as MouseEvent)
    if (isDraggingRect && activeRect) {
      const width = pointer.x - rectStart.x, height = pointer.y - rectStart.y
      activeRect.set({ left: width > 0 ? rectStart.x : pointer.x, top: height > 0 ? rectStart.y : pointer.y, width: Math.abs(width), height: Math.abs(height) })
      fabricCanvas?.renderAll()
    }
    if (isPanning && fabricCanvas) {
      const e = opt.e as MouseEvent, vpt = fabricCanvas.viewportTransform
      if (vpt) { vpt[4] += e.clientX - lastPosX; vpt[5] += e.clientY - lastPosY; fabricCanvas.requestRenderAll() }
      lastPosX = e.clientX; lastPosY = e.clientY
    }
  })

  fabricCanvas.on('mouse:up', async () => {
    if (isDraggingRect && activeRect && editorStore.activePage) {
      const { left, top, width, height } = activeRect
      if ((width || 0) > 2 && (height || 0) > 2) {
        const d = `M ${left} ${top} L ${left! + (width || 0)} ${top} L ${left! + (width || 0)} ${top! + (height || 0)} L ${left} ${top! + (height || 0)} Z`
        const bounds = { x: left || 0, y: top || 0, width: width || 0, height: height || 0 }
        const { getCanvasElement } = await import('../services/canvas')
        const { sampleDominantColor } = await import('../services/inpaint')
        const canvasEl = getCanvasElement()
        let fillColor = toolStore.preferences.maskDefaults.fillColor
        if (canvasEl) {
          const ctx = canvasEl.getContext('2d')
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
            const color = sampleDominantColor(imageData, bounds)
            fillColor = `rgb(${color.r},${color.g},${color.b})`
          }
        }
        const mask = { id: generateId(), type: 'rect' as const, pathData: d, bounds, fillColor }
        await editorStore.addMask(editorStore.activePage.id, mask)
        updateCanvasContent(true) // 強制顯示遮蓋
      }
      fabricCanvas?.remove(activeRect); activeRect = null; isDraggingRect = false
    }
    isPanning = false
    if (fabricCanvas && toolStore.activeTool === 'pan') fabricCanvas.defaultCursor = 'grab'
  })

  fabricCanvas.on('mouse:dblclick', () => {
    if (toolStore.activeTool === 'lasso') finalizeLasso()
  })
}
</script>

<template>
  <div ref="canvasContainer" class="canvas-editor">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<style scoped>
.canvas-editor { flex: 1; width: 100%; height: 100%; background: #888; overflow: hidden; position: relative; }
canvas { background: #fff; }
</style>
