import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GroupInfo, StubMapping } from '@/api/types'
import * as settingsApi from '@/api/settings'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<GroupInfo[]>([])
  const selectedGroupId = ref<string>('')
  const loading = ref(false)

  const selectedGroup = computed(() =>
    groups.value.find((g) => g.id === selectedGroupId.value) ?? null
  )

  /** 获取顶级分组（无父级） */
  const rootGroups = computed(() =>
    groups.value.filter((g) => !g.parentId)
  )

  /** 从服务端加载分组（从系统 Mock 的响应体中读取） */
  async function loadGroups(): Promise<void> {
    loading.value = true
    try {
      const data = await settingsApi.loadGroups()
      groups.value = data || []
    } catch (e) {
      console.warn('加载分组失败:', e)
      groups.value = []
    } finally {
      loading.value = false
    }
  }

  /** 保存分组到服务端（更新系统 Mock） */
  async function persistGroups(): Promise<void> {
    try {
      await settingsApi.saveGroups(groups.value)
    } catch (e) {
      console.warn('保存分组失败:', e)
    }
  }

  /** 根据父级ID获取子分组 */
  function getChildren(parentId: string): GroupInfo[] {
    return groups.value.filter((g) => g.parentId === parentId)
  }

  /** 递归获取所有后代分组ID */
  function getDescendantIds(groupId: string): string[] {
    const result: string[] = [groupId]
    const children = getChildren(groupId)
    for (const child of children) {
      result.push(...getDescendantIds(child.id))
    }
    return result
  }

  /** 从所有 Stub 的 metadata 中重建分组关联（不创建新分组，不自动持久化分组列表） */
  function syncFromStubs(stubs: StubMapping[]): void {
    // 清空所有分组的 stubIds
    for (const g of groups.value) {
      g.stubIds = []
    }

    for (const stub of stubs) {
      const meta = stub.metadata
      const groupId = meta?.groupId as string | undefined
      if (!groupId) continue

      const stubId = stub.uuid || stub.id
      if (!stubId) continue

      const group = groups.value.find((g) => g.id === groupId)
      if (!group) continue  // 分组不存在则跳过，不自动创建

      if (!group.stubIds.includes(stubId)) {
        group.stubIds.push(stubId)
      }
    }
  }

  async function addGroup(name: string, description = '', parentId?: string): Promise<GroupInfo> {
    const group: GroupInfo = {
      id: crypto.randomUUID(),
      name,
      description,
      parentId,
      stubIds: [],
      createdAt: Date.now()
    }
    groups.value.push(group)
    await persistGroups()
    return group
  }

  async function updateGroup(id: string, updates: Partial<GroupInfo>): Promise<void> {
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx >= 0) {
      groups.value[idx] = { ...groups.value[idx], ...updates }
      await persistGroups()
    }
  }

  async function deleteGroup(id: string): Promise<void> {
    const descendantIds = getDescendantIds(id)
    groups.value = groups.value.filter((g) => !descendantIds.includes(g.id))
    if (selectedGroupId.value && descendantIds.includes(selectedGroupId.value)) {
      selectedGroupId.value = ''
    }
    await persistGroups()
  }

  async function addStubToGroup(groupId: string, stubId: string): Promise<void> {
    const group = groups.value.find((g) => g.id === groupId)
    if (group && !group.stubIds.includes(stubId)) {
      group.stubIds.push(stubId)
      // 不持久化分组列表 —— stubIds 由 syncFromStubs 根据 metadata 动态重建
    }
  }

  async function removeStubFromGroup(groupId: string, stubId: string): Promise<void> {
    const group = groups.value.find((g) => g.id === groupId)
    if (group) {
      group.stubIds = group.stubIds.filter((id) => id !== stubId)
    }
  }

  function getGroupByStubId(stubId: string): GroupInfo | undefined {
    return groups.value.find((g) => g.stubIds.includes(stubId))
  }

  function selectGroup(id: string): void {
    selectedGroupId.value = id
  }

  return {
    groups,
    selectedGroupId,
    selectedGroup,
    loading,
    rootGroups,
    getChildren,
    getDescendantIds,
    loadGroups,
    syncFromStubs,
    addGroup,
    updateGroup,
    deleteGroup,
    addStubToGroup,
    removeStubFromGroup,
    getGroupByStubId,
    selectGroup
  }
})
