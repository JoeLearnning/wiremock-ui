<script setup lang="ts">
import { ref, computed } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { useGroupsStore } from '@/stores/groups'
import GroupDialog from './GroupDialog.vue'
import type { GroupInfo } from '@/api/types'

const groupsStore = useGroupsStore()

const showDialog = ref(false)
const editingGroupId = ref<string | null>(null)
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
  showDialog.value = true
}

function handleEdit(id: string) {
  editingGroupId.value = id
  showDialog.value = true
}

async function handleDelete(id: string) {
  const childCount = getChildren(id).length
  
  const instance = DialogPlugin.confirm({
    body: childCount > 0 
      ? `确定删除该分组及其所有子分组？分组下的 Mock 规则不会被删除。`
      : '确定删除该分组？分组下的 Mock 规则不会被删除。',
    confirmBtn: {
      content: '确定',
      theme: 'danger'
    },
    cancelBtn: '取消',
    onConfirm: () => {
      instance.destroy()
      groupsStore.deleteGroup(id)
      MessagePlugin.success('分组已删除')
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
  if (editingGroupId.value) {
    await groupsStore.updateGroup(editingGroupId.value, data)
    MessagePlugin.success('分组已更新')
  } else {
    const group = await groupsStore.addGroup(data.name, data.description, data.parentId, data.prefix)
    groupsStore.selectGroup(group.id)
    MessagePlugin.success('分组已创建')
  }
  showDialog.value = false
}

function handleAddChild(parentId: string) {
  editingGroupId.value = null
  showDialog.value = true
  // 下次打开对话框时自动选择父分组
  // 需要通过监听 showDialog 来设置默认值
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
      
      <div class="group-item-main" @click="groupsStore.selectGroup(item.group.id)">
        <t-icon name="folder" class="group-icon" />
        <div class="group-info">
          <div class="group-name">{{ item.group.name }}</div>
          <div v-if="item.group.prefix" class="group-prefix">{{ item.group.prefix }}</div>
          <div v-if="item.group.description" class="group-desc">{{ item.group.description }}</div>
          <div class="group-meta">
            <span v-if="item.group.stubIds.length">{{ item.group.stubIds.length }} 条规则</span>
          </div>
        </div>
      </div>
      
      <div class="group-actions" @click.stop>
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
