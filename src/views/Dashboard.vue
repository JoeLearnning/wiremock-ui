<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { useMappingsStore } from '@/stores/mappings'
import { useGroupsStore } from '@/stores/groups'
import GroupList from '@/components/GroupList.vue'
import StubList from '@/components/StubList.vue'
import StubEditor from '@/components/StubEditor.vue'
import ProxySettings from '@/components/ProxySettings.vue'
import type { StubMapping } from '@/api/types'

const mappingsStore = useMappingsStore()
const groupsStore = useGroupsStore()
const openPlayground = inject<(config?: any) => void>('openPlayground')!

const editingStub = ref<StubMapping | null>(null)
const creatingNew = ref(false)
const activeTab = ref<'stubs' | 'proxy'>('stubs')

onMounted(async () => {
  try {
    await groupsStore.loadGroups()
    await mappingsStore.fetchMappings()
    groupsStore.syncFromStubs(mappingsStore.mappings)
  } catch (e: any) {
    console.warn('WireMock 连接失败:', e.message)
  }
})

function handleCreate() { creatingNew.value = true; editingStub.value = null }
function handleCancel() { editingStub.value = null; creatingNew.value = false }
function handleEdit(stub: StubMapping) { editingStub.value = { ...stub } }

async function handleSave(stub: StubMapping) {
  try {
    if (stub.id || stub.uuid) {
      await mappingsStore.updateMapping(stub.id || stub.uuid!, stub)
      MessagePlugin.success('Mock 规则已更新')
    } else {
      await mappingsStore.createMapping(stub)
      MessagePlugin.success('Mock 规则已创建')
    }
    groupsStore.syncFromStubs(mappingsStore.mappings)
    editingStub.value = null; creatingNew.value = false
  } catch (e: any) {
    MessagePlugin.error('保存失败: ' + (e.message || '未知错误'))
  }
}

async function handleDelete() {
  const id = editingStub.value?.uuid || editingStub.value?.id
  if (id) {
    try {
      await mappingsStore.deleteMapping(id)
      MessagePlugin.success('Mock 规则已删除')
      editingStub.value = null; creatingNew.value = false
    } catch (e: any) {
      MessagePlugin.error('删除失败: ' + (e.message || '未知错误'))
    }
  }
}

async function handleReset() {
  await new Promise<void>((resolve) => {
    DialogPlugin.confirm({
      body: '确定要清空所有 Mock 规则吗？此操作不可恢复！',
      confirmBtn: { content: '确定', theme: 'danger' },
      cancelBtn: '取消',
      onConfirm: async () => { await mappingsStore.resetAll(); MessagePlugin.success('已清空所有规则'); resolve() },
      onCancel: () => resolve(),
      onClose: () => resolve(),
    })
  })
}
</script>

<template>
  <div class="dashboard">
    <!-- 左侧分组栏 -->
    <aside class="sidebar">
      <GroupList />
    </aside>

    <!-- 右侧主区域 -->
    <main class="main-area">
      <header class="top-bar">
        <div class="top-bar-left">
          <span class="logo">
            <t-icon name="server" size="20px" />
            <span class="logo-text">WireMock UI</span>
          </span>
          <span class="top-bar-info">
            <t-icon name="layers" size="14px" />
            <span>{{ mappingsStore.mappings.length }} 条规则</span>
            <t-divider layout="vertical" />
            <t-icon name="folder" size="14px" />
            <span>{{ groupsStore.selectedGroup?.name || '全部' }}</span>
          </span>
        </div>
        <div class="top-bar-right">
          <t-button size="small" theme="danger" @click="handleReset">清空所有规则</t-button>
        </div>
      </header>

      <div class="content-area">
        <t-tabs v-model="activeTab" class="main-tabs">
          <t-tab-panel value="stubs" label="Mock 规则">
            <div class="stubs-layout">
              <div class="stubs-list">
                <StubList :stubs="mappingsStore.mappings" @edit="handleEdit" @create="handleCreate" />
              </div>
              <div class="stubs-editor">
                <template v-if="editingStub !== null || creatingNew">
                  <StubEditor inline :stub="editingStub" @save="handleSave" @cancel="handleCancel" @delete="handleDelete" @test-request="openPlayground" />
                </template>
                <div v-else class="editor-placeholder">
                  <div class="ph-illustration">
                    <t-icon name="system-code" size="28px" />
                    <t-icon name="arrow-right" size="18px" class="ph-arrow" />
                    <t-icon name="check-circle" size="28px" />
                  </div>
                  <p class="ph-title">点击左侧规则开始编辑</p>
                  <p class="ph-desc">或点击上方「新建 Mock」创建一条新规则</p>
                </div>
              </div>
            </div>
          </t-tab-panel>
          <t-tab-panel value="proxy" label="代理转发">
            <ProxySettings />
          </t-tab-panel>
        </t-tabs>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard { height: 100%; display: flex; overflow: hidden; }
.sidebar { width: 280px; background: var(--td-bg-color-container); border-right: 1px solid var(--td-component-stroke); display: flex; flex-direction: column; flex-shrink: 0; }
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar { height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: var(--td-bg-color-container); border-bottom: 1px solid var(--td-component-stroke); flex-shrink: 0; }
.top-bar-left { flex: 0 0 auto; display: flex; align-items: center; gap: 16px; }
.top-bar-info { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--td-text-color-secondary); }
.top-bar-info :deep(.t-divider) { margin: 0 4px; border-color: var(--td-component-stroke); }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: var(--td-brand-color); }
.top-bar-right { flex: 0 0 auto; }
.content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.main-tabs { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.main-tabs :deep(.t-tabs__content) { flex: 1; overflow: hidden; }
.main-tabs :deep(.t-tab-panel) { height: 100%; overflow-y: auto; background: var(--td-bg-color-container); }

/* Stubs 左右分栏 */
.stubs-layout { height: 100%; display: flex; overflow: hidden; }
.stubs-list { width: 35%; min-width: 0; overflow: hidden; border-right: 1px solid var(--td-component-stroke); }
.stubs-editor { flex: 1; overflow: hidden; background: var(--td-bg-color-container); }

.editor-placeholder {
  height: 100%;
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
.ph-title { font-size: 15px; font-weight: 600; color: var(--td-text-color-primary); margin: 0; }
.ph-desc { font-size: 13px; color: var(--td-text-color-placeholder); margin: 0; text-align: center; line-height: 1.6; max-width: 260px; }
</style>
