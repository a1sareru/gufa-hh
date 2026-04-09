// ============ 基礎幾何類型 ============

/** 矩形區域 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ============ 顏色 ============

export interface RGBAColor {
  r: number
  g: number
  b: number
  a: number
}

// ============ 遮罩與填充 ============

/** 遮罩區域（現在作為氣泡的底層） */
export interface MaskRegion {
  id: string
  type: 'lasso' | 'rect'
  /** SVG path 字符串，描述遮罩形狀 */
  pathData: string
  /** 遮罩邊界框，用於採樣 */
  bounds: Rect
  /** 填充結果的 base64 圖像數據（可選，用於複雜修復） */
  filledImageData?: string
  /** 預設填充顏色 */
  fillColor?: string
  /** 關聯的文本內容（如果這個遮罩是一個氣泡） */
  text?: string
  /** 變換信息（支持移動、縮放等） */
  transform?: FabricTransform
}

export interface HalftonePattern {
  dotSpacing: number   // 網點間距（像素）
  angle: number        // 網點角度（度）
  dotRadius: number    // 網點半徑
}

// ============ 文字 ============

export interface FabricTransform {
  left: number
  top: number
  scaleX: number
  scaleY: number
  angle: number
}

/** 文字對象 */
export interface TextObject {
  id: string
  content: string
  direction: 'horizontal' | 'vertical'
  textAlign: 'left' | 'center' | 'right'
  fontFamily: string
  fontSize: number          // 8-200
  fontWeight: string | number
  color: string             // CSS 顏色字符串
  strokeColor: string
  strokeWidth: number       // 0-20
  lineHeight: number        // 0.5-5.0
  letterSpacing: number     // -10 to 50
  /** Fabric 對象的變換矩陣 */
  transform: FabricTransform
  /** 關聯氣泡遮罩 ID */
  balloonMaskId?: string
}

/** 文字樣式預設 */
export interface TextPreset {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  color: string
  strokeColor: string
  strokeWidth: number
  lineHeight: number
  letterSpacing: number
  direction: 'horizontal' | 'vertical'
  textAlign: 'left' | 'center' | 'right'
  builtin?: boolean
}

// ============ 頁面與項目 ============

/** 單個頁面的完整狀態 */
export interface Page {
  id: string
  fileName: string
  /** 原始底圖的 base64 或 URL */
  originalSnapshot: string
  /** 當前編輯狀態的底圖（包含填充後的結果） */
  canvasSnapshot: string
  /** 遮罩層列表 */
  masks: MaskRegion[]
  /** 文字層列表 */
  textObjects: TextObject[]
  /** 歷史記錄 */
  history: HistoryItem[]
  /** 當前歷史記錄索引 */
  historyIndex: number
}

/** 項目完整數據 */
export interface Project {
  id: string
  name: string
  pages: Page[]
  activePageId: string
  textPresets: TextPreset[]
  createdAt: number
  updatedAt: number
}

// ============ 應用狀態 ============

export interface FontStatus {
  id: string
  name: string
  status: 'loading' | 'loaded' | 'error' | 'system'
}

export interface EditorState {
  project: Project | null
  isViewingOriginal: boolean
  isExporting: boolean
  exportProgress: number
  notification: {
    message: string
    type: 'info' | 'error' | 'warning'
  } | null
  showMasks: boolean
  /** 字體狀態列表 */
  fonts: FontStatus[]
  localFonts: string[]
}

export type ToolType = 'select' | 'lasso' | 'rect' | 'text' | 'pan'

export interface FillParams {
  enableHalftone: boolean
  stampMode: boolean
  stampSourceRect?: Rect
}

/** 用於儲存的用戶偏好（黏性設置） */
export interface UserPreferences {
  textDefaults: {
    fontFamily: string
    fontSize: number
    fontWeight: string | number
    color: string
    strokeColor: string
    strokeWidth: number
    lineHeight: number
    direction: 'horizontal' | 'vertical'
    textAlign: 'left' | 'center' | 'right'
  }
  maskDefaults: {
    fillColor: string
  }
  customPresets: TextPreset[]
}

export interface ToolState {
  activeTool: ToolType
  previousTool: ToolType
  fillParams: FillParams
  selectedObjectId: string | null
  preferences: UserPreferences
}

/** 歷史記錄快照 */
export interface PageSnapshot {
  id: string
  fileName: string
  originalSnapshot: string
  canvasSnapshot: string
  masks: MaskRegion[]
  textObjects: TextObject[]
}

/** 歷史操作類型 */
export type HistoryActionType =
  | 'mask:add'
  | 'mask:delete'
  | 'mask:modify'
  | 'fill:execute'
  | 'text:create'
  | 'text:modify'
  | 'text:delete'
  | 'preset:apply'

export interface HistoryItem {
  id: string
  pageId: string
  type: HistoryActionType
  before: PageSnapshot
  after: PageSnapshot
  timestamp: number
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}
