<script setup lang="ts">
import { watch, ref, computed } from 'vue'
import type { StubMapping } from '@/api/types'
import { useGroupsStore } from '@/stores/groups'
import StubForm from './StubForm.vue'
import client from '@/api/client'

const groupsStore = useGroupsStore()

interface Props { visible?: boolean; stub: StubMapping | null; inline?: boolean }
const props = withDefaults(defineProps<Props>(), { visible: false, inline: false })
const emit = defineEmits<{ 'update:visible': [v: boolean]; save: [stub: StubMapping]; cancel: []; delete: []; testRequest: [config: any] }>()

const visible = computed({ get: () => props.visible, set: (v) => { if (!props.inline) emit('update:visible', v) } })
const isNew = computed(() => !(props.stub?.uuid || props.stub?.id))

const form = ref({
  name: '', method: 'GET', urlType: 'url' as string, url: '',
  respMode: 'direct' as string, status: 200, contentType: 'application/json',
  responseBody: '{\n  "message": "success",\n  "code": 0,\n  "data": {}\n}',
  faultType: 'CONNECTION_RESET_BY_PEER', proxyBaseUrl: '',
  fixedDelay: 0, priority: 5,
  filters: [] as { type: string; key: string; operator: string; value: string; not: boolean }[],
  responseHeaders: [] as { key: string; value: string }[],
  selectedGroupId: '',
})

watch(() => props.stub, (s) => {
  if (s && (s.uuid || s.id)) loadStub(s)
  else resetForm()
}, { immediate: true })

function loadStub(s: StubMapping) {
  const f: any = form.value
  f.name = s.name || ''; f.method = s.request?.method || 'GET'; f.fixedDelay = s.response?.fixedDelayMilliseconds ?? 0; f.priority = s.priority ?? 5

  // Parse URL
  if (s.request?.url) { f.urlType = 'url'; f.url = s.request.url }
  else if (s.request?.urlPath) { f.urlType = 'urlPath'; f.url = s.request.urlPath }
  else if (s.request?.urlPathPattern) { f.urlType = 'urlPathPattern'; f.url = s.request.urlPathPattern }
  else if (s.request?.urlPattern) { f.urlType = 'urlPattern'; f.url = s.request.urlPattern }
  else { f.urlType = 'url'; f.url = '/' }

  // Parse filters from WireMock patterns
  const filters: any[] = []
  const parsePatterns = (patterns: Record<string, any> | undefined, type: string) => {
    if (!patterns) return
    for (const [key, v] of Object.entries(patterns)) {
      if (typeof v === 'string') { filters.push({ type, key, operator: 'equalTo', value: v, not: false }) }
      else if (v && typeof v === 'object') {
        for (const op of ['equalTo','contains','matches','doesNotMatch','absent']) {
          if (op in v) {
            filters.push({ type, key, operator: op, value: (op === 'absent' ? '' : String(v[op] || '')), not: false })
            break
          }
        }
      }
    }
  }
  parsePatterns(s.request?.headers, 'header')
  parsePatterns(s.request?.queryParameters, 'query')
  parsePatterns((s.request as any)?.cookies, 'cookie')
  // bodyPatterns
  if (s.request?.bodyPatterns) {
    for (const bp of s.request.bodyPatterns) {
      for (const op of ['equalToJson','matchesJsonPath','contains','matches']) {
        if ((bp as any)[op] !== undefined) {
          const val = (bp as any)[op]
          filters.push({ type: 'body', key: op === 'matchesJsonPath' ? 'jsonPath' : '', operator: op, value: typeof val === 'string' ? val : JSON.stringify(val), not: false })
          break
        }
      }
    }
  }
  f.filters = filters

  f.selectedGroupId = (s.metadata?.groupId as string) || ''
  f.responseHeaders = s.response?.headers ? Object.entries(s.response.headers).filter(([k]) => k.toLowerCase() !== 'content-type').map(([k, v]) => ({ key: k, value: v })) : []
  if (s.response?.proxyBaseUrl) { f.respMode = 'proxy'; f.proxyBaseUrl = s.response.proxyBaseUrl }
  else if (s.response?.fault) { f.respMode = 'fault'; f.faultType = s.response.fault }
  else {
    f.respMode = 'direct'; f.status = s.response?.status ?? 200
    const ct = (s.response?.headers?.['Content-Type'] || s.response?.headers?.['content-type'] || '').split(';')[0]
    if (['text/html','text/xml','application/xml','text/plain'].includes(ct)) f.contentType = ct
    else f.contentType = 'application/json'
    f.responseBody = s.response?.jsonBody ? JSON.stringify(s.response.jsonBody, null, 2) : (s.response?.body || '')
  }
}

function resetForm() {
  form.value = {
    name: '', method: 'GET', urlType: 'url', url: '/',
    respMode: 'direct', status: 200, contentType: 'application/json',
    responseBody: '{\n  "message": "success",\n  "code": 0,\n  "data": {}\n}',
    faultType: 'CONNECTION_RESET_BY_PEER', proxyBaseUrl: '',
    fixedDelay: 0, priority: 5, filters: [], responseHeaders: [], selectedGroupId: '',
  }
}

function buildStub(): StubMapping {
  const request: any = { method: form.value.method, [form.value.urlType]: form.value.url }

  // Convert filters to WireMock patterns
  const validFilters = form.value.filters.filter((f: any) => f.key.trim() || f.type === 'body')
  const bodyPatterns: any[] = []
  for (const f of validFilters) {
    const pattern: any = {}
    if (f.operator === 'absent') pattern[f.operator] = true
    else pattern[f.operator] = f.value

    if (f.type === 'header') {
      if (!request.headers) request.headers = {}
      request.headers[f.key.trim()] = pattern
    } else if (f.type === 'query') {
      if (!request.queryParameters) request.queryParameters = {}
      request.queryParameters[f.key.trim()] = pattern
    } else if (f.type === 'cookie') {
      if (!request.cookies) request.cookies = {}
      request.cookies[f.key.trim()] = pattern
    } else if (f.type === 'body') {
      bodyPatterns.push(pattern)
    }
  }
  if (bodyPatterns.length) request.bodyPatterns = bodyPatterns

  const response: any = {}
  if (form.value.respMode === 'proxy') response.proxyBaseUrl = form.value.proxyBaseUrl
  else if (form.value.respMode === 'fault') response.fault = form.value.faultType
  else {
    response.status = form.value.status; response.headers = { 'Content-Type': form.value.contentType }
    try { response.jsonBody = JSON.parse(form.value.responseBody) } catch { response.body = form.value.responseBody }
  }
  if (form.value.responseHeaders.filter((h: any) => h.key.trim()).length) {
    if (!response.headers) response.headers = {}
    form.value.responseHeaders.filter((h: any) => h.key.trim()).forEach((h: any) => { response.headers[h.key.trim()] = h.value })
  }
  if (form.value.fixedDelay > 0) response.fixedDelayMilliseconds = form.value.fixedDelay
  const metadata: Record<string, unknown> = {}
  if (form.value.selectedGroupId) {
    const g = groupsStore.groups.find(g => g.id === form.value.selectedGroupId)
    if (g) { metadata.groupId = g.id; metadata.groupName = g.name }
  }
  return { ...(props.stub?.id ? { id: props.stub.id } : {}), ...(props.stub?.uuid ? { uuid: props.stub.uuid } : {}), name: form.value.name || undefined, priority: form.value.priority, request, response, metadata }
}

function handleSave() { if (form.value.url.trim()) emit('save', buildStub()) }

async function handleTestRequest() {
  const stubId = (props.stub?.uuid || props.stub?.id)
  if (!stubId) return
  try {
    // 从 API 获取最新数据（包含 metadata）
    const { data: latest } = await client.get(`/mappings/${stubId}`)
    const saved = latest?.metadata?.testRequest as any
    if (saved) {
      emit('testRequest', { ...saved, stubId, stubName: form.value.name || '' })
      return
    }
  } catch { /* ignore */ }
  // 从当前请求定义构建（兜底）
  const hdrs: { key: string; value: string }[] = []
  form.value.filters.filter((f: any) => f.type === 'header' && f.key.trim()).forEach((f: any) => {
    hdrs.push({ key: f.key, value: f.value })
  })
  let url = form.value.url
  const queryParams = form.value.filters.filter((f: any) => f.type === 'query' && f.key.trim())
  if (queryParams.length) {
    const qs = queryParams.map((f: any) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  emit('testRequest', {
    method: form.value.method, url,
    headers: hdrs,
    body: form.value.method !== 'GET' && form.value.method !== 'HEAD' ? form.value.responseBody : '',
    stubId, stubName: form.value.name || '',
  })
}
</script>

<template>
  <t-drawer v-if="!inline" v-model:visible="visible" :header="isNew ? '新建 Mock 规则' : '编辑 Mock 规则'" size="700px" :footer="true" :confirm-btn="{ content: '保存', theme: 'primary' }" :cancel-btn="isNew ? '取消' : '删除'" @confirm="handleSave" @cancel="isNew ? emit('cancel') : emit('delete')">
    <t-form label-width="96px" class="stub-form"><StubForm v-model:form="form" /></t-form>
  </t-drawer>

  <div v-else class="inline-editor">
    <div class="inline-header"><span class="inline-title">{{ isNew ? '新建 Mock 规则' : '编辑 Mock 规则' }}</span><t-button size="small" variant="text" @click="emit('cancel')"><t-icon name="close" /></t-button></div>
    <t-form label-width="96px" class="stub-form"><StubForm v-model:form="form" /></t-form>
    <div class="inline-footer">
      <t-button theme="primary" @click="handleSave">保存</t-button>
      <t-button @click="emit('cancel')">取消</t-button>
      <t-button theme="default" @click="handleTestRequest">
        <template #icon><t-icon name="play-circle" /></template>测试
      </t-button>
      <div class="spacer" />
      <t-popconfirm v-if="!isNew" content="确定删除该 Mock 规则？" @confirm="emit('delete')">
        <t-button theme="danger">删除</t-button>
      </t-popconfirm>
    </div>
  </div>
</template>

<style scoped>
.stub-form { padding: 8px 0; }
.inline-editor { height: 100%; display: flex; flex-direction: column; }
.inline-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--td-component-stroke); flex-shrink: 0; }
.inline-title { font-size: 14px; font-weight: 600; }
.inline-editor .stub-form { flex: 1; overflow-y: auto; padding: 12px 16px; }
.inline-footer { padding: 12px 16px; border-top: 1px solid var(--td-component-stroke); display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.inline-footer .spacer { flex: 1; }
</style>
