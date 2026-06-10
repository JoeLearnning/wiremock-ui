import client from './client'
import type { StubMapping } from './types'

// 获取所有 Stubs
export async function getAllMappings(): Promise<{ mappings: StubMapping[] }> {
  const { data } = await client.get('/mappings')
  return data
}

// 获取单个 Stub
export async function getMapping(id: string): Promise<StubMapping> {
  const { data } = await client.get(`/mappings/${id}`)
  return data
}

// 创建 Stub
export async function createMapping(mapping: StubMapping): Promise<StubMapping> {
  const { data } = await client.post('/mappings', mapping)
  return data
}

// 更新 Stub
export async function updateMapping(id: string, mapping: StubMapping): Promise<StubMapping> {
  const { data } = await client.put(`/mappings/${id}`, mapping)
  return data
}

// 删除 Stub
export async function deleteMapping(id: string): Promise<void> {
  await client.delete(`/mappings/${id}`)
}

// 批量删除 Stubs（逐个删除，兼容所有 WireMock 版本）
export async function removeMappings(body: { ids: string[] }): Promise<void> {
  for (const id of body.ids) {
    if (id) {
      await client.delete(`/mappings/${id}`)
    }
  }
}

// 重置所有 Stubs
export async function resetMappings(): Promise<void> {
  await client.post('/mappings/reset')
}

// 保存所有 Stubs（持久化到文件）
export async function saveMappings(): Promise<void> {
  await client.post('/mappings/save')
}
