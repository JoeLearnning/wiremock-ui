/**
 * 生成 UUID v4
 * 兼容所有环境（HTTP / HTTPS / WebView），使用 Math.random 实现
 */
export function generateId(): string {
  const hex = () => Math.floor(Math.random() * 0x10).toString(16)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = parseInt(hex(), 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
