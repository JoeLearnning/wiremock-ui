// WireMock API 类型定义

export interface StubMapping {
  id?: string
  uuid?: string
  priority?: number
  name?: string
  request: RequestPattern
  response: ResponseDefinition
  persistent?: boolean
  metadata?: Record<string, unknown>
}

export interface RequestPattern {
  method?: string
  url?: string
  urlPath?: string
  urlPathPattern?: string
  urlPattern?: string
  headers?: Record<string, StringValuePattern>
  queryParameters?: Record<string, StringValuePattern>
  cookies?: Record<string, StringValuePattern>
  bodyPatterns?: BodyPattern[]
}

export interface StringValuePattern {
  equalTo?: string
  contains?: string
  matches?: string
  doesNotMatch?: string
  absent?: boolean
}

export interface BodyPattern {
  equalToJson?: unknown
  matchesJsonPath?: string | { expression: string; [key: string]: unknown }
  contains?: string
  matches?: string
}

export interface ResponseDefinition {
  status?: number
  statusMessage?: string
  headers?: Record<string, string>
  body?: string
  jsonBody?: unknown
  base64Body?: string
  bodyFileName?: string
  fixedDelayMilliseconds?: number
  delayDistribution?: DelayDistribution
  proxyBaseUrl?: string
  /** WireMock fault type: CONNECTION_RESET_BY_PEER | EMPTY_RESPONSE | MALFORMED_RESPONSE_CHUNK | RANDOM_DATA_THEN_CLOSE */
  fault?: string
}

export interface DelayDistribution {
  type: 'lognormal' | 'uniform'
  median?: number
  sigma?: number
  lower?: number
  upper?: number
}

export interface GlobalSettings {
  fixedDelay?: number
  proxyPassThrough?: {
    enabled?: boolean
    targetBaseUrl?: string
  }
  delayDistribution?: DelayDistribution
  extended?: Record<string, unknown>
}

export interface GroupInfo {
  id: string
  name: string
  prefix?: string   // URL 前缀，选中该分组后 stub URL 会自动添加此前缀
  description?: string
  parentId?: string  // 支持嵌套分组
  stubIds: string[]
  createdAt: number
}

export interface PlaygroundResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  elapsed: number
  matchedStubId?: string
}

export interface ProxyConfig {
  mode: 'global' | 'catchall'
  enabled: boolean
  targetBaseUrl: string
  stripPrefix?: string  // 代理转发时去除的前缀
}

// ====== 请求历史类型 ======

export interface LoggedRequest {
  id: string
  method: string
  url: string
  absoluteUrl: string
  scheme: string
  host: string
  port: number
  clientIp: string
  headers: Record<string, string>
  cookies: Record<string, string>
  body: string
  bodyAsBase64: string
  browserProxyRequest: boolean
  loggedDate: number
  loggedDateString: string
  queryParams: Record<string, string>
  formParams: Record<string, string>
}

export interface LoggedResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export interface RequestJournalEntry {
  id: string
  request: LoggedRequest
  responseDefinition: LoggedResponse
  stubMapping?: StubMapping
  wasMatched: boolean
}

export interface RequestJournal {
  requests: RequestJournalEntry[]
  meta: { total: number }
  requestJournalDisabled: boolean
}
