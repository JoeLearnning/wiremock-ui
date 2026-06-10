import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as mappingsApi from '@/api/mappings'
import { SYSTEM_MOCK_UUID } from '@/api/settings'
import type { StubMapping } from '@/api/types'

export const useMappingsStore = defineStore('mappings', () => {
  const mappings = ref<StubMapping[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMappings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await mappingsApi.getAllMappings()
      // 过滤掉系统 Mock（用于存储分组数据的隐藏 stub）
      mappings.value = (res.mappings || []).filter(
        (m) => (m.uuid || m.id) !== SYSTEM_MOCK_UUID
      )
    } catch (e: any) {
      error.value = e.message || '获取 Mock 列表失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createMapping(mapping: StubMapping): Promise<StubMapping> {
    const result = await mappingsApi.createMapping(mapping)
    await fetchMappings()
    return result
  }

  async function updateMapping(id: string, mapping: StubMapping): Promise<StubMapping> {
    const result = await mappingsApi.updateMapping(id, mapping)
    await fetchMappings()
    return result
  }

  async function deleteMapping(id: string): Promise<void> {
    await mappingsApi.deleteMapping(id)
    await fetchMappings()
  }

  async function resetAll(): Promise<void> {
    await mappingsApi.resetMappings()
    await fetchMappings()
  }

  async function removeByIds(ids: string[]): Promise<void> {
    await mappingsApi.removeMappings({ ids })
    await fetchMappings()
  }

  return {
    mappings,
    loading,
    error,
    fetchMappings,
    createMapping,
    updateMapping,
    deleteMapping,
    resetAll,
    removeByIds
  }
})
