import type { Project } from '../types/index'

const STORAGE_KEY = 'manga-editor-project'

/**
 * 保存项目至 localStorage，捕获 QuotaExceededError（超出时不抛出）
 */
export function saveProject(project: Project): void {
  try {
    const serialized = JSON.stringify(project)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // 超出存储限制，静默失败，由调用方处理通知
      return
    }
    throw e
  }
}

/**
 * 从 localStorage 加载项目，JSON.parse 失败时清空缓存并返回 null
 */
export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Project
  } catch {
    clearProject()
    return null
  }
}

/**
 * 清空 localStorage 中的项目缓存
 */
export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * 估算 localStorage 剩余可用空间（字节）
 * 采用保守估算：尝试写入递增大小的字符串来探测上限
 */
export function estimateStorageAvailable(): number {
  const testKey = '__storage_test__'
  let low = 0
  let high = 10 * 1024 * 1024 // 最多测试 10MB

  // 先清理测试键
  try {
    localStorage.removeItem(testKey)
  } catch {
    return 0
  }

  // 二分查找可写入的最大字节数
  try {
    while (low < high - 1024) {
      const mid = Math.floor((low + high) / 2)
      try {
        localStorage.setItem(testKey, 'a'.repeat(mid))
        low = mid
      } catch {
        high = mid
      }
    }
  } finally {
    try {
      localStorage.removeItem(testKey)
    } catch {
      // ignore
    }
  }

  return low
}
