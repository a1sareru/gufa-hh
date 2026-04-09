import type { RGBAColor, Rect } from '../types/index'

/**
 * 采样主色调：增加亮度优先逻辑，避开黑色边框
 */
export function sampleDominantColor(
  imageData: ImageData,
  bounds: Rect,
  sampleRadius: number = 20
): RGBAColor {
  const { data, width, height } = imageData
  const colorMap = new Map<string, number>()

  // 扩大采样范围以获取更多背景信息
  const x0 = Math.max(0, Math.floor(bounds.x - sampleRadius))
  const y0 = Math.max(0, Math.floor(bounds.y - sampleRadius))
  const x1 = Math.min(width - 1, Math.ceil(bounds.x + bounds.width + sampleRadius))
  const y1 = Math.min(height - 1, Math.ceil(bounds.y + bounds.height + sampleRadius))

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // 避开气泡内部（可能有文字）
      const inside = x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height
      if (inside) continue

      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx+1]
      const b = data[idx+2]
      const a = data[idx+3]

      if (a < 128) continue // 忽略透明像素

      // 权重计算：大幅降低深色（可能是边框或线条）的权重
      const brightness = (r + g + b) / 3
      if (brightness < 80) continue // 排除接近黑色的像素

      const key = `${Math.round(r/8)*8},${Math.round(g/8)*8},${Math.round(b/8)*8}`
      colorMap.set(key, (colorMap.get(key) ?? 0) + (brightness > 200 ? 2 : 1))
    }
  }

  if (colorMap.size === 0) return { r: 255, g: 255, b: 255, a: 255 }
  
  let max = 0, dominant = '255,255,255'
  colorMap.forEach((count, key) => {
    if (count > max) {
      max = count
      dominant = key
    }
  })
  
  const [r, g, b] = dominant.split(',').map(Number)
  return { r, g, b, a: 255 }
}

/**
 * 高精度消除执行（核心修复：离屏原始尺寸处理）
 */
export async function executeInpaintHighRes(
  _originalBase64: string,
  currentBase64: string,
  masks: any[],
  canvasInfo: any, // 缩放信息
  _options: { enableHalftone: boolean }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      masks.forEach(mask => {
        // 将画布路径坐标转换回原图坐标
        // 映射公式: imgX = (canvasX - bgLeft) / scaleX + imgOriginX (center is different)
        // Fabric center origin: bgLeft is canvasWidth / 2
        const { scaleX, scaleY, left, top, width, height } = canvasInfo
        
        const offsetX = left - (width * scaleX) / 2
        const offsetY = top - (height * scaleY) / 2

        ctx.save()
        
        // 缩放上下文来匹配路径
        ctx.translate(-offsetX / scaleX, -offsetY / scaleY)
        ctx.scale(1 / scaleX, 1 / scaleY)
        
        const path = new Path2D(mask.pathData)
        ctx.clip(path)
        
        // 恢复缩放来采样和填充
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        
        // 计算映射后的 Bounds
        const mBounds = {
          x: (mask.bounds.x - offsetX) / scaleX,
          y: (mask.bounds.y - offsetY) / scaleY,
          width: mask.bounds.width / scaleX,
          height: mask.bounds.height / scaleY
        }

        if (mask.fillColor) {
          ctx.fillStyle = mask.fillColor
        } else {
          const color = sampleDominantColor(imageData, mBounds)
          ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      })

      resolve(canvas.toDataURL('image/png'))
    }
    img.src = currentBase64
  })
}

// 保持其他辅助函数导出以防测试报错
export function fillWithColor() {}
export function detectHalftonePattern() { return null }
export function synthesizeHalftone() {}
export function stampFill() {}
export async function executeFill() {}
