import type { useEditorStore } from '../stores/editorStore'
import type { useHistoryStore } from '../stores/historyStore'
import type { useToolStore } from '../stores/toolStore'

export interface KeyboardStores {
  editor: ReturnType<typeof useEditorStore>
  tool: ReturnType<typeof useToolStore>
  history: ReturnType<typeof useHistoryStore>
}

/**
 * 检查焦点是否在输入框内（input / textarea / contentEditable）
 */
export function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

/**
 * 注册全局键盘快捷键，返回清理函数
 */
export function setupKeyboardShortcuts(
  stores: KeyboardStores,
  callbacks: {
    onSave?: () => void
    onExport?: () => void
    onNextPage?: () => void
    onPrevPage?: () => void
    onDeleteSelected?: () => void
  }
): () => void {
  const { tool, history } = stores

  // 记录 Space 按下前的工具，避免重复触发
  let spaceDown = false

  function handleKeyDown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const key = e.key

    // ── Ctrl 组合键（无论焦点位置均响应）──────────────────────────────────

    if (ctrl) {
      switch (key) {
        case 'z':
        case 'Z':
          e.preventDefault()
          if (shift) {
            history.redo()
          } else {
            history.undo()
          }
          return

        case 'y':
        case 'Y':
          e.preventDefault()
          history.redo()
          return

        case 's':
        case 'S':
          e.preventDefault()
          callbacks.onSave?.()
          return

        case 'e':
        case 'E':
          e.preventDefault()
          callbacks.onExport?.()
          return
      }
    }

    // ── 翻页（无论焦点位置均响应）────────────────────────────────────────

    if (key === 'PageDown') {
      callbacks.onNextPage?.()
      return
    }
    if (key === 'PageUp') {
      callbacks.onPrevPage?.()
      return
    }

    // ── 以下快捷键：输入框内不响应 ────────────────────────────────────────

    if (isInputFocused()) return

    switch (key) {
      case 'Delete':
      case 'Backspace':
        callbacks.onDeleteSelected?.()
        break

      case ' ':
        if (!spaceDown) {
          spaceDown = true
          tool.setTool('pan')
        }
        e.preventDefault()
        break
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') {
      if (spaceDown) {
        spaceDown = false
        if (!isInputFocused()) {
          tool.setTool(tool.previousTool)
        }
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  // 返回清理函数
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}
