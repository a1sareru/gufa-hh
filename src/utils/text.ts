/**
 * 豎排標點符號映射表
 */
const VERTICAL_PUNCTUATION_MAP: Record<string, string> = {
  '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄',
  '（': '︵', '）': '︶', '(': '︵', ')': '︶',
  '［': '﹇', '］': '﹈', '[': '﹇', ']': '﹈',
  '【': '︻', '】': '︼',
  '〈': '︿', '〉': '﹀', '《': '︽', '》': '︾',
  '，': '︐', '。': '︒', '、': '︑', 
  '：': '︓', '；': '︔',
  '！': '︕', '？': '︖',
  '—': '︱', 'ー': '︱', '−': '︱',
  '…': '︙', '⋯': '︙'
}

/**
 * 將文本中的普通標點轉換為豎排專用標點
 */
export function convertToVerticalPunctuation(text: string): string {
  return text.split('').map(char => VERTICAL_PUNCTUATION_MAP[char] || char).join('')
}
