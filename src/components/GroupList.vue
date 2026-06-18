<script setup lang="ts">
import { ref, computed } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { useGroupsStore } from '@/stores/groups'
import { useMappingsStore } from '@/stores/mappings'
import * as mappingsApi from '@/api/mappings'
import GroupDialog from './GroupDialog.vue'
import type { GroupInfo } from '@/api/types'

const groupsStore = useGroupsStore()
const mappingsStore = useMappingsStore()

const UNGROUPED_ID = '__ungrouped__'

const showDialog = ref(false)
const editingGroupId = ref<string | null>(null)
const pendingParentId = ref<string>('')
const expandedGroups = ref<Set<string>>(new Set())

function toggleExpand(groupId: string) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
  expandedGroups.value = new Set(expandedGroups.value)
}

function isExpanded(groupId: string): boolean {
  return expandedGroups.value.has(groupId)
}

function getChildren(parentId: string): GroupInfo[] {
  return groupsStore.groups.filter(g => g.parentId === parentId)
}

function hasChildren(groupId: string): boolean {
  return getChildren(groupId).length > 0
}

function onGroupClick(id: string) {
  if (id === UNGROUPED_ID) {
    groupsStore.selectGroup(UNGROUPED_ID)
  } else {
    groupsStore.selectGroup(id)
  }
}

function getUngroupedCount(): number {
  const allStubIds = new Set(groupsStore.groups.flatMap(g => g.stubIds))
  return mappingsStore.mappings.filter(s => {
    const sid = s.uuid || s.id || ''
    return sid && !allStubIds.has(sid)
  }).length
}

function getDepth(group: GroupInfo): number {
  let depth = 0
  let current = group
  while (current.parentId) {
    depth++
    const parent = groupsStore.groups.find(g => g.id === current.parentId)
    if (!parent) break
    current = parent
  }
  return depth
}

function handleAdd() {
  editingGroupId.value = null
  pendingParentId.value = ''
  showDialog.value = true
}

function handleEdit(id: string) {
  editingGroupId.value = id
  showDialog.value = true
}

async function handleDelete(id: string) {
  const childCount = getChildren(id).length
  const descendantIds = groupsStore.getDescendantIds(id)
  // 收集该分组及其所有子分组下的 stub ID
  const affectedGroups = groupsStore.groups.filter(g => descendantIds.includes(g.id))
  const allStubIds = affectedGroups.flatMap(g => g.stubIds).filter(Boolean)
  const stubCount = allStubIds.length
  
  const instance = DialogPlugin.confirm({
    body: childCount > 0
      ? `该分组包含 ${childCount} 个子分组，${stubCount > 0 ? `旗下共 ${stubCount} 条 Mock 规则。` : ''}确定删除？删除分组会同时删除分组下所有的 Mock 规则。`
      : stubCount > 0
        ? `该分组下有 ${stubCount} 条 Mock 规则。确定删除？删除分组会同时删除分组下所有的 Mock 规则。`
        : '确定删除该分组？',
    confirmBtn: {
      content: '确定',
      theme: 'danger'
    },
    cancelBtn: '取消',
    onConfirm: async () => {
      instance.destroy()
      // 逐个删除 stub
      for (const stubId of allStubIds) {
        try {
          await mappingsApi.deleteMapping(stubId)
        } catch (e: any) {
          console.warn(`删除 stub ${stubId} 失败:`, e.message)
        }
      }
      // 删除分组
      groupsStore.deleteGroup(id)
      // 刷新 mock 列表
      await mappingsStore.fetchMappings()
      groupsStore.syncFromStubs(mappingsStore.mappings)
      MessagePlugin.success(`分组已删除${stubCount > 0 ? `，已同步删除 ${stubCount} 条 Mock 规则` : ''}`)
    },
    onCancel: () => {
      instance.destroy()
    },
    onClose: () => {
      instance.destroy()
    }
  })
}

async function handleDialogConfirm(data: { name: string; description: string; parentId?: string; prefix?: string }) {
  // 检查 URL 前缀是否已被其他分组使用
  const newPrefix = (data.prefix || '').trim()
  if (newPrefix) {
    const duplicate = groupsStore.groups.find(g =>
      g.id !== editingGroupId.value && g.prefix === newPrefix
    )
    if (duplicate) {
      MessagePlugin.warning(`URL 前缀 "${newPrefix}" 已存在于分组「${duplicate.name}」，不能重复`)
      return
    }
  }

  if (editingGroupId.value) {
    // 编辑：记录原分组信息，再更新
    const oldGroup = groupsStore.groups.find(g => g.id === editingGroupId.value)
    const oldPrefix = oldGroup?.prefix || ''

    await groupsStore.updateGroup(editingGroupId.value, data)

    // 前缀有变化 → 更新该分组下所有 stub 的 URL 前缀
    if (oldPrefix !== newPrefix && oldGroup) {
      const affectedStubIds = oldGroup.stubIds
      let updatedCount = 0
      if (affectedStubIds.length) {
        for (const stubId of affectedStubIds) {
          try {
            const stub = await mappingsApi.getMapping(stubId)
            if (!stub) continue
            const req = stub.request
            if (!req) continue
            let changed = false
            // 更新 URL 字段：用 stub 自己的前缀（metadata.prefix）或旧分组前缀去匹配并替换
            const urlPrefix = (stub.metadata as any)?.prefix || oldPrefix
            for (const key of ['url', 'urlPath', 'urlPathPattern', 'urlPattern'] as const) {
              const val = req[key]
              if (val && urlPrefix && val.startsWith(urlPrefix)) {
                req[key] = newPrefix + val.slice(urlPrefix.length)
                changed = true
              }
            }
            // 更新 metadata.prefix
            const oldMetaPrefix = (stub.metadata as any)?.prefix || ''
            if (oldMetaPrefix !== newPrefix) {
              if (!stub.metadata) stub.metadata = {}
              ;(stub.metadata as any).prefix = newPrefix || undefined
              changed = true
            }
            if (changed) {
              await mappingsApi.updateMapping(stubId, stub)
              updatedCount++
            }
          } catch (e: any) {
            console.warn(`更新 stub ${stubId} 前缀失败:`, e.message)
          }
        }
      }
      // 重新加载 mappings 列表和分组关联
      await mappingsStore.fetchMappings()
      groupsStore.syncFromStubs(mappingsStore.mappings)
      MessagePlugin.success(`分组已更新，已同步更新 ${updatedCount} 条规则的前缀`)
    } else {
      MessagePlugin.success('分组已更新')
    }
  } else {
    const group = await groupsStore.addGroup(data.name, data.description, data.parentId, data.prefix)
    groupsStore.selectGroup(group.id)
    MessagePlugin.success('分组已创建')
  }
  showDialog.value = false
}

function handleAddChild(parentId: string) {
  editingGroupId.value = null
  pendingParentId.value = parentId
  showDialog.value = true
}

// 扁平化分组列表用于渲染
interface FlatGroupItem {
  group: GroupInfo
  depth: number
  hasChild: boolean
  isExpanded: boolean
}

const flatGroups = computed<FlatGroupItem[]>(() => {
  const result: FlatGroupItem[] = []
  
  // 计算未分组的 stub 数量
  const allStubIds = new Set(groupsStore.groups.flatMap(g => g.stubIds))
  const ungroupedCount = mappingsStore.mappings.filter(s => {
    const sid = s.uuid || s.id || ''
    return sid && !allStubIds.has(sid)
  }).length
  
  // 未分组虚拟条目
  result.push({
    group: { id: UNGROUPED_ID, name: '未分组', stubIds: [] } as any,
    depth: 0,
    hasChild: false,
    isExpanded: false
  })
  
  function traverse(parentId: string | undefined, depth: number) {
    const groups = parentId 
      ? groupsStore.groups.filter(g => g.parentId === parentId)
      : groupsStore.rootGroups
    
    for (const group of groups) {
      const hc = hasChildren(group.id)
      result.push({
        group,
        depth,
        hasChild: hc,
        isExpanded: isExpanded(group.id)
      })
      if (hc && isExpanded(group.id)) {
        traverse(group.id, depth + 1)
      }
    }
  }
  
  traverse(undefined, 0)
  return result
})
</script>

<template>
  <div class="group-list">
    <div class="toolbar">
      <span class="toolbar-title">分组</span>
      <t-button size="small" theme="primary" variant="text" @click="handleAdd">
        <template #icon><t-icon name="add" /></template>
        新建
      </t-button>
    </div>

    <div v-if="flatGroups.length === 0" class="empty-hint">
      <t-icon name="folder" size="32px" />
      <p>暂无分组，点击上方按钮创建</p>
    </div>

    <!-- 扁平化分组列表 -->
    <div
      v-for="item in flatGroups"
      :key="item.group.id"
      class="group-item"
      :class="{ active: groupsStore.selectedGroupId === item.group.id }"
      :style="{ paddingLeft: `${12 + item.depth * 20}px` }"
    >
      <!-- 展开/收起按钮 -->
      <t-button
        v-if="item.hasChild"
        size="small"
        variant="text"
        shape="square"
        @click.stop="toggleExpand(item.group.id)"
      >
        <t-icon :name="item.isExpanded ? 'chevron-down' : 'chevron-right'" size="14px" />
      </t-button>
      <div v-else class="expand-placeholder"></div>
      
      <div class="group-item-main" @click="onGroupClick(item.group.id)">
        <t-icon :name="item.group.id === UNGROUPED_ID ? 'layers' : 'folder'" class="group-icon" />
        <div class="group-info">
          <div class="group-name">{{ item.group.name }}</div>
          <div v-if="item.group.prefix" class="group-prefix">{{ item.group.prefix }}</div>
          <div v-if="item.group.description" class="group-desc">{{ item.group.description }}</div>
          <div class="group-meta">
            <span v-if="item.group.id === UNGROUPED_ID">{{ getUngroupedCount() }} 条规则</span>
            <span v-else-if="item.group.stubIds.length">{{ item.group.stubIds.length }} 条规则</span>
          </div>
        </div>
      </div>
      
      <div v-if="item.group.id !== UNGROUPED_ID" class="group-actions" @click.stop>
        <t-button
          size="small"
          variant="text"
          shape="square"
          @click="handleAddChild(item.group.id)"
          title="添加子分组"
        >
          <t-icon name="add-circle" size="14px" />
        </t-button>
        <t-button
          size="small"
          variant="text"
          shape="square"
          @click="handleEdit(item.group.id)"
          title="编辑"
        >
          <t-icon name="edit" size="14px" />
        </t-button>
        <t-button
          size="small"
          variant="text"
          shape="square"
          theme="danger"
          title="删除"
          @click="handleDelete(item.group.id)"
        >
          <t-icon name="delete" size="14px" />
        </t-button>
      </div>
    </div>

    <GroupDialog
      v-model:visible="showDialog"
      :group="editingGroupId ? groupsStore.groups.find(g => g.id === editingGroupId) ?? null : null"
      :default-parent-id="pendingParentId"
      @confirm="handleDialogConfirm"
    />
  </div>
</template>

<style scoped>
.group-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
  gap: 8px;
  padding: 40px 0;
}
.empty-hint p {
  font-size: 13px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--td-border-level-1-color);
  transition: background 0.2s;
  gap: 4px;
}
.group-item:hover {
  background: var(--td-bg-color-container-hover);
}
.group-item.active {
  background: var(--td-brand-color-light);
}
.group-item.active .group-icon {
  color: var(--td-brand-color);
}

.expand-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.group-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.group-icon {
  color: var(--td-text-color-secondary);
  flex-shrink: 0;
  font-size: 16px;
}

.group-info {
  min-width: 0;
  flex: 1;
}

.group-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-desc {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}
.group-prefix {
  font-size: 11px;
  color: var(--td-brand-color);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}
.group-meta {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.group-actions {
  display: none;
  gap: 2px;
  flex-shrink: 0;
}
.group-item:hover .group-actions {
  display: flex;
}
</style>
