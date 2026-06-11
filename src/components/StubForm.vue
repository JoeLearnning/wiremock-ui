<script setup lang="ts">
import { watch } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import JsonEditor from './JsonEditor.vue'

const FAULTS = [
  { value: 'CONNECTION_RESET_BY_PEER', label: '连接重置', desc: '模拟对端关闭连接（Connection Reset）' },
  { value: 'EMPTY_RESPONSE', label: '空响应', desc: '返回 0 字节的响应体' },
  { value: 'MALFORMED_RESPONSE_CHUNK', label: '畸形响应块', desc: '返回畸形的 chunked 编码数据' },
  { value: 'RANDOM_DATA_THEN_CLOSE', label: '随机数据后断开', desc: '发送随机垃圾数据后关闭连接' },
]
const ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ANY']
const commonHeaders = [
  'Content-Type', 'Accept', 'Authorization', 'User-Agent', 'Referer',
  'Origin', 'Cache-Control', 'Cookie', 'X-Requested-With',
  'Accept-Language', 'Accept-Encoding', 'Connection', 'Host',
  'X-Forwarded-For', 'X-Real-IP', 'If-Modified-Since', 'If-None-Match',
]
const headerValueMap: Record<string, string[]> = {
  'Content-Type': ['application/json', 'application/xml', 'text/plain', 'text/html', 'application/x-www-form-urlencoded', 'multipart/form-data'],
  'Accept': ['application/json', 'text/plain', '*/*', 'text/html', 'application/xml'],
  'Authorization': ['Bearer ', 'Basic '],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'public', 'private'],
  'Accept-Encoding': ['gzip', 'br', 'deflate', 'gzip, deflate, br'],
  'Accept-Language': ['zh-CN', 'en-US', 'zh-CN,zh;q=0.9', 'en-US,en;q=0.9'],
  'Connection': ['keep-alive', 'close'],
  'X-Requested-With': ['XMLHttpRequest'],
}

function getHeaderValueOptions(key: string): string[] {
  return headerValueMap[key] || []
}

const FILTER_TYPES = [
  { value: 'header', label: '请求头' },
  { value: 'query', label: '查询参数' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'body', label: '请求体' },
]
const OPERATORS = [
  { value: 'equalTo', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'matches', label: '正则匹配' },
  { value: 'doesNotMatch', label: '不匹配' },
  { value: 'absent', label: '不存在' },
]
const groupsStore = useGroupsStore()

const form = defineModel<any>('form', { required: true })

// 选择分组时自动填充前缀
watch(() => form.value.selectedGroupId, (groupId) => {
  if (groupId) {
    const g = groupsStore.groups.find(g => g.id === groupId)
    if (g?.prefix) form.value.prefix = g.prefix
  }
})

function getUrlPlaceholder() {
  const map: Record<string, string> = { url: '/api/user/info', urlPath: '/api/user', urlPathPattern: '/api/.*', urlPattern: '.*/api/user/.*' }
  return map[form.value.urlType] || ''
}
function addResponseHeader() { form.value.responseHeaders.push({ key: '', value: '' }) }
function removeResponseHeader(i: number) { form.value.responseHeaders.splice(i, 1) }

// 请求筛选
function addFilter() { form.value.filters.push({ type: 'header', key: '', operator: 'equalTo', value: '', not: false }) }
function removeFilter(i: number) { form.value.filters.splice(i, 1) }
function onFilterTypeChange(f: any) {
  if (f.operator === 'absent') f.value = ''
}
function onOperatorChange(f: any) {
  if (f.operator === 'absent') f.value = ''
}
</script>

<template>
  <t-form-item label="规则名称"><t-input v-model="form.name" placeholder="便于识别的名称（可选）" /></t-form-item>
  <t-form-item label="所属分组">
    <t-select v-model="form.selectedGroupId" clearable placeholder="选择分组（可选）" :style="{ width: '200px' }"><t-option v-for="g in groupsStore.groups" :key="g.id" :value="g.id" :label="g.name" /></t-select>
  </t-form-item>
  <t-form-item label="优先级"><t-input-number v-model="form.priority" :min="1" :max="100" :style="{ width: '120px' }" /><span class="text-sm text-muted" style="margin-left:8px">越小越优先</span></t-form-item>
  <t-divider>请求匹配</t-divider>
  <t-form-item label="请求方法"><t-select v-model="form.method" :style="{ width: '140px' }"><t-option v-for="m in ALL_METHODS" :key="m" :value="m" :label="m" /></t-select></t-form-item>
  <t-form-item label="URL 类型"><t-radio-group v-model="form.urlType" size="small"><t-radio value="url">精确匹配</t-radio><t-radio value="urlPath">路径匹配</t-radio><t-radio value="urlPathPattern">路径正则</t-radio><t-radio value="urlPattern">全 URL 正则</t-radio></t-radio-group></t-form-item>
  <t-form-item label="URL 前缀">
    <div class="prefix-row">
      <t-input v-model="form.prefix" placeholder="/api/v1" size="small" :style="{ width: '140px', fontFamily: 'monospace' }" />
      <span class="text-sm text-muted">选中分组后自动填充</span>
    </div>
  </t-form-item>
  <t-form-item label="URL" required>
    <div class="url-with-prefix">
      <span v-if="form.prefix" class="url-prefix-badge">{{ form.prefix }}</span>
      <t-input v-model="form.url" :placeholder="getUrlPlaceholder()" />
    </div>
  </t-form-item>

  <!-- 请求筛选条件 -->
  <t-form-item label="匹配条件">
    <div class="w-full">
      <div v-for="(f, i) in form.filters" :key="i" class="filter-row">
        <t-select v-model="f.type" size="small" :style="{ width: '90px', flexShrink: 0 }" @change="onFilterTypeChange(f)">
          <t-option v-for="ft in FILTER_TYPES" :key="ft.value" :value="ft.value" :label="ft.label" />
        </t-select>
        <t-checkbox v-model="f.not" size="small" class="filter-not">NOT</t-checkbox>
        <t-select v-model="f.key" filterable allow-create creatable placeholder="key" size="small" :style="{ width: '130px', flexShrink: 0 }">
          <t-option v-for="hk in commonHeaders" :key="hk" :value="hk" :label="hk" />
        </t-select>
        <t-select v-model="f.operator" size="small" :style="{ width: '100px', flexShrink: 0 }" @change="onOperatorChange(f)">
          <t-option v-for="op in OPERATORS" :key="op.value" :value="op.value" :label="op.label" />
        </t-select>
        <t-input v-if="f.operator !== 'absent'" v-model="f.value" placeholder="value" size="small" :style="{ flex: 1 }" />
        <t-button size="small" theme="danger" variant="text" @click="removeFilter(i)"><t-icon name="delete" /></t-button>
      </div>
      <t-button size="small" variant="dashed" @click="addFilter"><template #icon><t-icon name="add" /></template>添加匹配条件</t-button>
    </div>
  </t-form-item>

  <t-divider>响应配置</t-divider>
  <div class="resp-mode-tabs">
    <span class="tab-item" :class="{ active: form.respMode === 'direct' }" @click="form.respMode = 'direct'">Direct</span>
    <span class="tab-item" :class="{ active: form.respMode === 'fault' }" @click="form.respMode = 'fault'">Fault</span>
    <span class="tab-item" :class="{ active: form.respMode === 'proxy' }" @click="form.respMode = 'proxy'">Proxy</span>
  </div>
  <template v-if="form.respMode === 'direct'">
    <t-form-item label="状态码"><t-input-number v-model="form.status" :min="100" :max="599" :style="{ width: '120px' }" /></t-form-item>
    <t-form-item label="Content-Type"><t-select v-model="form.contentType" :style="{ width: '200px' }"><t-option value="application/json" label="application/json" /><t-option value="text/xml" label="text/xml" /><t-option value="application/xml" label="application/xml" /><t-option value="text/html" label="text/html; charset=utf-8" /><t-option value="text/plain" label="text/plain; charset=utf-8" /></t-select></t-form-item>
    <t-form-item label="响应体"><JsonEditor v-model="form.responseBody" /></t-form-item>
    <t-form-item label="响应头">
      <div class="w-full">
        <div v-for="(h, i) in form.responseHeaders" :key="i" class="flex-center gap-8 mb-8">
          <t-input v-model="h.key" placeholder="Key" size="small" :style="{ flex: '4 1 100px' }" />
          <t-input v-model="h.value" placeholder="Value" size="small" :style="{ flex: '6 1 150px' }" />
          <t-button size="small" theme="danger" @click="removeResponseHeader(i)"><t-icon name="delete" /></t-button>
        </div>
        <t-button size="small" variant="dashed" @click="addResponseHeader"><template #icon><t-icon name="add" /></template>添加响应头</t-button>
      </div>
    </t-form-item>
  </template>
  <div v-if="form.respMode === 'fault'" class="fault-list">
    <div v-for="f in FAULTS" :key="f.value" class="fault-item" :class="{ selected: form.faultType === f.value }" @click="form.faultType = f.value">
      <div class="fault-radio"><span class="radio-dot" v-if="form.faultType === f.value" /></div><div class="fault-body"><div class="fault-label">{{ f.label }}</div><div class="fault-desc">{{ f.desc }}</div></div>
    </div>
  </div>
  <template v-if="form.respMode === 'proxy'">
    <t-form-item label="代理目标" required><t-input v-model="form.proxyBaseUrl" placeholder="http://real-backend:9090" /></t-form-item>
    <t-form-item label="过滤前缀"><t-input v-model="form.stripPrefix" placeholder="转发时去掉此前缀，例如：/api/v1" /></t-form-item>
  </template>
  <t-divider>高级配置</t-divider>
  <t-form-item label="响应延时(ms)"><t-input-number v-model="form.fixedDelay" :min="0" :max="300000" :style="{ width: '140px' }" /><span class="text-sm text-muted" style="margin-left:8px">0 = 无延迟</span></t-form-item>
</template>

<style scoped>
.resp-mode-tabs { display: flex; border-bottom: 1px solid var(--td-component-stroke); margin: 8px 0 16px; }
.tab-item { padding: 8px 16px; font-size: 14px; color: var(--td-text-color-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab-item:hover { color: var(--td-text-color-primary); }
.tab-item.active { color: var(--td-brand-color); border-bottom-color: var(--td-brand-color); font-weight: 500; }
.fault-list { display: flex; flex-direction: column; }
.fault-item { display: flex; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--td-component-stroke); border-bottom: none; cursor: pointer; gap: 12px; }
.fault-item:first-child { border-radius: 6px 6px 0 0; }
.fault-item:last-child { border-bottom: 1px solid var(--td-component-stroke); border-radius: 0 0 6px 6px; }
.fault-item:hover { background: var(--td-bg-color-container-hover); }
.fault-item.selected { background: var(--td-brand-color-light); border-color: var(--td-brand-color); }
.fault-item.selected + .fault-item { border-top-color: var(--td-brand-color); }
.fault-radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--td-component-stroke); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.fault-item.selected .fault-radio { border-color: var(--td-brand-color); }
.radio-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--td-brand-color); }
.fault-body { flex: 1; }
.fault-label { font-size: 14px; font-weight: 500; }
.fault-desc { font-size: 12px; color: var(--td-text-color-placeholder); margin-top: 2px; }

.filter-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.filter-not { flex-shrink: 0; font-size: 12px; }

.prefix-row { display: flex; align-items: center; gap: 8px; }
.url-with-prefix { display: flex; align-items: center; gap: 0; width: 100%; }
.url-with-prefix :deep(.t-input) { flex: 1; }
.url-prefix-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 32px;
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-family: monospace;
  font-size: 13px;
  border: 1px solid var(--td-component-stroke);
  border-right: none;
  border-radius: 6px 0 0 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
