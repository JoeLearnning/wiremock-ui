import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as mappingsApi from '@/api/mappings'
import { SYSTEM_MOCK_UUID } from '@/api/settings'
import type { StubMapping } from '@/api/types'

export const useMappingsStore = defineStore('mappings', () => {
  const mappings = ref<StubMapping[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** 延时的 save 定时器 */
  let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 延时 10s 执行 /__admin/mappings/save（持久化到磁盘）
   * 如果已有正在延时的 save，则不再增加新的定时器
   */
  function scheduleSave(): void {
    if (pendingSaveTimer) {
      console.log('[mappings] 已有延时的 save，跳过')
      return
    }
    console.log('[mappings] 10s 后将自动持久化...')
    pendingSaveTimer = setTimeout(async () => {
      try {
        await mappingsApi.saveMappings()
        console.log('[mappings] 持久化完成')
      } catch (e: any) {
        console.warn('[mappings] 持久化失败:', e.message)
      } finally {
        pendingSaveTimer = null
      }
    }, 10000)
  }

  async function fetchMappings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await mappingsApi.getAllMappings()
      const allMappings = res.mappings || []

      // 过滤掉系统 Mock（用于存储分组数据的隐藏 stub）
      const filtered = allMappings.filter(
        (m) => (m.uuid || m.id) !== SYSTEM_MOCK_UUID
      )

      if (filtered.length === 0 && allMappings.length === 0) {
        // WireMock 完全为空时，先添加一条默认 stub
        const defaultStub: StubMapping = {
          name: 'wiremock-ui自动生成，请勿删除',
          request: {
            method: 'GET',
            urlPath: '/__wiremock-ui/default'
          },
          response: {
            status: 200,
            jsonBody: { message: 'wiremock-ui auto generated stub' },
            headers: { 'Content-Type': 'application/json' }
          },
          persistent: true
        }
        // 创建默认 stub
        const created = await mappingsApi.createMapping(defaultStub)
        // 再调用更新
        await mappingsApi.updateMapping(created.uuid || created.id!, created)
        // 更新后重新获取列表，并触发延时持久化
        const res2 = await mappingsApi.getAllMappings()
        mappings.value = (res2.mappings || []).filter(
          (m) => (m.uuid || m.id) !== SYSTEM_MOCK_UUID
        )
        console.log('[mappings] 已创建默认 stub，延时 10s 持久化')
        scheduleSave()
      } else {
        mappings.value = filtered
      }
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
    scheduleSave()
    return result
  }

  async function updateMapping(id: string, mapping: StubMapping): Promise<StubMapping> {
    const result = await mappingsApi.updateMapping(id, mapping)
    await fetchMappings()
    scheduleSave()
    return result
  }

  async function deleteMapping(id: string): Promise<void> {
    await mappingsApi.deleteMapping(id)
    await fetchMappings()
    scheduleSave()
  }

  async function resetAll(): Promise<void> {
    await mappingsApi.resetMappings()
    await fetchMappings()
    scheduleSave()
  }

  async function removeByIds(ids: string[]): Promise<void> {
    await mappingsApi.removeMappings({ ids })
    await fetchMappings()
    scheduleSave()
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
    removeByIds,
    scheduleSave
  }
})
