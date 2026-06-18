<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { useMappingsStore } from '@/stores/mappings'
import type { StubMapping } from '@/api/types'

const props = defineProps<{ stubs: StubMapping[] }>()
const emit = defineEmits<{ edit: [stub: StubMapping]; create: [] }>()

const groupsStore = useGroupsStore()
const mappingsStore = useMappingsStore()
const UNGROUPED_ID = '__ungrouped__'

const searchKeyword = ref('')

const filteredStubs = computed(() => {
  let list = props.stubs
  if (groupsStore.selectedGroupId === UNGROUPED_ID) {
    const allStubIds = new Set(groupsStore.groups.flatMap(g => g.stubIds))
    list = list.filter(s => {
      const sid = s.uuid || s.id || ''
      return sid && !allStubIds.has(sid)
    })
  } else if (groupsStore.selectedGroupId) {
    const group = groupsStore.selectedGroup
    if (group) list = list.filter(s => group.stubIds.includes(s.uuid || s.id || ''))
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(s =>
      s.name?.toLowerCase().includes(kw) ||
      s.request?.url?.toLowerCase().includes(kw) ||
      s.request?.urlPath?.toLowerCase().includes(kw) ||
      s.request?.urlPathPattern?.toLowerCase().includes(kw) ||
      s.request?.urlPattern?.toLowerCase().includes(kw)
    )
  }
  return list
})

function getMethodTheme(m?: string): string {
  const map: Record<string, string> = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger', PATCH: 'default', ANY: 'default' }
  return map[m?.toUpperCase() || ''] || 'default'
}

function getUrl(s: StubMapping): string {
  return s.request.url || s.request.urlPath || s.request.urlPathPattern || s.request.urlPattern || '/'
}

function getStubId(s: StubMapping): string { return s.uuid || s.id || '' }

function getGroupName(s: StubMapping): string {
  const g = groupsStore.getGroupByStubId(getStubId(s))
  return g?.name || '未分组'
}
</script>

<template>
  <div class="stub-list">
    <div class="stub-list-header flex-between">
      <div class="flex-center gap-12">
        <t-input v-model="searchKeyword" placeholder="搜索名称或 URL..." clearable :style="{ width: '240px' }">
          <template #suffix-icon><t-icon name="search" /></template>
        </t-input>
        <t-tag v-if="groupsStore.selectedGroup" theme="primary" variant="light" closable @close="groupsStore.selectGroup('')">
          {{ groupsStore.selectedGroup.name }}
        </t-tag>
        <t-tag v-else-if="groupsStore.selectedGroupId === UNGROUPED_ID" theme="primary" variant="light" closable @close="groupsStore.selectGroup('')">
          未分组
        </t-tag>
      </div>
      <div class="flex-center gap-8">
        <t-button size="small" :loading="mappingsStore.loading" @click="mappingsStore.fetchMappings()" title="刷新">
          <template #icon><t-icon name="refresh" /></template>
        </t-button>
        <t-button theme="primary" size="small" @click="emit('create')">
          <template #icon><t-icon name="add" /></template>
          新建 Mock
        </t-button>
      </div>
    </div>

    <!-- 表头 -->
    <div class="stub-table-header">
      <span class="col-method">方法</span>
      <span class="col-name">规则名 / URL</span>
      <span class="col-status">状态</span>
      <span class="col-group">分组</span>
      <span class="col-priority">优先级</span>
    </div>

    <!-- 列表 -->
    <div v-if="mappingsStore.loading" class="loading-hint"><t-loading text="加载中..." /></div>
    <div v-else-if="filteredStubs.length === 0" class="empty-hint">
      <t-icon name="file" size="32px" />
      <p>暂无 Mock 规则</p>
      <t-button size="small" theme="primary" variant="text" @click="emit('create')">新建第一条规则</t-button>
    </div>
    <div v-for="stub in filteredStubs" :key="stub.id || stub.uuid" class="stub-row" @click="emit('edit', stub)">
      <span class="col-method">
        <t-tag :theme="getMethodTheme(stub.request.method)" variant="light" size="small">
          {{ stub.request.method || 'ANY' }}
        </t-tag>
      </span>
      <span class="col-name">
        <div class="stub-name">{{ stub.name || '-' }}</div>
        <div class="stub-url">{{ getUrl(stub) }}</div>
      </span>
      <span class="col-status">
        <t-tag v-if="stub.response.fault" theme="danger" variant="outline" size="small">FAULT</t-tag>
        <t-tag v-else-if="stub.response.proxyBaseUrl" theme="warning" variant="outline" size="small">PROXY</t-tag>
        <t-tag v-else :theme="(stub.response.status ?? 200) >= 400 ? 'danger' : 'success'" variant="outline" size="small">
          {{ stub.response.status ?? 200 }}
        </t-tag>
      </span>
      <span class="col-group text-sm text-muted">{{ getGroupName(stub) }}</span>
      <span class="col-priority text-sm text-muted">{{ stub.priority ?? 5 }}</span>
    </div>
  </div>
</template>

<style scoped>
.stub-list { height: 100%; display: flex; flex-direction: column; }
.stub-list-header { padding: 12px 16px; border-bottom: 1px solid var(--td-component-stroke); flex-shrink: 0; }
.stub-table-header { display: flex; align-items: center; padding: 8px 16px; font-size: 12px; color: var(--td-text-color-placeholder); border-bottom: 1px solid var(--td-component-stroke); flex-shrink: 0; }
.col-method { width: 70px; flex-shrink: 0; }
.col-name { flex: 1; min-width: 0; padding-right: 8px; }
.col-status { width: 72px; flex-shrink: 0; text-align: center; }
.col-group { width: 72px; flex-shrink: 0; text-align: center; }
.col-priority { width: 56px; flex-shrink: 0; text-align: center; }
.loading-hint, .empty-hint { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--td-text-color-placeholder); gap: 8px; }
.stub-row { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--td-border-level-1-color); cursor: pointer; transition: background 0.15s; }
.stub-row:hover { background: var(--td-bg-color-container-hover); }
.stub-name { font-size: 13px; font-weight: 500; color: var(--td-text-color-primary); line-height: 1.4; }
.stub-url { font-size: 12px; color: var(--td-text-color-placeholder); line-height: 1.4; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
