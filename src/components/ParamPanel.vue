<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import { useToolStore } from '../stores/toolStore'
import { loadLocalFont } from '../services/fontLoader'
import { getCanvas, getCanvasScale, getCanvasToImageInfo } from '../services/canvas'

const editorStore = useEditorStore()
const toolStore = useToolStore()

const activeTool = computed(() => toolStore.activeTool)
const activePage = computed(() => editorStore.activePage)
const selectedObjectId = computed(() => toolStore.selectedObjectId)

const selectedTextObject = computed(() => {
  if (!activePage.value || !selectedObjectId.value) return null
  return activePage.value.textObjects.find(t => t.id === selectedObjectId.value) || null
})

const selectedMask = computed(() => {
  if (!activePage.value || !selectedObjectId.value) return null
  return activePage.value.masks.find(m => m.id === selectedObjectId.value) || null
})

// 本地編輯狀態
const localParams = ref({
  content: '',
  fontFamily: toolStore.preferences.textDefaults.fontFamily,
  fontSize: toolStore.preferences.textDefaults.fontSize,
  fontWeight: toolStore.preferences.textDefaults.fontWeight,
  color: toolStore.preferences.textDefaults.color,
  strokeColor: toolStore.preferences.textDefaults.strokeColor,
  strokeWidth: toolStore.preferences.textDefaults.strokeWidth,
  lineHeight: toolStore.preferences.textDefaults.lineHeight,
  direction: toolStore.preferences.textDefaults.direction,
  textAlign: toolStore.preferences.textDefaults.textAlign
})

// --- 字體選擇器邏輯 ---
const isFontMenuOpen = ref(false)
const fontMenuRef = ref<HTMLDivElement | null>(null)

const toggleFontMenu = () => { isFontMenuOpen.value = !isFontMenuOpen.value }
const selectFont = (fontId: string) => {
  localParams.value.fontFamily = fontId
  isFontMenuOpen.value = false
}

const getFontStatusIcon = (status: string) => {
  switch (status) {
    case 'loaded': return '✅'
    case 'loading': return '⏳'
    case 'error': return '❌'
    case 'system': return '💻'
    default: return ''
  }
}

const handleClickOutside = (e: MouseEvent) => {
  if (fontMenuRef.value && !fontMenuRef.value.contains(e.target as Node)) {
    isFontMenuOpen.value = false
  }
}

onMounted(() => { window.addEventListener('click', handleClickOutside) })
onUnmounted(() => { window.removeEventListener('click', handleClickOutside) })

// 字體顯示名稱映射
const FONT_DISPLAY_NAMES: Record<string, string> = {
  'Noto Sans TC': '思源黑體',
  'Noto Serif TC': '思源宋體',
  'WenQuanYi Micro Hei': '文泉驛微米黑',
  'Mizuki-Ming': '水木明體',
  'JiangChengYuanTi': '江城圓體',
  'Dela Gothic One': '德拉黑體',
  'RocknRoll One': 'RocknRoll One',
  'GenShinGothic-P-Medium': '源真ゴシック P Medium',
  'GenShinGothic-P-Heavy': '源真ゴシック P Heavy',
  'Microsoft JhengHei': '微軟正黑體',
  'PingFang TC': '蘋方-繁體',
  'DFKai-SB': '標楷體',
  'Arial': 'Arial',
  'serif': '襯線體 (serif)',
  'sans-serif': '無襯線體 (sans-serif)'
}

const allAvailableFonts = computed(() => {
  const storeFonts = editorStore.fonts
  const genericIds = ['Arial', 'serif', 'sans-serif']
  const finalFonts = [...storeFonts]
  genericIds.forEach(id => {
    if (!finalFonts.find(f => f.id === id)) {
      finalFonts.push({ id, name: FONT_DISPLAY_NAMES[id] || id, status: 'system' })
    }
  })
  return finalFonts
})

const currentFont = computed(() => {
  return allAvailableFonts.value.find(f => f.id === localParams.value.fontFamily) || 
         { id: localParams.value.fontFamily, name: FONT_DISPLAY_NAMES[localParams.value.fontFamily] || localParams.value.fontFamily, status: 'loaded' }
})

// --- 局部原圖參考 ---
const referenceCanvas = ref<HTMLCanvasElement | null>(null)
const updateReferencePreview = async () => {
  if (!selectedTextObject.value || !activePage.value || !referenceCanvas.value) return
  const ctx = referenceCanvas.value.getContext('2d')
  if (!ctx) return
  const fabricCanvas = getCanvas()
  const activeObj = fabricCanvas?.getActiveObject()
  const originalImg = new Image()
  originalImg.onload = () => {
    const scale = getCanvasScale()
    const info = getCanvasToImageInfo()
    if (!info || !scale) return
    const dataObj = selectedTextObject.value!
    const offsetX = info.left - (info.width * scale) / 2
    const offsetY = info.top - (info.height * scale) / 2
    let canvasW = 100, canvasH = 100
    if (activeObj && (activeObj as any).data?.textObjectId === dataObj.id) {
      canvasW = (activeObj.width || 100) * (activeObj.scaleX || 1)
      canvasH = (activeObj.height || 100) * (activeObj.scaleY || 1)
    }
    const origW = canvasW / scale
    const origH = canvasH / scale
    const centerX = (dataObj.transform.left - offsetX) / scale
    const centerY = (dataObj.transform.top - offsetY) / scale
    const captureW = Math.max(origW * 1.5, 50)
    const captureH = Math.max(origH * 1.5, 50)
    const previewSize = 200
    referenceCanvas.value!.width = previewSize
    referenceCanvas.value!.height = previewSize
    const drawScale = Math.min(previewSize / captureW, previewSize / captureH)
    const drawW = captureW * drawScale
    const drawH = captureH * drawScale
    ctx.fillStyle = '#eee'
    ctx.fillRect(0, 0, previewSize, previewSize)
    ctx.drawImage(originalImg, centerX - captureW / 2, centerY - captureH / 2, captureW, captureH, (previewSize - drawW) / 2, (previewSize - drawH) / 2, drawW, drawH)
  }
  originalImg.src = activePage.value.originalSnapshot
}

watch(selectedTextObject, (obj) => {
  if (obj) {
    localParams.value = {
      content: obj.content,
      fontFamily: obj.fontFamily,
      fontSize: obj.fontSize,
      fontWeight: obj.fontWeight || '400',
      color: obj.color,
      strokeColor: obj.strokeColor,
      strokeWidth: obj.strokeWidth,
      lineHeight: obj.lineHeight,
      direction: obj.direction,
      textAlign: obj.textAlign
    }
    setTimeout(updateReferencePreview, 50)
  }
}, { immediate: true })

const handleApplyText = async () => {
  if (activePage.value && selectedObjectId.value) {
    const updates = { ...localParams.value }
    await editorStore.updateTextObject(activePage.value.id, selectedObjectId.value, updates)
    toolStore.updateTextPreferences(updates)
    setTimeout(updateReferencePreview, 50)
  }
}

const updateMask = async (updates: any) => {
  if (activePage.value && selectedObjectId.value) {
    await editorStore.updateMask(activePage.value.id, selectedObjectId.value, updates)
    if (updates.fillColor) toolStore.updateMaskPreferences({ fillColor: updates.fillColor })
  }
}

const handleSaveProfile = () => {
  const name = prompt('請輸入預設名稱：', '新樣式')
  if (name) toolStore.addCustomPreset(name, { ...localParams.value })
}

const applyProfile = (preset: any) => {
  localParams.value = { ...localParams.value, ...preset }
}

const fontFileInput = ref<HTMLInputElement | null>(null)
const handleFontUpload = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files?.[0]) {
    const family = await loadLocalFont(files[0])
    if (family) localParams.value.fontFamily = family
  }
}

const handleDeleteObject = async () => {
  if (activePage.value && selectedObjectId.value) {
    const isText = activePage.value.textObjects.some(t => t.id === selectedObjectId.value)
    if (isText) await editorStore.deleteTextObject(activePage.value.id, selectedObjectId.value)
    else await editorStore.deleteMask(activePage.value.id, selectedObjectId.value)
    toolStore.setSelectedObjectId(null)
  }
}

const showMasks = computed({
  get: () => editorStore.showMasks,
  set: (val) => editorStore.setShowMasks(val)
})
</script>

<template>
  <div class="param-panel">
    <!-- 1. 局部原圖參考 -->
    <div v-if="selectedTextObject" class="section reference-section">
      <h3>局部原圖參考 (1.5x)</h3>
      <canvas ref="referenceCanvas" class="ref-canvas"></canvas>
    </div>

    <!-- 2. 通用操作 -->
    <div v-if="selectedObjectId" class="section">
      <button class="danger-btn" @click="handleDeleteObject">🗑️ 刪除選中對象</button>
    </div>

    <!-- 3. 氣泡底色 -->
    <div v-if="activePage?.masks.length" class="section fill-section">
      <h3>氣泡底色</h3>
      <div v-if="selectedMask" class="selected-mask-params">
        <div class="mode-toggles">
          <button :class="{ active: selectedMask.fillColor === '#ffffff' }" @click="updateMask({ fillColor: '#ffffff' })">純白</button>
          <button :class="{ active: selectedMask.fillColor === '#000000' }" @click="updateMask({ fillColor: '#000000' })">純黑</button>
          <button :class="{ active: !selectedMask.fillColor }" @click="updateMask({ fillColor: undefined })">自動</button>
        </div>
        <div class="custom-color-row">
          <input type="color" :value="selectedMask.fillColor || '#ffffff'" @input="e => updateMask({ fillColor: (e.target as HTMLInputElement).value })" />
          <input type="text" :value="selectedMask.fillColor || ''" @change="e => updateMask({ fillColor: (e.target as HTMLInputElement).value })" placeholder="#HEX" class="hex-input" />
        </div>
      </div>
    </div>

    <!-- 4. 文字屬性 -->
    <div v-if="activeTool === 'text' || selectedTextObject" class="section">
      <h3>文字屬性</h3>
      <div v-if="selectedTextObject">
        <textarea v-model="localParams.content" rows="3" class="text-content-area" placeholder="請輸入文字..."></textarea>
        
        <!-- Word 式字體選擇器 -->
        <div class="field" ref="fontMenuRef">
          <label>字體</label>
          <div class="font-selector">
            <div class="font-trigger" @click.stop="toggleFontMenu">
              <span :style="{ fontFamily: currentFont.id }">{{ currentFont.name }}</span>
              <span class="status-icon">{{ getFontStatusIcon(currentFont.status) }}</span>
              <span class="arrow">▼</span>
            </div>
            <div v-if="isFontMenuOpen" class="font-dropdown">
              <div v-for="f in allAvailableFonts" :key="f.id" 
                   class="font-option" 
                   :class="{ active: localParams.fontFamily === f.id }"
                   @click="selectFont(f.id)">
                <span class="font-name" :style="{ fontFamily: f.id }">{{ f.name }}</span>
                <span class="font-status">{{ getFontStatusIcon(f.status) }}</span>
              </div>
              <div class="font-dropdown-footer" @click="fontFileInput?.click()">
                📁 載入本地字體...
              </div>
            </div>
          </div>
          <input type="file" ref="fontFileInput" accept=".ttf,.otf,.woff,.woff2" @change="handleFontUpload" hidden />
        </div>

        <div class="field-row-grid">
          <div class="field">
            <label>字號</label>
            <input type="number" v-model.number="localParams.fontSize" class="small-num" />
          </div>
          <div class="field">
            <label>粗細</label>
            <select v-model="localParams.fontWeight" class="small-select">
              <option value="100">100</option><option value="300">300</option><option value="400">400</option>
              <option value="500">500</option><option value="700">700</option><option value="900">900</option>
            </select>
          </div>
        </div>

        <div class="field-row-grid">
          <div class="field">
            <label>顏色</label>
            <input type="color" v-model="localParams.color" class="color-pick" />
          </div>
          <div class="field">
            <label>描邊</label>
            <div class="input-group">
              <input type="color" v-model="localParams.strokeColor" class="color-pick" />
              <input type="number" v-model.number="localParams.strokeWidth" class="tiny-num" />
            </div>
          </div>
        </div>

        <div class="field-row-grid">
          <div class="field">
            <label>方向</label>
            <div class="btn-group mini">
              <button :class="{ active: localParams.direction === 'vertical' }" @click="localParams.direction = 'vertical'">豎</button>
              <button :class="{ active: localParams.direction === 'horizontal' }" @click="localParams.direction = 'horizontal'">橫</button>
            </div>
          </div>
          <div class="field">
            <label>{{ localParams.direction === 'vertical' ? '列距' : '行距' }}</label>
            <input type="number" v-model.number="localParams.lineHeight" step="0.1" class="small-num" />
          </div>
        </div>

        <div class="btn-group mini align-group">
          <button :class="{ active: localParams.textAlign === 'left' }" @click="localParams.textAlign = 'left'">頂/左</button>
          <button :class="{ active: localParams.textAlign === 'center' }" @click="localParams.textAlign = 'center'">中</button>
          <button :class="{ active: localParams.textAlign === 'right' }" @click="localParams.textAlign = 'right'">底/右</button>
        </div>

        <button class="primary" @click="handleApplyText">✨ 套用修改</button>

        <div class="profile-box">
          <div class="profile-header">
            <h4>樣式存檔 (Profiles)</h4>
            <button class="add-profile" @click="handleSaveProfile">+</button>
          </div>
          <div class="profile-list">
            <div v-for="p in toolStore.preferences.customPresets" :key="p.id" class="profile-item">
              <span @click="applyProfile(p)">{{ p.name }}</span>
              <button @click="toolStore.deleteCustomPreset(p.id)">×</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.param-panel { width: 260px; background: #f0f0f0; border-left: 2px solid #000; padding: 8px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; height: 100%; }
.section { border: 1px solid #000; background: #fff; padding: 8px; margin-bottom: 2px; }
.section h3 { margin: -8px -8px 8px -8px; font-size: 11px; background: #000; color: #fff; padding: 4px 8px; }
.field { margin-bottom: 6px; position: relative; }
.field label { font-size: 10px; font-weight: bold; display: block; margin-bottom: 2px; }
.field-row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.text-content-area { width: 100%; border: 1px solid #000; padding: 4px; font-size: 12px; resize: vertical; min-height: 50px; margin-bottom: 8px; }
.font-selector { border: 1px solid #000; position: relative; background: #fff; cursor: pointer; }
.font-trigger { padding: 4px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.font-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.font-dropdown { position: absolute; top: 100%; left: -1px; width: calc(100% + 2px); background: #fff; border: 1px solid #000; z-index: 100; max-height: 300px; overflow-y: auto; box-shadow: 2px 2px 0 rgba(0,0,0,0.1); }
.font-option { padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
.font-option:hover { background: #f0f0f0; }
.font-option.active { background: #000; color: #fff; }
.font-name { font-size: 14px; }
.font-status { font-size: 10px; opacity: 0.7; }
.font-dropdown-footer { padding: 6px 8px; font-size: 11px; background: #f9f9f9; color: #666; border-top: 1px solid #000; text-align: center; }
.small-num { width: 100%; border: 1px solid #000; padding: 2px; }
.tiny-num { width: 40px; border: 1px solid #000; padding: 2px; }
.color-pick { width: 100%; height: 24px; padding: 0; border: 1px solid #000; cursor: pointer; }
.small-select { width: 100%; font-size: 11px; border: 1px solid #000; height: 24px; }
.primary { width: 100%; padding: 8px; background: #000; color: #fff; border: 2px solid #000; cursor: pointer; font-weight: bold; margin-top: 8px; }
.danger-btn { width: 100%; padding: 4px; background: #fff; color: #c00; border: 1px solid #c00; cursor: pointer; font-size: 10px; margin-bottom: 4px; }
.profile-box { margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 8px; }
.profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.profile-header h4 { font-size: 10px; margin: 0; }
.add-profile { border: 1px solid #000; background: #eee; padding: 0 6px; cursor: pointer; }
.profile-list { max-height: 100px; overflow-y: auto; border: 1px solid #eee; }
.profile-item { display: flex; justify-content: space-between; padding: 4px; font-size: 11px; border-bottom: 1px solid #f9f9f9; cursor: pointer; }
.profile-item:hover { background: #f0f0f0; }
.btn-group.mini { display: flex; gap: 2px; width: 100%; }
.btn-group.mini button { flex: 1; padding: 2px; font-size: 10px; border: 1px solid #000; background: #fff; cursor: pointer; }
.btn-group.mini button.active { background: #000; color: #fff; }
.align-group { margin-top: 4px; }
.ref-canvas { width: 100%; height: 120px; background: #eee; border: 1px solid #000; object-fit: contain; }
.mode-toggles { display: flex; gap: 2px; margin-bottom: 4px; }
.mode-toggles button { flex: 1; padding: 2px; font-size: 10px; border: 1px solid #000; background: #fff; cursor: pointer; }
.mode-toggles button.active { background: #000; color: #fff; }
.custom-color-row { display: flex; gap: 4px; }
.hex-input { flex: 1; font-size: 10px; border: 1px solid #000; padding: 2px; text-transform: uppercase; }
.hint { font-size: 9px; color: #999; margin-top: 2px; }
</style>
