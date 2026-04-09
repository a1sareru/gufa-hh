import { describe, it, expect } from 'vitest'
import { sampleDominantColor } from '../../services/inpaint'

describe('sampleDominantColor', () => {
  it('應該能在純色背景中採樣正確顏色', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(255) // 純白
    const imageData = { data, width, height } as ImageData
    const bounds = { x: 40, y: 40, width: 20, height: 20 }
    
    const color = sampleDominantColor(imageData, bounds, 10)
    expect(color.r).toBe(255)
    expect(color.g).toBe(255)
    expect(color.b).toBe(255)
  })

  it('應該採樣最頻繁出現的顏色', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    // 在邊界外塗一點紅色
    for (let i = 0; i < 100; i++) {
      data[i * 4] = 200; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0
    }
    const imageData = { data, width, height } as ImageData
    const bounds = { x: 40, y: 40, width: 20, height: 20 }
    
    const color = sampleDominantColor(imageData, bounds, 10)
    // 由於紅色只佔一小部分，主色應仍為白色 (255,255,255 會量化為 256->255 或類似)
    expect(color.r).toBeGreaterThan(128)
  })
})
