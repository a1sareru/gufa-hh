import { defineStore } from 'pinia'
import type {
  EditorState,
  Project,
  Page,
  MaskRegion,
  TextObject,
  TextPreset,
  PageSnapshot,
  HistoryActionType,
  FontStatus,
} from '../types/index'
import { useHistoryStore } from './historyStore'
import * as storage from '../utils/storage'

const BUILTIN_PRESETS: TextPreset[] = [
  {
    id: 'builtin-1',
    name: '思源黑體 (預設)',
    fontFamily: 'Noto Sans TC',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 1,
    lineHeight: 1.2,
    letterSpacing: 0,
    direction: 'vertical',
    textAlign: 'center',
    builtin: true,
  },
  {
    id: 'builtin-2',
    name: '思源宋體標準',
    fontFamily: 'Noto Serif TC',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 1,
    lineHeight: 1.2,
    letterSpacing: 0,
    direction: 'vertical',
    textAlign: 'center',
    builtin: true,
  },
  {
    id: 'builtin-3',
    name: '標楷體豎排',
    fontFamily: 'DFKai-SB',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    lineHeight: 1.2,
    letterSpacing: 0,
    direction: 'vertical',
    textAlign: 'center',
    builtin: true,
  },
]

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    project: null,
    isViewingOriginal: false,
    isExporting: false,
    exportProgress: 0,
    notification: null,
    showMasks: true,
    fonts: [],
    localFonts: [],
  }),

  getters: {
    activePage(state): Page | null {
      if (!state.project) return null
      return state.project.pages.find((p) => p.id === state.project!.activePageId) ?? null
    },
  },

  actions: {
    // ── 字體管理 ───────────────────────────────────────────────────────────
    
    initFontList(fontDefinitions: { id: string, name: string }[]) {
      this.fonts = fontDefinitions.map(f => ({
        id: f.id,
        name: f.name,
        status: 'loading'
      }))
    },

    updateFontStatus(id: string, status: FontStatus['status']) {
      const font = this.fonts.find(f => f.id === id)
      if (font) font.status = status
    },

    addLocalFont(fontFamily: string) {
      if (!this.localFonts.includes(fontFamily)) {
        this.localFonts.push(fontFamily)
        this.fonts.push({
          id: fontFamily,
          name: fontFamily,
          status: 'loaded'
        })
      }
    },

    // ── 內部輔助 ────────────────────────────────────────────────────────────

    createPageSnapshot(page: Page): PageSnapshot {
      return {
        id: page.id,
        fileName: page.fileName,
        originalSnapshot: page.originalSnapshot,
        canvasSnapshot: page.canvasSnapshot,
        masks: JSON.parse(JSON.stringify(page.masks)),
        textObjects: JSON.parse(JSON.stringify(page.textObjects)),
      }
    },

    async executeEditAction(
      pageId: string,
      type: HistoryActionType,
      action: (page: Page) => void | Promise<void>
    ) {
      if (!this.project || this.isViewingOriginal) return
      const page = this.project.pages.find((p) => p.id === pageId)
      if (!page) return
      const before = this.createPageSnapshot(page)
      await action(page)
      const after = this.createPageSnapshot(page)
      const historyStore = useHistoryStore()
      historyStore.pushHistory(pageId, type, before, after)
    },

    autoSave() {}, // 已禁用

    setNotification(message: string, type: 'info' | 'error' | 'warning' = 'info') {
      this.notification = { message, type }
      setTimeout(() => { if (this.notification?.message === message) this.clearNotification() }, 5000)
    },

    clearNotification() { this.notification = null },

    setProject(project: Project | null) {
      if (project) {
        const existingBuiltinIds = new Set(project.textPresets.filter((p) => p.builtin).map((p) => p.id))
        const missingBuiltins = BUILTIN_PRESETS.filter((p) => !existingBuiltinIds.has(p.id))
        project.textPresets = [...missingBuiltins, ...project.textPresets]
      }
      this.project = project
    },

    setActivePage(pageId: string) {
      if (!this.project) return
      const page = this.project.pages.find((p) => p.id === pageId)
      if (page) this.project.activePageId = pageId
    },

    async appendPages(files: File[]) {
      if (!this.project) return
      const { appendPages } = await import('../services/projectManager')
      const { pages, skippedFiles } = await appendPages(files)
      if (skippedFiles.length > 0) this.setNotification(`跳過了非圖片檔案: ${skippedFiles.join(', ')}`, 'warning')
      this.project.pages.push(...pages)
    },

    exportProject() {
      if (!this.project) return
      const blob = new Blob([JSON.stringify(this.project)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `project.json`; a.click(); URL.revokeObjectURL(url)
    },

    setViewingOriginal(value: boolean) { this.isViewingOriginal = value },
    setShowMasks(value: boolean) { this.showMasks = value },
    setExporting(value: boolean, progress?: number) {
      this.isExporting = value
      if (progress !== undefined) this.exportProgress = progress
      else if (!value) this.exportProgress = 0
    },

    updatePage(pageId: string, updates: Partial<Omit<Page, 'id'>>) {
      if (!this.project) return
      const page = this.project.pages.find((p) => p.id === pageId)
      if (page) Object.assign(page, updates)
    },

    async addMask(pageId: string, mask: MaskRegion) {
      await this.executeEditAction(pageId, 'mask:add', (page) => { page.masks.push(mask) })
    },

    async deleteMask(pageId: string, maskId: string) {
      await this.executeEditAction(pageId, 'mask:delete', (page) => { page.masks = page.masks.filter((m) => m.id !== maskId) })
    },

    async updateMask(pageId: string, maskId: string, updates: Partial<Omit<MaskRegion, 'id'>>) {
      await this.executeEditAction(pageId, 'mask:modify', (page) => {
        const mask = page.masks.find((m) => m.id === maskId)
        if (mask) Object.assign(mask, updates)
      })
    },

    async executeFillOnPage(pageId: string, options: { enableHalftone: boolean; stampMode: boolean; stampSourceRect?: any }) {
      await this.executeEditAction(pageId, 'fill:execute', async (page) => {
        const { getCanvasToImageInfo } = await import('../services/canvas')
        const { executeInpaintHighRes } = await import('../services/inpaint')
        const canvasInfo = getCanvasToImageInfo()
        if (!canvasInfo) return
        const newSnapshot = await executeInpaintHighRes(page.originalSnapshot, page.canvasSnapshot, page.masks, canvasInfo, options)
        page.canvasSnapshot = newSnapshot
        page.masks = []
      })
    },

    async addTextObject(pageId: string, textObj: TextObject) {
      await this.executeEditAction(pageId, 'text:create', (page) => { page.textObjects.push(textObj) })
    },

    async updateTextObject(pageId: string, textObjId: string, updates: Partial<Omit<TextObject, 'id'>>) {
      await this.executeEditAction(pageId, 'text:modify', (page) => {
        const obj = page.textObjects.find((t) => t.id === textObjId)
        if (obj) Object.assign(obj, updates)
      })
    },

    async deleteTextObject(pageId: string, textObjId: string) {
      await this.executeEditAction(pageId, 'text:delete', (page) => { page.textObjects = page.textObjects.filter((t) => t.id !== textObjId) })
    },

    applyPreset(presetId: string, textObjectId: string) {
      if (!this.project) return
      this.executeEditAction(this.project.activePageId, 'preset:apply', (page) => {
        const preset = this.project!.textPresets.find((p) => p.id === presetId)
        if (!preset) return
        const obj = page.textObjects.find((t) => t.id === textObjectId)
        if (!obj) return
        Object.assign(obj, { ...preset })
      })
    },
  },
})
