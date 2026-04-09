import { useEditorStore } from '../stores/editorStore'

const CLOUD_FONTS = [
  { id: 'Noto Sans TC', name: '思源黑體' },
  { id: 'Noto Serif TC', name: '思源宋體' },
  { id: 'WenQuanYi Micro Hei', name: '文泉驛微米黑' },
  { id: 'Mizuki-Ming', name: '水木明體' },
  { id: 'JiangChengYuanTi', name: '江城圓體' },
  { id: 'RocknRoll One', name: 'RocknRoll One' },
  { id: 'Dela Gothic One', name: '德拉黑體' },
  { id: 'GenShinGothic-P-Medium', name: '源真ゴシック P Medium' },
  { id: 'GenShinGothic-P-Heavy', name: '源真ゴシック P Heavy' },
]

const SYSTEM_FONTS = [
  { id: 'Microsoft JhengHei', name: '微軟正黑體' },
  { id: 'PingFang TC', name: '蘋方-繁' },
  { id: 'DFKai-SB', name: '標楷體' },
]

/**
 * 初始化並加載所有預置字體
 */
export async function loadPresetFonts(): Promise<void> {
  const editorStore = useEditorStore()
  editorStore.initFontList([...CLOUD_FONTS, ...SYSTEM_FONTS])

  for (const font of SYSTEM_FONTS) {
    if (document.fonts.check(`12px "${font.id}"`)) {
      editorStore.updateFontStatus(font.id, 'system')
    } else {
      editorStore.updateFontStatus(font.id, 'error')
    }
  }

  if (!('fonts' in document)) return

  for (const font of CLOUD_FONTS) {
    try {
      await document.fonts.load(`16px "${font.id}"`)
      const isLoaded = document.fonts.check(`16px "${font.id}"`)
      editorStore.updateFontStatus(font.id, isLoaded ? 'loaded' : 'error')
    } catch (e) {
      console.warn(`Font ${font.id} failed:`, e)
      editorStore.updateFontStatus(font.id, 'error')
    }
  }
}

/**
 * 加載本地字體文件
 */
export async function loadLocalFont(file: File): Promise<string | null> {
  const editorStore = useEditorStore()
  try {
    const reader = new FileReader()
    const fontData = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
    const fontFamily = file.name.split('.')[0]
    const fontFace = new FontFace(fontFamily, fontData)
    await fontFace.load()
    document.fonts.add(fontFace)
    editorStore.addLocalFont(fontFamily)
    return fontFamily
  } catch (e) {
    console.error('Local font failed:', e)
    return null
  }
}
