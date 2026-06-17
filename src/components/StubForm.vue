<script setup lang="ts">
import { watch, ref } from 'vue'
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

// 响应头推荐项
const commonResponseHeaders = [
  'Content-Type', 'Cache-Control', 'Set-Cookie',
  'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers',
  'Access-Control-Max-Age', 'Access-Control-Expose-Headers', 'Access-Control-Allow-Credentials',
  'Content-Encoding', 'Content-Disposition',
  'ETag', 'Last-Modified', 'Location',
  'X-Request-Id', 'X-Trace-Id', 'X-Response-Time',
  'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After',
  'X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection',
  'Strict-Transport-Security', 'Content-Security-Policy',
  'Server', 'Vary', 'Pragma', 'Expires',
]
const respHeaderValueMap: Record<string, string[]> = {
  'Content-Type': ['application/json; charset=utf-8', 'text/html; charset=utf-8', 'text/plain; charset=utf-8', 'application/xml', 'application/octet-stream'],
  'Cache-Control': ['no-cache, no-store, must-revalidate', 'no-cache', 'max-age=3600', 'public, max-age=86400', 'private', 'no-store'],
  'Access-Control-Allow-Origin': ['*', 'https://example.com'],
  'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS', 'GET, POST', 'GET'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization', '*', 'Content-Type'],
  'Access-Control-Max-Age': ['3600', '86400'],
  'Access-Control-Allow-Credentials': ['true', 'false'],
  'Content-Encoding': ['gzip', 'br', 'deflate'],
  'X-Frame-Options': ['DENY', 'SAMEORIGIN', 'ALLOW-FROM https://example.com'],
  'X-Content-Type-Options': ['nosniff'],
  'X-XSS-Protection': ['1; mode=block', '1', '0'],
  'Strict-Transport-Security': ['max-age=31536000; includeSubDomains', 'max-age=31536000'],
  'Content-Security-Policy': ["default-src 'self'", "default-src 'self' 'unsafe-inline'", "default-src 'none'"],
  'Content-Disposition': ['attachment; filename="file.pdf"', 'inline'],
  'Vary': ['Accept-Encoding', 'Origin'],
  'Pragma': ['no-cache'],
  'Expires': ['0', 'Thu, 01 Dec 1994 16:00:00 GMT'],
}

function getHeaderValueOptions(key: string): string[] {
  return headerValueMap[key] || []
}

const BODY_TYPES = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'TEXT (纯文本)' },
  { value: 'html', label: 'HTML' },
  { value: 'base64', label: 'BASE64 (二进制)' },
]
const bodyTypeToContentType: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  text: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  base64: 'application/octet-stream',
}
const contentTypeToBodyType: Record<string, string> = {
  'application/json': 'json',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'text/html': 'html',
  'text/plain': 'text',
  'application/octet-stream': 'base64',
}

const FILTER_TYPES = [
  { value: 'header', label: '请求头' },
  { value: 'query', label: '查询参数' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'body', label: '请求体' },
]
const TEXT_OPERATORS = [
  { value: 'equalTo', label: '等于', hasCaseInsensitive: true },
  { value: 'doesNotEqual', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'doesNotContain', label: '不包含' },
  { value: 'matches', label: '正则匹配' },
  { value: 'doesNotMatch', label: '不匹配' },
  { value: 'absent', label: '不存在' },
]
const BODY_OPERATORS = [
  { value: 'equalToJson', label: 'JSON 相等' },
  { value: 'matchesJsonPath', label: 'JSON Path' },
]

// JSON Path 子匹配器 —— 当选择 JSON Path 后，进一步指定匹配方式
const JSONPATH_SUB_MATCHERS = [
  { value: '', label: '仅匹配路径存在' },
  { value: 'equalTo', label: '等于' },
  { value: 'equalToJson', label: 'JSON 等于' },
  { value: 'contains', label: '包含' },
  { value: 'matches', label: '正则匹配' },
  { value: 'doesNotContain', label: '不包含' },
  { value: 'absent', label: '路径不存在' },
]

const groupsStore = useGroupsStore()

function getOperators(filterType: string): { value: string; label: string; hasCaseInsensitive?: boolean; disabled?: boolean }[] {
  if (filterType === 'body') {
    return [
      ...TEXT_OPERATORS.filter(o => o.value !== 'absent'),
      { value: '', label: '── JSON ──', disabled: true } as any,
      ...BODY_OPERATORS,
    ]
  }
  return TEXT_OPERATORS
}

const form = defineModel<any>('form', { required: true })

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFileName = ref('')

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    // FileReader readAsDataURL 返回 data:...;base64,... 格式，去掉前缀
    const base64 = result.split(',')[1] || result
    form.value.responseBody = base64
    form.value.bodyType = 'base64'
  }
  reader.readAsDataURL(file)
  // 重置 input 以便再次选择同一文件
  input.value = ''
}

// 选择分组时自动填充前缀
watch(() => form.value.selectedGroupId, (groupId) => {
  if (groupId) {
    const g = groupsStore.groups.find(g => g.id === groupId)
    if (g?.prefix) form.value.prefix = g.prefix
  }
})

// 切换 bodyType 时自动更新 Content-Type（form.contentType + 响应头中的 Content-Type）
watch(() => form.value.bodyType, (bt, oldBt) => {
  if (bt && bodyTypeToContentType[bt]) {
    form.value.contentType = bodyTypeToContentType[bt]
    const ctHeader = form.value.responseHeaders.find((h: any) => h.key.toLowerCase() === 'content-type')
    if (ctHeader) {
      ctHeader.value = bodyTypeToContentType[bt]
    }
  }
  // 从 base64 切换到其他类型时清空响应体
  if (oldBt === 'base64' && bt !== 'base64') {
    form.value.responseBody = ''
  }
})

function getUrlPlaceholder() {
  const map: Record<string, string> = { url: '/api/user/info', urlPath: '/api/user', urlPathPattern: '/api/.*', urlPattern: '.*/api/user/.*' }
  return map[form.value.urlType] || ''
}
function addResponseHeader() { form.value.responseHeaders.push({ key: '', value: '' }) }
function removeResponseHeader(i: number) { form.value.responseHeaders.splice(i, 1) }
function getRespHeaderValueOptions(key: string): string[] {
  return respHeaderValueMap[key] || []
}
function onRespHeaderKeyChange(h: any) {
  h.value = ''
}
function onRespHeaderValueChange(h: any) {
  // 用户修改 Content-Type 值 → 同步 bodyType
  if (h.key.toLowerCase() === 'content-type') {
    const base = (h.value || '').split(';')[0].trim()
    if (contentTypeToBodyType[base]) {
      form.value.bodyType = contentTypeToBodyType[base]
    }
    form.value.contentType = h.value
  }
}
function onFilterTypeChange(f: any) {
  if (f.operator === 'absent') f.value = ''
}

// 请求筛选
function addFilter() { form.value.filters.push({ type: 'header', key: '', operator: 'equalTo', value: '', not: false, caseInsensitive: false }) }
function removeFilter(i: number) { form.value.filters.splice(i, 1) }
function onOperatorChange(f: any) {
  if (f.operator === 'absent') {
    f.value = ''
  }
  // 切换到 JSON Path 时，确保默认子匹配器字段存在
  if (f.operator === 'matchesJsonPath') {
    if (!('subMatcher' in f)) f.subMatcher = ''
    if (!('subValue' in f)) f.subValue = ''
  }
}
function onJsonPathSubChange(f: any) {
  // 子匹配器为空或 absent 时清空子值
  if (!f.subMatcher || f.subMatcher === 'absent') {
    f.subValue = ''
  }
}
function onFilterKeyChange(f: any) {
  f.value = ''
}
</script>

<template>
  <t-form-item label="规则名称"><t-input v-model="form.name" placeholder="便于识别的名称（可选）" /></t-form-item>
  <t-form-item label="描述"><t-input v-model="form.description" placeholder="规则说明，例如接口用途、请求参数等" /></t-form-item>
  <t-form-item label="所属分组">
    <t-select v-model="form.selectedGroupId" clearable placeholder="选择分组（可选）" :style="{ width: '200px' }"><t-option v-for="g in groupsStore.groups" :key="g.id" :value="g.id" :label="g.name" /></t-select>
  </t-form-item>
  <t-form-item label="优先级"><t-input-number v-model="form.priority" :min="1" :max="100" :style="{ width: '120px' }" /><span class="text-sm text-muted" style="margin-left:8px">越小越优先</span></t-form-item>
  <t-divider>请求匹配</t-divider>
  <t-form-item label="请求方法"><t-select v-model="form.method" :style="{ width: '140px' }"><t-option v-for="m in ALL_METHODS" :key="m" :value="m" :label="m" /></t-select></t-form-item>
  <t-form-item label="URL 类型"><t-radio-group v-model="form.urlType" size="small"><t-radio value="url">精确匹配</t-radio><t-radio value="urlPath">路径匹配</t-radio><t-radio value="urlPathPattern">路径正则</t-radio><t-radio value="urlPattern">全 URL 正则</t-radio></t-radio-group></t-form-item>
  <t-form-item label="URL 前缀">
    <div class="prefix-row">
      <t-input v-model="form.prefix" placeholder="/api/v1" :style="{ width: '160px', fontFamily: 'monospace' }" />
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
      <div v-for="(f, i) in form.filters" :key="i" class="filter-block">
        <div class="filter-row">
          <t-select v-model="f.type" class="col-type" @change="onFilterTypeChange(f)">
            <t-option v-for="ft in FILTER_TYPES" :key="ft.value" :value="ft.value" :label="ft.label" />
          </t-select>
          <t-checkbox v-model="f.not" class="col-not">NOT</t-checkbox>
          <div v-if="f.type !== 'body'" class="col-key">
            <t-input v-model="f.key" placeholder="Key" @blur="onFilterKeyChange(f)" />
          </div>
          <div v-else class="col-key" />
          <t-select v-model="f.operator" class="col-op" @change="onOperatorChange(f)">
            <t-option v-for="op in getOperators(f.type)" :key="op.value" :value="op.value" :label="op.label" :disabled="op.disabled" />
          </t-select>
          <div v-if="f.operator !== 'absent'" class="col-val">
            <!-- JSON Path 三栏专用布局 -->
            <div v-if="f.operator === 'matchesJsonPath'" class="jsonpath-row">
              <div class="jsonpath-expr-wrap">
                <span class="jsonpath-prefix">$</span>
                <t-input v-model="f.value" placeholder="路径，如 .Id 或 ..name" size="small" @blur="() => { if (!f.value.startsWith('$')) f.value = '$' + f.value }" />
              </div>
              <t-select v-model="f.subMatcher" size="small" class="jsonpath-op" placeholder="匹配方式" clearable @change="onJsonPathSubChange(f)">
                <t-option v-for="op in JSONPATH_SUB_MATCHERS" :key="op.value" :value="op.value" :label="op.label" />
              </t-select>
              <t-input v-if="f.subMatcher && f.subMatcher !== 'absent'" v-model="f.subValue" placeholder="期望值" size="small" class="jsonpath-val" />
            </div>
            <!-- 默认单栏布局 -->
            <div v-else class="val-row">
              <t-input v-model="f.value" placeholder="value" :style="{ flex: 1 }" />
              <t-checkbox v-if="f.operator === 'equalTo' && f.type !== 'body'" v-model="f.caseInsensitive" class="val-opt">忽略大小写</t-checkbox>
            </div>
          </div>
          <div v-else class="col-val" />
          <t-button theme="danger" variant="text" class="col-del" @click="removeFilter(i)"><t-icon name="delete" /></t-button>
        </div>
        <!-- Key 建议 -->
        <div v-if="f.type === 'header' && !f.key" class="suggest-row">
          <div class="suggest-inner" style="grid-column:3">
            <span v-for="hk in commonHeaders" :key="hk" class="suggest-chip" @click="f.key = hk; onFilterKeyChange(f)">{{ hk }}</span>
          </div>
        </div>
        <!-- Value 建议 -->
        <div v-if="f.type === 'header' && f.key && headerValueMap[f.key]?.length && !f.value" class="suggest-row">
          <div class="suggest-inner" style="grid-column:5">
            <span v-for="v in headerValueMap[f.key]" :key="v" class="suggest-chip" @click="f.value = v">{{ v }}</span>
          </div>
        </div>
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
    <t-form-item label="响应头">
      <div class="w-full">
        <div v-for="(h, i) in form.responseHeaders" :key="i" class="resp-header-block">
          <div class="resp-header-row">
            <t-input v-model="h.key" placeholder="Key" :style="{ flex: '4 1 100px' }" @change="onRespHeaderKeyChange(h)" />
            <t-input v-model="h.value" placeholder="Value" :style="{ flex: '6 1 150px' }" @change="onRespHeaderValueChange(h)" />
            <t-button theme="danger" variant="text" @click="removeResponseHeader(i)"><t-icon name="delete" /></t-button>
          </div>
          <!-- Key 建议 -->
          <div class="resp-header-suggest" v-if="!h.key">
            <span v-for="hk in commonResponseHeaders" :key="hk" class="suggest-chip" @click="h.key = hk; onRespHeaderKeyChange(h)">{{ hk }}</span>
          </div>
          <!-- Value 建议 -->
          <div class="resp-header-suggest" v-if="h.key && getRespHeaderValueOptions(h.key).length && !h.value">
            <span v-for="v in getRespHeaderValueOptions(h.key)" :key="v" class="suggest-chip" @click="h.value = v; onRespHeaderValueChange(h)">{{ v }}</span>
          </div>
        </div>
        <t-button size="small" variant="dashed" @click="addResponseHeader"><template #icon><t-icon name="add" /></template>添加响应头</t-button>
      </div>
    </t-form-item>
    <t-form-item label="Body 类型">
      <t-radio-group v-model="form.bodyType" size="small">
        <t-radio v-for="bt in BODY_TYPES" :key="bt.value" :value="bt.value">{{ bt.label }}</t-radio>
      </t-radio-group>
    </t-form-item>
    <t-form-item label="响应体"><JsonEditor v-model="form.responseBody" :bodyType="form.bodyType" /></t-form-item>
    <t-form-item label=" ">
      <div class="file-import-row">
        <input ref="fileInputRef" type="file" style="display:none" @change="onFileSelected" />
        <t-button size="small" variant="outline" @click="fileInputRef?.click()">
          <template #icon><t-icon name="file-excel" /></template>
          选择文件（自动转为 Base64）
        </t-button>
        <span v-if="selectedFileName" class="file-name">{{ selectedFileName }}</span>
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

.filter-block {
  margin-bottom: 10px;
}
.filter-row {
  display: grid;
  grid-template-columns: 90px auto 150px 120px 1fr auto;
  gap: 6px;
  align-items: center;
}
.col-not  { text-align: center; font-size: 12px; }
.col-key  { min-width: 0; }
.col-op   { min-width: 0; }
.col-val  { min-width: 0; overflow: hidden; }

/* 建议行 —— 与 filter-row 使用相同的 grid，item 通过 grid-column 对齐 */
.suggest-row {
  display: grid;
  grid-template-columns: 90px auto 150px 120px 1fr auto;
  gap: 6px;
  padding-top: 4px;
}
.suggest-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.val-row { display: flex; align-items: center; gap: 6px; }
.val-opt { flex-shrink: 0; font-size: 12px; white-space: nowrap; }

/* JSON Path 三栏布局 —— 使用 grid 避免 flex 塌缩 */
.jsonpath-row {
  display: grid;
  grid-template-columns: 1fr 110px 1fr;
  gap: 6px;
  align-items: center;
  width: 100%;
}
.jsonpath-expr-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.jsonpath-prefix {
  position: absolute;
  left: 8px;
  z-index: 2;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-brand-color);
  pointer-events: none;
  line-height: 32px;
}
.jsonpath-expr-wrap :deep(.t-input) {
  padding-left: 24px;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
}
.jsonpath-op {
  min-width: 0;
}
.jsonpath-val {
  min-width: 0;
}

.suggest-chip {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  cursor: pointer;
  color: var(--td-text-color-secondary);
  width: fit-content;
}
.suggest-chip:hover {
  border-color: var(--td-brand-color);
  color: var(--td-brand-color);
}
.filter-option { padding: 2px 0 0 102px; }

.resp-header-block {
  margin-bottom: 12px;
}
.resp-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.resp-header-suggest {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 6px;
  padding-left: 0;
}

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

.file-import-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-name {
  font-size: 12px;
  color: var(--td-brand-color);
  font-family: monospace;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
