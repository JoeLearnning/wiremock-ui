import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as settingsApi from '@/api/settings'
import type { RequestJournalEntry } from '@/api/types'

export const useRequestsStore = defineStore('requests', () => {
  const entries = ref<RequestJournalEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentLimit = ref(100)
  const sinceTime = ref<string>('')

  async function fetchRequests(limit?: number, since?: string): Promise<void> {
    loading.value = true
    try {
      const params: { limit?: number; since?: string } = {}
      
      if (limit !== undefined) {
        currentLimit.value = limit
        params.limit = limit
      } else {
        params.limit = currentLimit.value
      }
      
      if (since !== undefined) {
        sinceTime.value = since
        params.since = since
      } else if (sinceTime.value) {
        params.since = sinceTime.value
      }
      
      const journal = await settingsApi.getRequests(params)
      entries.value = journal.requests || []
      total.value = journal.meta?.total ?? entries.value.length
    } catch (e: any) {
      console.warn('获取请求历史失败:', e.message)
      entries.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function clearAll(): Promise<void> {
    try {
      await settingsApi.resetRequests()
      entries.value = []
      total.value = 0
    } catch (e: any) {
      console.warn('清空请求历史失败:', e.message)
      throw e
    }
  }

  return {
    entries,
    total,
    loading,
    currentLimit,
    sinceTime,
    fetchRequests,
    clearAll
  }
})
