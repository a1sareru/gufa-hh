<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import { useToolStore } from '../stores/toolStore'
import { useHistoryStore } from '../stores/historyStore'
import { exportAllAsZip, downloadBlob, exportPageAsBlob } from '../services/export'

const editorStore = useEditorStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()

const activeTool = computed(() => toolStore.activeTool)
const canUndo = computed(() => historyStore.canUndo)
const canRedo = computed(() => historyStore.canRedo)

const tools = [
  { id: 'select', label: '選擇', icon: '↖️', chinese: '選擇' },
  { id: 'lasso', label: '套索', icon: '⬢', chinese: '套索' },
  { id: 'rect', label: '矩形', icon: '⬜', chinese: '矩形' },
  { id: 'text', label: '文字', icon: 'T', chinese: '文字' },
  { id: 'pan', label: '平移', icon: '🖐️', chinese: '平移' },
] as const

const handleFileImport = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const result = await editorStore.appendPages(Array.from(input.files))
    console.log('Imported', result)
  }
}

const handleExportPage = async () => {
  if (editorStore.activePage) {
    const blob = await exportPageAsBlob(editorStore.activePage, 'png')
    downloadBlob(blob, `${editorStore.activePage.fileName.split('.')[0]}_edited.png`)
  }
}

const handleExportAll = async () => {
  if (editorStore.project) {
    editorStore.setExporting(true, 0)
    const blob = await exportAllAsZip(
      editorStore.project.pages,
      'png',
      (curr, total) => {
        editorStore.setExporting(true, (curr / total) * 100)
      }
    )
    downloadBlob(blob, `export_${Date.now()}.zip`)
    editorStore.setExporting(false)
  }
}
</script>

<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :class="{ active: activeTool === tool.id }"
        @click="toolStore.setTool(tool.id)"
        :title="tool.label"
      >
        <span class="icon">{{ tool.icon }}</span>
        <span class="label">{{ tool.chinese }}</span>
      </button>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <button :disabled="!canUndo" @click="historyStore.undo()" title="撤銷">
        ↩️ 撤銷
      </button>
      <button :disabled="!canRedo" @click="historyStore.redo()" title="重做">
        ↪️ 重做
      </button>
    </div>

    <div class="divider"></div>

    <div class="tool-group">
      <label class="btn-file" title="導入更多圖片到當前專案">
        📁 導入圖片
        <input type="file" multiple accept="image/png,image/jpeg" @change="handleFileImport" hidden />
      </label>
      <button @click="handleExportPage" :disabled="!editorStore.activePage" title="導出當前頁面為 PNG">
        📄 導出圖片
      </button>
      <button @click="handleExportAll" :disabled="!editorStore.project" title="批量導出所有頁面為 ZIP">
        📦 批量導出
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: 48px;
  background: #fff;
  border-bottom: 2px solid #000;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 8px;
  z-index: 10;
}

.tool-group {
  display: flex;
  gap: 4px;
}

.divider {
  width: 2px;
  height: 24px;
  background: #eee;
  margin: 0 4px;
}

button, .btn-file {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #000;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

button:hover, .btn-file:hover {
  background: #f0f0f0;
}

button.active {
  background: #000;
  color: #fff;
}

button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon {
  font-size: 16px;
}
</style>
