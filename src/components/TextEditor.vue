<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import { useToolStore } from '../stores/toolStore'
import { syncObjectsToCanvas } from '../services/canvas'

const props = defineProps<{
  pageId: string
  textObjectId: string
  x: number
  y: number
}>()

const emit = defineEmits(['close'])

const editorStore = useEditorStore()
const toolStore = useToolStore()
const textObject = computed(() => {
  const page = editorStore.project?.pages.find(p => p.id === props.pageId)
  return page?.textObjects.find(t => t.id === props.textObjectId)
})

const editingContent = ref('')

watch(textObject, (val) => {
  if (val) {
    editingContent.value = val.content
  }
}, { immediate: true })

const save = () => {
  if (textObject.value) {
    editorStore.updateTextObject(props.pageId, props.textObjectId, {
      content: editingContent.value
    })
    const page = editorStore.project?.pages.find(p => p.id === props.pageId)
    if (page) {
      syncObjectsToCanvas(page, toolStore.selectedObjectId, editorStore.showMasks)
    }
  }
  emit('close')
}

const cancel = () => {
  emit('close')
}

// 自动聚焦
const textareaRef = ref<HTMLTextAreaElement | null>(null)
onMounted(() => {
  textareaRef.value?.focus()
})

</script>

<template>
  <div class="text-editor-overlay" :style="{ left: x + 'px', top: y + 'px' }">
    <textarea 
      ref="textareaRef" 
      v-model="editingContent"
      class="editor-textarea"
      @keydown.esc="cancel"
      @keydown.meta.enter="save"
      @keydown.ctrl.enter="save"
    ></textarea>
    <div class="editor-actions">
      <button @click="save">确定</button>
      <button @click="cancel">取消</button>
    </div>
  </div>
</template>

<style scoped>
.text-editor-overlay {
  position: absolute;
  background: #fff;
  border: 1px solid #000;
  padding: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 2px 2px 0 #000;
}

.editor-textarea {
  width: 200px;
  height: 100px;
  border: 1px solid #000;
  font-family: inherit;
  font-size: 14px;
  resize: both;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.editor-actions button {
  background: #fff;
  border: 1px solid #000;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}

.editor-actions button:hover {
  background: #eee;
}
</style>
