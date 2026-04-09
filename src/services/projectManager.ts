import type { Project, Page } from '../types/index'

/**
 * 生成唯一 id
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * 校验文件格式（仅接受 PNG/JPG）
 */
export function isValidImageFile(file: File): boolean {
  return file.type === 'image/png' || file.type === 'image/jpeg'
}

/**
 * 将 File 读取为 base64 字符串
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 创建新项目（按文件名字母序排列页面）
 * 返回 { project, skippedFiles } 其中 skippedFiles 是被跳过的无效文件名列表
 */
export async function createProject(
  files: File[]
): Promise<{ project: Project; skippedFiles: string[] }> {
  const skippedFiles: string[] = []
  const validFiles: File[] = []

  for (const file of files) {
    if (isValidImageFile(file)) {
      validFiles.push(file)
    } else {
      skippedFiles.push(file.name)
    }
  }

  // 按文件名字母升序排列
  validFiles.sort((a, b) => a.name.localeCompare(b.name))

  const pages: Page[] = await Promise.all(
    validFiles.map(async (file) => {
      const base64 = await fileToBase64(file)
      return {
        id: generateId(),
        fileName: file.name,
        originalSnapshot: base64,
        canvasSnapshot: base64,
        masks: [],
        textObjects: [],
        history: [],
        historyIndex: -1,
      }
    })
  )

  const project: Project = {
    id: generateId(),
    name: '未命名專案',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages,
    activePageId: pages[0]?.id ?? '',
    textPresets: [],
  }

  return { project, skippedFiles }
}

/**
 * 向现有项目追加页面（追加至末尾）
 * 返回 { pages, skippedFiles }
 */
export async function appendPages(
  files: File[]
): Promise<{ pages: Page[]; skippedFiles: string[] }> {
  const skippedFiles: string[] = []
  const validFiles: File[] = []

  for (const file of files) {
    if (isValidImageFile(file)) {
      validFiles.push(file)
    } else {
      skippedFiles.push(file.name)
    }
  }

  const pages: Page[] = await Promise.all(
    validFiles.map(async (file) => {
      const base64 = await fileToBase64(file)
      return {
        id: generateId(),
        fileName: file.name,
        originalSnapshot: base64,
        canvasSnapshot: base64,
        masks: [],
        textObjects: [],
        history: [],
        historyIndex: -1,
      }
    })
  )

  return { pages, skippedFiles }
}

/**
 * 删除页面（返回更新后的 pages 数组，若只剩一页则返回 null 表示拒绝）
 */
export function deletePage(pages: Page[], pageId: string): Page[] | null {
  if (pages.length <= 1) return null
  return pages.filter((p) => p.id !== pageId)
}

/**
 * 重排页面（按 newOrder 中的 id 顺序重排，忽略 newOrder 中不存在的 id）
 */
export function reorderPages(pages: Page[], newOrder: string[]): Page[] {
  const pageMap = new Map(pages.map((p) => [p.id, p]))
  const reordered: Page[] = []

  for (const id of newOrder) {
    const page = pageMap.get(id)
    if (page) {
      reordered.push(page)
    }
  }

  return reordered
}
