<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import ToolBar from './components/ToolBar.vue'
import PageList from './components/PageList.vue'
import CanvasEditor from './components/CanvasEditor.vue'
import ParamPanel from './components/ParamPanel.vue'
import { useEditorStore } from './stores/editorStore'
import { useToolStore } from './stores/toolStore'
import { useHistoryStore } from './stores/historyStore'
import { loadProject, clearProject } from './utils/storage'
import { setupKeyboardShortcuts } from './utils/keyboard'
import { loadPresetFonts } from './services/fontLoader'
import { createProject } from './services/projectManager'

const editorStore = useEditorStore()
const toolStore = useToolStore()
const historyStore = useHistoryStore()

const isLoaded = ref(false)
const showImportUI = computed(() => !editorStore.project)

let keyboardCleanup: (() => void) | null = null

onMounted(async () => {
  // 1. 加載預置字體
  await loadPresetFonts()

  // 2. 註冊鍵盤快捷鍵
  keyboardCleanup = setupKeyboardShortcuts(
    { editor: editorStore, tool: toolStore, history: historyStore },
    {
      onSave: () => editorStore.autoSave(),
      onExport: async () => {
        const { exportPageAsBlob } = await import('./services/export')
        if (editorStore.activePage) {
          const blob = await exportPageAsBlob(editorStore.activePage, 'png')
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${editorStore.activePage.fileName.split('.')[0]}_edited.png`
          a.click()
          URL.revokeObjectURL(url)
        }
      },
      onNextPage: () => {
        const index = editorStore.activePageIndex
        if (index < editorStore.project!.pages.length - 1) {
          editorStore.setActivePage(editorStore.project!.pages[index + 1].id)
        }
      },
      onPrevPage: () => {
        const index = editorStore.activePageIndex
        if (index > 0) {
          editorStore.setActivePage(editorStore.project!.pages[index - 1].id)
        }
      },
      onDeleteSelected: async () => {
        const { getCanvas } = await import('./services/canvas')
        const canvas = getCanvas()
        if (canvas) {
          const activeObject = canvas.getActiveObject()
          if (activeObject) {
            const data = (activeObject as any).data
            if (data?.textObjectId) {
              editorStore.deleteTextObject(editorStore.activePage!.id, data.textObjectId)
            } else if (data?.maskId) {
              editorStore.deleteMask(editorStore.activePage!.id, data.maskId)
            }
            canvas.remove(activeObject)
            canvas.discardActiveObject()
            canvas.renderAll()
          }
        }
      }
    }
  )

  isLoaded.value = true
})

onUnmounted(() => {
  if (keyboardCleanup) {
    keyboardCleanup()
  }
})

const handleInitialImport = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const result = await createProject(Array.from(input.files))
    editorStore.setProject(result.project)
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const result = await createProject(Array.from(e.dataTransfer.files))
    editorStore.setProject(result.project)
  }
}
</script>

<template>
  <div class="app-container" @dragover.prevent @drop="handleDrop">
    <!-- 顶部工具栏 -->
    <ToolBar v-if="!showImportUI" />

    <main class="main-content" v-if="!showImportUI">
      <!-- 左侧页面列表 -->
      <PageList />

      <!-- 主画布区域 -->
      <div class="editor-area">
        <CanvasEditor />
      </div>

      <!-- 右侧参数面板 -->
      <ParamPanel />
    </main>

    <!-- 初始導入界面 -->
    <div v-if="showImportUI" class="import-overlay">
      <div class="import-card">
        <h1>古法漫畫漢化編輯器</h1>
        <p>請選擇或拖放漫畫圖片開始專案</p>
        <label class="import-btn">
          📂 選擇文件
          <input type="file" multiple accept="image/png,image/jpeg" @change="handleInitialImport" hidden />
        </label>
        <div class="drop-zone">或將文件夾/圖片拖放到此處</div>
      </div>
    </div>

    <!-- 全局通知條 -->
    <Transition name="fade">
      <div v-if="editorStore.notification" :class="['notification', editorStore.notification.type]">
        {{ editorStore.notification.message }}
        <button @click="editorStore.clearNotification()">×</button>
      </div>
    </Transition>

    <!-- 導出進度條 -->
    <div v-if="editorStore.isExporting" class="export-overlay">
      <div class="progress-box">
        <h3>正在導出...</h3>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: editorStore.exportProgress + '%' }"></div>
        </div>
        <p>{{ Math.round(editorStore.exportProgress) }}%</p>
      </div>
    </div>
  </div>
</template>

<style>
/* 全局布局样式 */
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}

.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  height: 0; /* 关键：强制 flex 子项不超出父级 */
  overflow: hidden;
}

.editor-area {
  flex: 1;
  background: #888;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 初始导入界面 */
.import-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.import-card {
  width: 400px;
  background: #fff;
  border: 2px solid #000;
  padding: 32px;
  text-align: center;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.1);
}

.import-card h1 {
  margin-bottom: 16px;
  font-size: 24px;
}

.import-btn {
  display: inline-block;
  margin: 16px 0;
  padding: 8px 16px;
  background: #000;
  color: #fff;
  font-weight: bold;
  cursor: pointer;
}

.drop-zone {
  margin-top: 24px;
  border: 2px dashed #999;
  padding: 24px;
  color: #666;
  font-size: 14px;
}

/* 通知条 */
.notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 24px;
  border: 2px solid #000;
  background: #fff;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification.error { border-color: red; color: red; }
.notification.warning { border-color: orange; color: orange; }
.notification.info { border-color: blue; color: blue; }

.notification button {
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

/* 导出进度 */
.export-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.progress-box {
  width: 300px;
  background: #fff;
  border: 2px solid #000;
  padding: 24px;
  text-align: center;
}

.progress-bar {
  height: 20px;
  background: #f0f0f0;
  border: 1px solid #000;
  margin: 16px 0;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #000;
  width: 0%;
  transition: width 0.1s linear;
}

/* 响应式 */
@media (max-width: 1024px) {
  .param-panel {
    display: none; /* 移动端简化，实际可能需要抽屉式 */
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
