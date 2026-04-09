import { defineStore } from 'pinia'
import { useEditorStore } from './editorStore'
import type { HistoryActionType, PageSnapshot, HistoryItem } from '../types/index'

const MAX_HISTORY = 30

export const useHistoryStore = defineStore('history', {
  getters: {
    canUndo(): boolean {
      const editorStore = useEditorStore()
      const page = editorStore.activePage
      if (!page) return false
      return page.historyIndex >= 0
    },

    canRedo(): boolean {
      const editorStore = useEditorStore()
      const page = editorStore.activePage
      if (!page) return false
      return page.historyIndex < page.history.length - 1
    },
  },

  actions: {
    pushHistory(
      pageId: string,
      type: HistoryActionType,
      before: PageSnapshot,
      after: PageSnapshot
    ) {
      const editorStore = useEditorStore()
      if (!editorStore.project) return
      const page = editorStore.project.pages.find((p) => p.id === pageId)
      if (!page) return

      // 截斷重做分支
      page.history = page.history.slice(0, page.historyIndex + 1)

      // push 新記錄
      const newItem: HistoryItem = {
        id: `history-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        pageId,
        type,
        timestamp: Date.now(),
        before,
        after,
      }
      
      page.history.push(newItem)

      // 超出上限時丟棄最早記錄
      if (page.history.length > MAX_HISTORY) {
        page.history.shift()
      }

      page.historyIndex = page.history.length - 1
    },

    undo() {
      const editorStore = useEditorStore()
      const page = editorStore.activePage
      if (!page || page.historyIndex < 0) return

      const entry = page.history[page.historyIndex]
      if (!entry) return

      editorStore.updatePage(page.id, { 
        canvasSnapshot: entry.before.canvasSnapshot,
        masks: entry.before.masks,
        textObjects: entry.before.textObjects
      })
      
      const updatedPage = editorStore.project?.pages.find((p) => p.id === page.id)
      if (updatedPage) {
        updatedPage.historyIndex = page.historyIndex - 1
      }
    },

    redo() {
      const editorStore = useEditorStore()
      const page = editorStore.activePage
      if (!page || page.historyIndex >= page.history.length - 1) return

      const nextIndex = page.historyIndex + 1
      const entry = page.history[nextIndex]
      if (!entry) return

      editorStore.updatePage(page.id, { 
        canvasSnapshot: entry.after.canvasSnapshot,
        masks: entry.after.masks,
        textObjects: entry.after.textObjects
      })
      
      const updatedPage = editorStore.project?.pages.find((p) => p.id === page.id)
      if (updatedPage) {
        updatedPage.historyIndex = nextIndex
      }
    },
  },
})
