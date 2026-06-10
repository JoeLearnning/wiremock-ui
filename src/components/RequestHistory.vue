<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRequestsStore } from '@/stores/requests'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const jsonTheme = ref<'light' | 'dark'>('light')
const jsonDeep = ref(2)
let observer: MutationObserver | null = null

const store = useRequestsStore()
const selectedEntry = ref<any>(null)
const polling = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

// 查询条件
const sinceTime = ref<string>('')
const limitCount = ref<number>(100)

const limitOptions = [
  { value: 20, label: '20' },
  { value: 40, label: '40' },
  { value: 60, label: '60' },
  { value: 80, label: '80' },
  { value: 100, label: '100' }
]

onMounted(async () => {
  jsonTheme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  observer = new MutationObserver(() => {
    jsonTheme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  await fetchData()
})

onUnmounted(() => {
  stopPolling()
  observer?.disconnect()
})

async function fetchData() {
  await store.fetchRequests(limitCount.value, sinceTime.value || undefined)
}

function startPolling() {
  polling.value = true
  timer = setInterval(() => store.fetchRequests(limitCount.value, sinceTime.value || undefined), 5000)
}

function stopPolling() {
  polling.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function togglePolling() {
  if (polling.value) stopPolling()
  else startPolling()
}

async function handleRefresh() {
  await fetchData()
}

async function handleClear() {
  await new Promise<void>((resolve) => {
    DialogPlugin.confirm({
      body: '确定清空所有请求记录？此操作不可恢复！',
      confirmBtn: { content: '确定', theme: 'danger' },
      cancelBtn: '取消',
      onConfirm: async () => {
        await store.clearAll()
        MessagePlugin.success('请求记录已清空')
        resolve()
      },
      onCancel: () => resolve(),
      onClose: () => resolve()
    })
  })
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString()
}

function getMethodTheme(method?: string): string {
  const map: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'default',
    HEAD: 'default',
    OPTIONS: 'default'
  }
  return map[method?.toUpperCase() || ''] || 'default'
}

function openDetail(entry: any) {
  selectedEntry.value = entry
}




function closeDetail() {
  selectedEntry.value = null
}

const detailKey = ref(0)
function expandAll() { jsonDeep.value = 99; detailKey.value++ }
function collapseAll() { jsonDeep.value = 2; detailKey.value++ }

function copyDetail() {
  if (!selectedEntry.value) return
  navigator.clipboard.writeText(JSON.stringify(selectedEntry.value, null, 2))
  MessagePlugin.success('已复制到剪贴板')
}

function handleLimitChange(value: number) {
  limitCount.value = value
  fetchData()
}

function handleTimeChange(value: string) {
  // 转换为 ISO 8601 格式：2026-06-08T16:00:00.000Z
  if (value) {
    const date = new Date(value)
    sinceTime.value = date.toISOString()
  } else {
    sinceTime.value = ''
  }
  fetchData()
}

function clearTimeFilter() {
  sinceTime.value = ''
  fetchData()
}
</script>

<template>
  <div class="request-history">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <t-tag theme="primary" variant="light" size="small">
          共 {{ store.total }} 条
        </t-tag>
        <div class="query-filters">
          <t-date-picker
            v-model="sinceTime"
            placeholder="起始时间"
            clearable
            allow-input
            format="YYYY-MM-DD HH:mm:ss"
            enable-time-picker
            @change="handleTimeChange"
          />
          <t-select
            v-model="limitCount"
            :options="limitOptions"
            placeholder="查询条数"
            @change="handleLimitChange"
          />
        </div>
        <t-button size="small" :theme="polling ? 'warning' : 'default'" @click="togglePolling">
          <template #icon><t-icon :name="polling ? 'stop' : 'play'" /></template>
          {{ polling ? '停止刷新' : '自动刷新' }}
        </t-button>
        <t-button size="small" @click="handleRefresh">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
        <t-button size="small" theme="danger" @click="handleClear">
          <template #icon><t-icon name="delete" /></template>
          清空
        </t-button>
      </div>
    </div>

    <!-- 主内容：左列表 + 右详情 -->
    <div class="main-content">
      <div class="list-panel">
        <div v-if="store.loading && store.entries.length === 0" class="loading-hint">
          <t-loading text="加载请求记录..." />
        </div>
        <div v-else-if="store.entries.length === 0" class="empty-hint">
          <t-icon name="file" size="32px" />
          <p>暂无请求记录</p>
          <p class="text-sm text-muted">发送请求后自动记录在这里</p>
        </div>
        <template v-else>
          <div class="req-table-header">
            <span class="col-time">时间</span>
            <span class="col-method">方法</span>
            <span class="col-url">URL</span>
            <span class="col-status">状态</span>
            <span class="col-matched">匹配</span>
          </div>
          <div
            v-for="entry in store.entries"
            :key="entry.id"
            class="req-row"
            :class="{ unmatched: !entry.wasMatched, selected: selectedEntry?.id === entry.id }"
            @click="openDetail(entry)"
          >
            <span class="col-time text-sm">{{ formatTime(entry.request.loggedDate) }}</span>
            <span class="col-method">
              <t-tag :theme="getMethodTheme(entry.request.method)" variant="light" size="small">
                {{ entry.request.method }}
              </t-tag>
            </span>
            <span class="col-url" :title="entry.request.url">{{ entry.request.url }}</span>
            <span class="col-status">
              <t-tag
                :theme="(entry.responseDefinition?.status ?? 200) >= 400 ? 'danger' : 'success'"
                variant="outline" size="small"
              >
                {{ entry.responseDefinition?.status ?? '-' }}
              </t-tag>
            </span>
            <span class="col-matched">
              <t-tag v-if="entry.wasMatched" theme="success" variant="light" size="small">已匹配</t-tag>
              <t-tag v-else theme="danger" variant="light" size="small">未匹配</t-tag>
            </span>
          </div>
        </template>
      </div>

      <!-- 右侧详情 -->
      <div class="detail-panel">
        <div v-if="!selectedEntry" class="empty-detail">
          <div class="ph-illustration">
            <t-icon name="browse" size="24px" />
            <t-icon name="arrow-right" size="14px" class="ph-arrow" />
            <t-icon name="file-code" size="24px" />
          </div>
          <p class="ph-title">查看请求详情</p>
          <span class="ph-desc">点击左侧请求记录，查看完整的入参和响应数据</span>
        </div>
        <template v-else>
          <div class="detail-header">
            <span class="detail-title">{{ selectedEntry.request.method }} {{ selectedEntry.request.url }}</span>
            <div class="detail-actions">
              <t-tooltip content="全部展开"><t-button size="small" variant="text" shape="square" class="act-btn" @click="expandAll"><t-icon name="chevron-down-double" /></t-button></t-tooltip>
              <t-tooltip content="全部折叠"><t-button size="small" variant="text" shape="square" class="act-btn" @click="collapseAll"><t-icon name="chevron-up-double" /></t-button></t-tooltip>
              <t-tooltip content="复制"><t-button size="small" variant="text" shape="square" class="act-btn" @click="copyDetail"><t-icon name="file-copy" /></t-button></t-tooltip>
              <t-tooltip content="关闭"><t-button size="small" variant="text" shape="square" class="act-btn close-btn" @click="closeDetail"><t-icon name="close" /></t-button></t-tooltip>
            </div>
          </div>
          <div class="raw-json">
            <VueJsonPretty
              :key="detailKey"
              :data="selectedEntry"
              :deep="jsonDeep"
              :theme="jsonTheme"
              showIcon
              showLength
              showLine
              collapsedOnClickBrackets
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.request-history {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.query-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.query-filters :deep(.t-date-picker) {
  width: 200px;
}
.query-filters :deep(.t-select) {
  width: 120px;
}
/* 主内容区域：左列表 + 右详情 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧列表面板 */
.list-panel {
  width: 30%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  border-right: 1px solid var(--td-component-stroke);
  background: #fff;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.list-panel::-webkit-scrollbar { display: none; }
.req-table-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}
.col-time { width: 155px; flex-shrink: 0; }
.col-method { width: 70px; flex-shrink: 0; }
.col-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-status { width: 60px; flex-shrink: 0; }
.col-matched { width: 70px; flex-shrink: 0; }
.req-row {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  cursor: pointer;
  transition: background 0.15s;
}
.req-row:hover {
  background: var(--td-bg-color-container-hover);
}
.req-row.unmatched {
  background: rgba(255, 77, 79, 0.03);
}
.req-row.selected {
  background: var(--td-brand-color-light);
}
.loading-hint,
.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
  gap: 8px;
}

/* 右侧详情面板 */
.detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
}
.ph-illustration {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--td-bg-color-page);
  padding: 20px 28px;
  border-radius: 20px;
  color: var(--td-brand-color);
}
.ph-arrow { opacity: 0.5; }

.empty-detail .ph-title { font-size: 15px; font-weight: 600; color: var(--td-text-color-primary); margin: 0; }
.empty-detail .ph-desc { font-size: 13px; color: var(--td-text-color-placeholder); margin: 0; text-align: center; line-height: 1.6; }
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}
.detail-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.act-btn {
  color: var(--td-text-color-secondary) !important;
}
.act-btn:hover {
  color: var(--td-brand-color) !important;
}
.close-btn:hover {
  color: var(--td-error-color) !important;
}

.raw-json {
  padding: 12px 16px;
  background: #f6f8fa;
  flex: 1;
  overflow: auto;
  font-size: 12px;
}
</style>
