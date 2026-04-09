import { defineStore } from 'pinia'
import type { ToolState, ToolType, FillParams, UserPreferences, TextPreset } from '../types/index'

const STORAGE_KEY = 'gufa_tool_preferences'

const DEFAULT_PREFERENCES: UserPreferences = {
  textDefaults: {
    fontFamily: 'Noto Sans TC',
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    lineHeight: 1.2,
    direction: 'vertical',
    textAlign: 'left' // 豎排默認上對齊
  },
  maskDefaults: {
    fillColor: '#ffffff'
  },
  customPresets: []
}

function loadPreferences(): UserPreferences {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return { 
        ...DEFAULT_PREFERENCES, 
        ...parsed,
        customPresets: parsed.customPresets || [] 
      }
    } catch (e) {
      console.error('Failed to load tool preferences', e)
    }
  }
  return DEFAULT_PREFERENCES
}

export const useToolStore = defineStore('tool', {
  state: (): ToolState => ({
    activeTool: 'select',
    previousTool: 'select',
    fillParams: {
      enableHalftone: false,
      stampMode: false,
    },
    selectedObjectId: null,
    preferences: loadPreferences()
  }),

  actions: {
    setTool(tool: ToolType) {
      this.previousTool = this.activeTool
      this.activeTool = tool
    },

    setBrushSize(_size: number) {
      // 畫筆已刪除，保持空函數兼容
    },

    setFillParams(params: Partial<FillParams>) {
      Object.assign(this.fillParams, params)
    },

    setSelectedObjectId(id: string | null) {
      this.selectedObjectId = id
    },

    updateTextPreferences(updates: Partial<UserPreferences['textDefaults']>) {
      Object.assign(this.preferences.textDefaults, updates)
      this.savePreferences()
    },

    updateMaskPreferences(updates: Partial<UserPreferences['maskDefaults']>) {
      Object.assign(this.preferences.maskDefaults, updates)
      this.savePreferences()
    },

    // Profile 管理
    addCustomPreset(name: string, style: Omit<TextPreset, 'id' | 'name' | 'builtin'>) {
      const newPreset: TextPreset = {
        id: `custom-${Date.now()}`,
        name,
        builtin: false,
        ...style
      }
      this.preferences.customPresets.push(newPreset)
      this.savePreferences()
    },

    deleteCustomPreset(id: string) {
      this.preferences.customPresets = this.preferences.customPresets.filter(p => p.id !== id)
      this.savePreferences()
    },

    exportPresets() {
      const blob = new Blob([JSON.stringify(this.preferences.customPresets)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `font_profiles_${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    importPresets(presets: TextPreset[]) {
      this.preferences.customPresets.push(...presets)
      this.savePreferences()
    },

    savePreferences() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences))
    }
  },
})
