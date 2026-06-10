<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { MessagePlugin } from 'tdesign-vue-next'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import client from '@/api/client'

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

const PROXY_BASE = '/test-mock'
const props = defineProps<{ visible: boolean; presetRequest?: any }>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()
const visible = computed({ get: () => props.visible, set: (v: boolean) => emit('update:visible', v) })

onUnmounted(() => { document.body.style.overflow = '' })

const requestConfig = ref({
  method: 'GET',
  url: '',
  headers: [] as { key: string; value: string }[],
  bodyType: 'json' as 'json' | 'form' | 'text',
  body: '{}',
  formData: [] as { key: string; value: string }[],
})

const useProxy = ref(true)
const response = ref<any>(null)
const loading = ref(false)
const saving = ref(false)
const stubId = ref<string | undefined>(undefined)
const stubName = ref('')
const jsonTheme = ref<'light' | 'dark'>('light')

const canSaveAsStub = computed(() => !!stubId.value && !loading.value)

watch(visible, (v) => {
  if (v) {
    response.value = null
    jsonTheme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// 预设请求配置
watch(() => props.presetRequest, (val) => {
  if (val) {
    requestConfig.value = {
      method: val.method || 'GET',
      url: val.url || '',
      headers: (val.headers || []).map((h: any) => ({ key: h.key, value: h.value })),
      bodyType: val.bodyType || 'json',
      body: val.body || '{}',
      formData: (val.formData || []).map((f: any) => ({ key: f.key, value: f.value })),
    }
    stubId.value = val.stubId || undefined
    stubName.value = val.stubName || ''
  } else {
    stubId.value = undefined
    stubName.value = ''
  }
}, { immediate: true })

function addHeader() { requestConfig.value.headers.push({ key: '', value: '' }) }
function removeHeader(i: number) { requestConfig.value.headers.splice(i, 1) }

function onHeaderKeyChange(h: any) {
  h.value = ''
}

function getHeaderValueOptions(key: string): string[] {
  return headerValueMap[key] || []
}
function addFormParam() { requestConfig.value.formData.push({ key: '', value: '' }) }
function removeFormParam(i: number) { requestConfig.value.formData.splice(i, 1) }

function clearBody() {
  if (requestConfig.value.bodyType === 'json') requestConfig.value.body = '{}'
  else if (requestConfig.value.bodyType === 'form') requestConfig.value.formData = []
  else requestConfig.value.body = ''
}

function formatBody() {
  if (requestConfig.value.bodyType !== 'json') return
  try {
    requestConfig.value.body = JSON.stringify(JSON.parse(requestConfig.value.body), null, 2)
    MessagePlugin.success('JSON 已格式化')
  } catch { MessagePlugin.warning('JSON 格式无效') }
}

async function sendRequest() {
  loading.value = true
  response.value = null
  const startTime = Date.now()
  try {
    const headers: Record<string, string> = {}
    requestConfig.value.headers.filter(h => h.key.trim()).forEach(h => { headers[h.key.trim()] = h.value })

    let body: any = undefined
    if (requestConfig.value.method !== 'GET' && requestConfig.value.method !== 'HEAD') {
      if (requestConfig.value.bodyType === 'json') {
        try { body = JSON.parse(requestConfig.value.body) } catch { body = requestConfig.value.body }
      } else if (requestConfig.value.bodyType === 'form') {
        const form = new URLSearchParams()
        requestConfig.value.formData.filter(f => f.key.trim()).forEach(f => form.append(f.key, f.value))
        body = form.toString()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      } else { body = requestConfig.value.body }
    }

    const baseURL = useProxy.value ? PROXY_BASE : 'http://localhost:8080'
    const res = await axios({
      method: requestConfig.value.method.toLowerCase() as any,
      url: requestConfig.value.url, baseURL, headers, data: body,
      timeout: 30000, validateStatus: () => true,
    })
    response.value = {
      status: res.status, statusText: res.statusText, headers: res.headers,
      body: res.data, elapsed: Date.now() - startTime,
      matchedStub: res.headers['matched-stub-id'],
    }
  } catch (e: any) {
    response.value = {
      status: 0, statusText: e.message || '请求失败', headers: {},
      body: e.message, elapsed: Date.now() - startTime,
    }
  } finally {
    loading.value = false
  }
}

async function saveRequestToStub() {
  if (!stubId.value) return
  saving.value = true
  try {
    const { data: existing } = await client.get(`/mappings/${stubId.value}`)
    const testRequest = {
      method: requestConfig.value.method,
      url: requestConfig.value.url,
      headers: requestConfig.value.headers.filter((h: any) => h.key.trim()),
      body: requestConfig.value.body,
      bodyType: requestConfig.value.bodyType,
      formData: requestConfig.value.formData.filter((f: any) => f.key.trim()),
    }
    const updated = {
      ...existing,
      metadata: { ...(existing.metadata || {}), testRequest },
    }
    await client.put(`/mappings/${stubId.value}`, updated)
    MessagePlugin.success('请求配置已保存，下次点击「测试」自动加载')
  } catch (e: any) {
    MessagePlugin.error('保存失败: ' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

function getStatusTheme(s: number): string {
  if (s === 0) return 'danger'
  if (s < 300) return 'success'
  if (s < 400) return 'warning'
  return 'danger'
}
</script>

<template>
  <t-dialog v-model:visible="visible" header="请求测试" width="68%" :footer="false" destroy-on-close prevent-scroll-through>
    <div class="pg-container">
      <div class="pg-scroll">
        <!-- ===== 请求 URL ===== -->
        <div class="request-row">
          <t-select v-model="requestConfig.method" class="method-select">
            <t-option v-for="m in ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS']" :key="m" :value="m" :label="m" />
          </t-select>
          <t-input v-model="requestConfig.url" placeholder="url" class="url-input" />
        </div>

        <!-- ===== 请求头 ===== -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">Headers</span>
            <t-button size="small" theme="primary" variant="outline" @click="addHeader"><template #icon><t-icon name="add" /></template>添加</t-button>
          </div>
          <div v-for="(h, i) in requestConfig.headers" :key="i" class="header-block">
            <div class="header-row">
              <div class="key-col">
                <t-input v-model="h.key" placeholder="Key" @blur="onHeaderKeyChange(h)" />
                <div v-if="!h.key" class="key-suggest">
                  <span v-for="hk in commonHeaders" :key="hk" class="val-chip" @click="h.key = hk; onHeaderKeyChange(h)">{{ hk }}</span>
                </div>
              </div>
              <div class="value-col">
                <t-input v-model="h.value" placeholder="Value" class="header-value" />
                <div v-if="getHeaderValueOptions(h.key).length && !h.value" class="header-suggest">
                  <span v-for="v in getHeaderValueOptions(h.key)" :key="v" class="val-chip" @click="h.value = v">{{ v }}</span>
                </div>
              </div>
              <t-button theme="danger" variant="text" @click="removeHeader(i)"><t-icon name="delete" /></t-button>
            </div>
          </div>
        </div>

        <!-- ===== Body ===== -->
        <div v-if="requestConfig.method !== 'GET' && requestConfig.method !== 'HEAD'" class="section">
          <div class="section-header">
            <span class="section-title">Body</span>
            <t-select v-model="requestConfig.bodyType" size="small" class="body-type-select">
              <t-option value="json" label="JSON" />
              <t-option value="form" label="Form Data" />
              <t-option value="text" label="Raw Text" />
            </t-select>
          </div>

          <div v-if="requestConfig.bodyType === 'json'" class="body-box">
            <div class="editor-toolbar">
              <t-button size="small" variant="text" @click="clearBody">清空</t-button>
              <t-button size="small" variant="text" @click="formatBody">格式化</t-button>
            </div>
            <t-textarea v-model="requestConfig.body" :autosize="{ minRows: 4, maxRows: 8 }" placeholder='{"key": "value"}' class="code-area" />
          </div>

          <div v-else-if="requestConfig.bodyType === 'form'" class="form-list">
            <div v-for="(f, i) in requestConfig.formData" :key="i" class="header-row">
              <t-input v-model="f.key" placeholder="Key" class="header-key" />
              <t-input v-model="f.value" placeholder="Value" class="header-value" />
              <t-button theme="danger" variant="text" @click="removeFormParam(i)"><t-icon name="delete" /></t-button>
            </div>
            <t-button size="small" variant="dashed" @click="addFormParam"><template #icon><t-icon name="add" /></template>添加参数</t-button>
          </div>

          <div v-else class="body-box">
            <t-textarea v-model="requestConfig.body" :autosize="{ minRows: 4, maxRows: 8 }" placeholder="Raw body content" class="code-area" />
          </div>
        </div>

        <!-- ===== 响应结果 ===== -->
        <div v-if="response" class="section response-block">
          <div class="section-header">
            <div class="flex-center gap-12">
              <t-tag :theme="getStatusTheme(response.status)">{{ response.status || 'ERR' }} {{ response.statusText }}</t-tag>
              <t-tag v-if="response.matchedStub" theme="success" variant="outline">Mock 命中</t-tag>
            </div>
            <span class="response-time">{{ response.elapsed }}ms</span>
          </div>

          <div class="response-sub"><div class="subsection-title">响应头</div>
            <div class="headers-mini">
              <div v-for="(v, k) in response.headers" :key="k" class="header-line">
                <span class="hn">{{ k }}:</span><span class="hv">{{ v }}</span>
              </div>
            </div>
          </div>

          <div class="response-sub">
            <div class="subsection-title">响应体</div>
            <div class="response-body-box">
              <VueJsonPretty v-if="typeof response.body === 'object'" :data="response.body" :theme="jsonTheme" :deep="2" showLength />
              <pre v-else class="raw-text">{{ response.body }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 底部操作 ===== -->
      <div class="pg-footer">
        <div class="footer-left">
          <t-button theme="primary" :loading="loading" @click="sendRequest"><template #icon><t-icon name="send" /></template>发送</t-button>
          <t-switch v-model="useProxy" size="small" />
          <span class="proxy-text">通过代理</span>
        </div>
        <div class="footer-right">
          <t-button v-if="canSaveAsStub" :loading="saving" theme="success" @click="saveRequestToStub" :title="`保存当前请求配置到: ${stubName}`">
            <template #icon><t-icon name="save" /></template>
            保存测试用例
          </t-button>
          <t-button variant="outline" style="margin-left:8px" @click="visible = false">关闭</t-button>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped>
.pg-container { display: flex; flex-direction: column; gap: 0; max-height: 75vh; }
.pg-scroll { flex: 1; overflow-y: auto; padding: 0 12px 0 0; }

/* URL */
.request-row { display: flex; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--td-component-stroke); }
.method-select { width: 110px; flex-shrink: 0; }
.url-input { flex: 1; }

/* Section */
.section { padding-top: 16px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--td-text-color-primary); }
.body-type-select { width: 120px; }

/* Headers */
.header-block { margin-bottom: 8px; }
.header-row { display: flex; gap: 8px; align-items: flex-start; }
.key-col { flex: 4; }
.key-suggest { display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0 0 0; }
.value-col { flex: 6; }
.header-value { width: 100%; }
.header-suggest { display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0 0 0; }
.val-chip { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--td-bg-color-container); border: 1px solid var(--td-component-stroke); cursor: pointer; color: var(--td-text-color-secondary); }
.val-chip:hover { border-color: var(--td-brand-color); color: var(--td-brand-color); }

/* Body */
.body-box { border: 1px solid var(--td-component-stroke); border-radius: 6px; overflow: hidden; }
.editor-toolbar { display: flex; gap: 8px; padding: 6px 12px; background: var(--td-bg-color-page); border-bottom: 1px solid var(--td-component-stroke); }
.code-area :deep(.t-textarea__inner) { border: none; border-radius: 0; font-family: 'Consolas','Monaco',monospace; font-size: 13px; line-height: 1.6; resize: vertical; }
.form-list { display: flex; flex-direction: column; gap: 8px; }

/* Response */
.response-block { border-top: 1px solid var(--td-component-stroke); }
.response-time { font-size: 13px; color: var(--td-text-color-placeholder); }
.response-sub { padding-top: 12px; }
.subsection-title { font-size: 12px; font-weight: 600; color: var(--td-text-color-secondary); text-transform: uppercase; margin-bottom: 8px; }
.headers-mini { background: var(--td-bg-color-page); border-radius: 6px; padding: 10px 12px; }
.header-line { display: flex; gap: 8px; padding: 3px 0; font-size: 13px; font-family: monospace; }
.hn { color: var(--td-text-color-secondary); flex-shrink: 0; }
.hv { color: var(--td-text-color-primary); word-break: break-all; }
.response-body-box { background: var(--td-bg-color-page); border-radius: 6px; padding: 10px; }
.raw-text { margin: 0; font-family: 'Consolas','Monaco',monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }

/* Footer */
.pg-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--td-component-stroke); margin-top: 16px; }
.footer-left { display: flex; align-items: center; gap: 16px; }
.footer-right { display: flex; align-items: center; }
.proxy-text { font-size: 13px; color: var(--td-text-color-secondary); }
</style>

<!-- 非 scoped 样式，穿透 Dialog Teleport -->
<style>
.t-dialog__ctx .t-dialog__position.t-dialog--top {
  padding-top: 6vh !important;
}
</style>
