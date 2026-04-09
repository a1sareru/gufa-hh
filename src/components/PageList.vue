<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import { appendPages, deletePage, reorderPages } from '../services/projectManager'

const editorStore = useEditorStore()

const pages = computed(() => editorStore.project?.pages || [])
const activePageId = computed(() => editorStore.project?.activePageId)

// 渲染缩略图
const thumbnailCanvases = ref<Map<string, HTMLCanvasElement>>(new Map())

const setCanvasRef = (el: any, pageId: string) => {
  if (el) {
    thumbnailCanvases.value.set(pageId, el as HTMLCanvasElement)
    renderThumbnail(pageId)
  }
}

const renderThumbnail = (pageId: string) => {
  const page = pages.value.find(p => p.id === pageId)
  const canvas = thumbnailCanvases.value.get(pageId)
  if (!page || !canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    const ratio = Math.min(100 / img.width, 140 / img.height)
    canvas.width = img.width * ratio
    canvas.height = img.height * ratio
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = page.canvasSnapshot
}

// 监听页面变化，更新缩略图
watch(pages, () => {
  nextTick(() => {
    pages.value.forEach(p => renderThumbnail(p.id))
  })
}, { deep: true })

// 切换页面
const selectPage = (pageId: string) => {
  editorStore.setActivePage(pageId)
}

// 删除页面
const removePage = (pageId: string) => {
  if (!editorStore.project) return
  
  const result = deletePage(editorStore.project.pages, pageId)
  if (result === null) {
    editorStore.setNotification('無法刪除最後一頁', 'warning')
    return
  }

  const isDeletingActive = editorStore.project.activePageId === pageId
  editorStore.project.pages = result
  
  if (isDeletingActive) {
    editorStore.project.activePageId = result[0].id
  }
}

// 添加页面
const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileInput = () => fileInput.value?.click()

const handleFileChange = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0 || !editorStore.project) return

  const { pages: newPages, skippedFiles } = await appendPages(Array.from(files))
  
  if (skippedFiles.length > 0) {
    editorStore.setNotification(`跳過了非圖片文件: ${skippedFiles.join(', ')}`, 'warning')
  }

  if (newPages.length > 0) {
    editorStore.project.pages.push(...newPages)
  }
  
  // 重置 file input
  if (fileInput.value) fileInput.value.value = ''
}

// 拖拽排序
const draggedPageId = ref<string | null>(null)

const onDragStart = (pageId: string) => {
  draggedPageId.value = pageId
}

const onDrop = (targetPageId: string) => {
  if (!draggedPageId.value || draggedPageId.value === targetPageId || !editorStore.project) return

  const currentOrder = editorStore.project.pages.map(p => p.id)
  const fromIndex = currentOrder.indexOf(draggedPageId.value)
  const toIndex = currentOrder.indexOf(targetPageId)

  currentOrder.splice(fromIndex, 1)
  currentOrder.splice(toIndex, 0, draggedPageId.value)

  editorStore.project.pages = reorderPages(editorStore.project.pages, currentOrder)
  draggedPageId.value = null
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
}

</script>

<template>
  <div class="page-list">
    <div class="list-header">
      <h3>頁面管理</h3>
      <button class="add-btn" @click="triggerFileInput">+ 添加頁面</button>
      <input 
        type="file" 
        ref="fileInput" 
        multiple 
        accept="image/png,image/jpeg" 
        style="display: none" 
        @change="handleFileChange"
      />
    </div>
    
    <div class="pages-container">
      <div 
        v-for="(page, index) in pages" 
        :key="page.id"
        class="page-item"
        :class="{ active: page.id === activePageId }"
        draggable="true"
        @dragstart="onDragStart(page.id)"
        @dragover="onDragOver"
        @drop="onDrop(page.id)"
        @click="selectPage(page.id)"
      >
        <div class="page-num">{{ index + 1 }}</div>
        <div class="thumbnail-wrapper">
          <canvas :ref="el => setCanvasRef(el, page.id)"></canvas>
        </div>
        <div class="page-info">
          <span class="file-name" :title="page.fileName">{{ page.fileName }}</span>
          <button class="delete-btn" @click.stop="removePage(page.id)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #000;
  background: #eee;
  width: 180px;
}

.list-header {
  padding: 8px;
  border-bottom: 1px solid #000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-header h3 {
  margin: 0;
  font-size: 14px;
}

.add-btn {
  background: #fff;
  border: 1px solid #000;
  padding: 4px;
  cursor: pointer;
  font-size: 12px;
}

.add-btn:hover {
  background: #ddd;
}

.pages-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-item {
  border: 1px solid #000;
  background: #fff;
  padding: 4px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-item.active {
  outline: 2px solid #000;
  background: #fff;
}

.page-num {
  position: absolute;
  top: 4px;
  left: 4px;
  background: #000;
  color: #fff;
  font-size: 10px;
  padding: 0 4px;
  z-index: 1;
}

.thumbnail-wrapper {
  width: 100px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9f9f9;
  margin-bottom: 4px;
}

.page-info {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  overflow: hidden;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
}

.delete-btn:hover {
  color: red;
}
</style>
