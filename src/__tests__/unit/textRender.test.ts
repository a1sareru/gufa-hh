import { describe, it, expect } from 'vitest'
import { clampTextStyle, convertToFullWidth } from '../../services/textRender'

describe('textRender', () => {
  it('clampTextStyle 應該限制數值範圍', () => {
    const style = { fontSize: 300, strokeWidth: 100, lineHeight: 5, letterSpacing: 100 }
    const result = clampTextStyle(style)
    expect(result.fontSize).toBe(200)
    expect(result.strokeWidth).toBe(20)
    expect(result.lineHeight).toBe(3.0)
    expect(result.letterSpacing).toBe(50)
  })

  it('convertToFullWidth 應該轉換半角為全角', () => {
    expect(convertToFullWidth('abc')).toBe('ａｂｃ')
    expect(convertToFullWidth('123')).toBe('１２３')
    expect(convertToFullWidth(' ')).toBe('\u3000')
  })
})
