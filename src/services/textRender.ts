import { fabric } from 'fabric'
import { convertToVerticalPunctuation } from '../utils/text'

/**
 * 將半角字符轉換為全角字符
 */
export function convertToFullWidth(str: string): string {
  return str.replace(/[!-~]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xfee0))
            .replace(/ /g, '\u3000') // 半角空格轉全角空格
}

/**
 * 判斷字元是否為需要手動旋轉的標點
 */
export function isPunctuationForRotation(char: string): boolean {
  const puncts = '～~'
  return puncts.includes(char)
}

/**
 * 將豎排文字渲染為 Fabric 對象集合
 */
export function renderVerticalTextToObjects(params: {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  color: string
  strokeColor: string
  strokeWidth: number
  lineHeight: number
  letterSpacing: number
  textAlign?: 'left' | 'center' | 'right'
}): fabric.Object[] {
  const {
    content,
    fontFamily,
    fontSize,
    fontWeight,
    color,
    strokeColor,
    strokeWidth,
    lineHeight,
    letterSpacing,
    textAlign = 'left'
  } = params

  // 1. 標點符號轉換 (轉換為豎排專用字形)
  const verticalContent = convertToVerticalPunctuation(content)
  // 2. 全角轉換
  const processedContent = convertToFullWidth(verticalContent)
  
  const lines = processedContent.split('\n')
  const colWidth = fontSize * lineHeight
  const charHeight = fontSize + letterSpacing
  
  const maxChars = Math.max(...lines.map(l => l.length))
  const totalHeight = maxChars * charHeight
  const totalWidth = lines.length * colWidth
  
  const objects: fabric.Object[] = []

  lines.forEach((line, colIndex) => {
    const x = totalWidth - (colIndex * colWidth + colWidth / 2)
    
    let startY = 0
    if (textAlign === 'center') {
      startY = (totalHeight - line.length * charHeight) / 2
    } else if (textAlign === 'right') { // 底部對齊
      startY = totalHeight - line.length * charHeight
    }

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const y = startY + i * charHeight
      
      const isRotate = isPunctuationForRotation(char)
      
      const textObj = new fabric.Text(char, {
        left: x,
        top: y + fontSize / 2,
        fontFamily,
        fontSize,
        fontWeight,
        fill: color,
        stroke: strokeColor,
        strokeWidth,
        originX: 'center',
        originY: 'center',
        angle: isRotate ? 90 : 0,
        selectable: false,
        evented: false,
        centeredRotation: true
      })
      
      if (isRotate) {
        textObj.set({ left: x + fontSize * 0.05 })
      }
      
      objects.push(textObj)
    }
  })

  return objects
}

export function renderVerticalText(_params: any): HTMLCanvasElement {
  return document.createElement('canvas')
}

export function clampTextStyle(style: {
  fontSize: number
  strokeWidth: number
  lineHeight: number
  letterSpacing: number
}) {
  return {
    fontSize: Math.min(500, Math.max(8, style.fontSize)),
    strokeWidth: Math.min(50, Math.max(0, style.strokeWidth)),
    lineHeight: Math.min(5.0, Math.max(0.5, style.lineHeight)),
    letterSpacing: Math.min(100, Math.max(-50, style.letterSpacing)),
  }
}
