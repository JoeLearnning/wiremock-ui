import client from './client'
import type { GlobalSettings, RequestJournal, GroupInfo } from './types'

/** 系统 Mock 的固定 UUID —— 用于存储分组数据，在 UI 中隐藏 */
export const SYSTEM_MOCK_UUID = '00000000-0000-0000-0000-000000000000'

/** 分组树节点（Mock 存储格式） */
export interface FolderTreeNode {
  id: string
  label: string
  description?: string
  children?: FolderTreeNode[]
}

// 获取全局设置
export async function getSettings(): Promise<GlobalSettings> {
  const { data } = await client.get('/settings')
  return data
}

// 更新全局设置
export async function updateSettings(settings: GlobalSettings): Promise<GlobalSettings> {
  const { data } = await client.post('/settings', settings)
  return data
}

// 健康检查
export async function healthCheck(): Promise<boolean> {
  try {
    await client.get('/health')
    return true
  } catch {
    return false
  }
}

// 重置请求日志
export async function resetRequests(): Promise<void> {
  await client.delete('/requests')
}

// 获取请求日志
export async function getRequests(params?: { limit?: number; since?: string; earliestTimestamp?: string; latestTimestamp?: string }): Promise<RequestJournal> {
  const { data } = await client.get('/requests', { params })
  return data
}

// ===================== 分组相关 =====================

/** 树形节点 → 扁平 GroupInfo[]（节点缺 id 时自动生成） */
export function treeToFlat(nodes: FolderTreeNode[], parentId?: string): GroupInfo[] {
  const result: GroupInfo[] = []
  for (const node of nodes) {
    const id = node.id || crypto.randomUUID()
    result.push({
      id,
      name: node.label,
      description: node.description,
      parentId,
      stubIds: [],
      createdAt: Date.now()
    })
    if (node.children && node.children.length > 0) {
      result.push(...treeToFlat(node.children, id))
    }
  }
  return result
}

/** 扁平 GroupInfo[] → 树形节点 */
export function flatToTree(groups: GroupInfo[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>()
  const roots: FolderTreeNode[] = []

  // 创建所有节点
  for (const g of groups) {
    map.set(g.id, { id: g.id, label: g.name, description: g.description, children: [] })
  }

  // 构建父子关系
  for (const g of groups) {
    const node = map.get(g.id)!
    if (g.parentId && map.has(g.parentId)) {
      map.get(g.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  // 清理空 children 数组
  function clean(node: FolderTreeNode) {
    if (node.children && node.children.length === 0) {
      delete node.children
    } else if (node.children) {
      node.children.forEach(clean)
    }
  }
  roots.forEach(clean)

  return roots
}

/**
 * 加载分组列表
 * 方式：通过 WireMock admin API 获取系统 Mock 的 stub 定义，
 * 从中提取 response.jsonBody（即分组树），再转为扁平列表
 */
export async function loadGroups(): Promise<GroupInfo[]> {
  try {
    const { data: stub } = await client.get(`/mappings/${SYSTEM_MOCK_UUID}`)
    const jsonBody = stub?.response?.jsonBody
    if (Array.isArray(jsonBody)) {
      return treeToFlat(jsonBody as FolderTreeNode[])
    }
    return []
  } catch {
    // 系统 Mock 可能尚不存在，返回空
    return []
  }
}

/**
 * 保存分组列表到系统 Mock
 * 方式：先获取现有 stub，更新 response.jsonBody，再 PUT 回去
 */
export async function saveGroups(groups: GroupInfo[]): Promise<void> {
  const tree = flatToTree(groups)
  try {
    // 先获取当前 stub 定义
    const { data: existingStub } = await client.get(`/mappings/${SYSTEM_MOCK_UUID}`)
    // 更新 jsonBody
    const updatedStub = {
      ...existingStub,
      response: {
        ...existingStub.response,
        jsonBody: tree,
        headers: {
          ...existingStub.response?.headers,
          'Content-Type': 'application/json'
        }
      }
    }
    await client.put(`/mappings/${SYSTEM_MOCK_UUID}`, updatedStub)
  } catch {
    // fallback: 如果读取失败则直接创建（POST 带 fixed UUID）
    await client.post('/mappings', {
      uuid: SYSTEM_MOCK_UUID,
      id: SYSTEM_MOCK_UUID,
      name: 'wiremock-ui自动生成，请勿删除',
      request: {
        urlPath: '/__wiremock-ui/folders',
        method: 'POST'
      },
      response: {
        status: 200,
        jsonBody: tree,
        headers: { 'Content-Type': 'application/json' }
      },
      persistent: true
    })
  }
}
