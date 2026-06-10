<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import * as settingsApi from '@/api/settings'
import * as mappingsApi from '@/api/mappings'
import type { ProxyConfig } from '@/api/types'

const config = ref<ProxyConfig>({
  mode: 'catchall',
  enabled: false,
  targetBaseUrl: 'http://real-backend:9090'
})

const loading = ref(false)
const saving = ref(false)

onMounted(async () => {
  try {
    loading.value = true
    // 尝试读取当前全局代理设置
    const settings = await settingsApi.getSettings()
    if (settings.proxyPassThrough?.enabled) {
      config.value.mode = 'global'
      config.value.enabled = true
      config.value.targetBaseUrl = settings.proxyPassThrough.targetBaseUrl || ''
    } else {
      config.value.mode = 'catchall'
      // 检查是否存在 catch-all proxy stub
      const mappings = await mappingsApi.getAllMappings()
      const proxyStub = (mappings.mappings || []).find(
        (m) =>
          m.response?.proxyBaseUrl &&
          (m.request?.urlPattern === '.*' || m.request?.urlPathPattern === '.*')
      )
      if (proxyStub) {
        config.value.enabled = true
        config.value.targetBaseUrl = proxyStub.response?.proxyBaseUrl || ''
      }
    }
  } catch (e: any) {
    console.warn('读取代理设置失败:', e.message)
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  if (!config.value.targetBaseUrl.trim()) {
    MessagePlugin.warning('请输入代理目标地址')
    return
  }

  saving.value = true
  try {
    if (config.value.mode === 'global') {
      if (config.value.enabled) {
        await settingsApi.updateSettings({
          proxyPassThrough: {
            enabled: true,
            targetBaseUrl: config.value.targetBaseUrl
          }
        })
      } else {
        await settingsApi.updateSettings({
          proxyPassThrough: {
            enabled: false
          }
        })
      }
      MessagePlugin.success('全局代理设置已更新')
    } else {
      // 先删除已有的 catch-all proxy stub
      const mappings = await mappingsApi.getAllMappings()
      const existingProxyIds: string[] = (mappings.mappings || [])
        .filter(
          (m) =>
            m.response?.proxyBaseUrl &&
            (m.request?.urlPattern === '.*' || m.request?.urlPathPattern === '.*')
        )
        .map((m) => m.uuid || m.id!)
        .filter(Boolean)

      if (existingProxyIds.length > 0) {
        await mappingsApi.removeMappings({ ids: existingProxyIds })
      }

      if (config.value.enabled) {
        await mappingsApi.createMapping({
          name: '[代理转发] Catch-All Proxy',
          priority: 10,
          request: {
            method: 'ANY',
            urlPattern: '.*'
          },
          response: {
            proxyBaseUrl: config.value.targetBaseUrl
          }
        })
      }

      MessagePlugin.success('代理转发规则已更新')
    }
  } catch (e: any) {
    MessagePlugin.error('保存失败: ' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="proxy-settings">
    <div class="proxy-header flex-between">
      <span class="proxy-title">代理转发设置</span>
      <t-tag :theme="config.enabled ? 'success' : 'default'" variant="light">
        {{ config.enabled ? '已启用' : '未启用' }}
      </t-tag>
    </div>

    <div v-if="loading" class="loading-hint">
      <t-loading size="small" text="加载设置..." />
    </div>

    <template v-else>
      <div class="proxy-desc text-sm text-muted mt-12 mb-12">
        配置未命中 Mock 规则时的兜底代理转发目标。
      </div>

      <t-form label-width="80px" size="small">
        <t-form-item label="代理模式">
          <t-radio-group v-model="config.mode">
            <t-radio value="global">全局代理</t-radio>
            <t-radio value="catchall">低优先级 Stub 代理</t-radio>
          </t-radio-group>
        </t-form-item>

        <t-form-item label="启用代理">
          <t-switch v-model="config.enabled" />
        </t-form-item>

        <t-form-item label="目标地址" required>
          <t-input
            v-model="config.targetBaseUrl"
            placeholder="http://real-backend:9090"
            :disabled="!config.enabled"
          />
        </t-form-item>

        <t-form-item>
          <t-button
            theme="primary"
            size="small"
            :loading="saving"
            @click="handleSave"
          >
            保存设置
          </t-button>
          <t-button
            v-if="config.enabled && config.mode === 'catchall'"
            size="small"
            style="margin-left: 8px"
            @click="saving = false"
          >
            查看 Stub
          </t-button>
        </t-form-item>
      </t-form>

      <t-alert
        v-if="config.mode === 'global'"
        theme="info"
        class="mt-16"
        title="全局代理说明"
        message="所有未被 Mock 规则匹配的请求都会转发到目标地址。适用场景：Mock 覆盖部分接口，其余转发到真实后端。"
      />
      <t-alert
        v-else
        theme="info"
        class="mt-16"
        title="低优先级代理说明"
        message="创建一个 priority=10 的兜底 Stub，匹配所有请求并代理转发。Mock 规则设置 priority 1-9 即可优先命中。"
      />
    </template>
  </div>
</template>

<style scoped>
.proxy-settings {
  padding: 16px;
}
.proxy-header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--td-component-stroke);
}
.proxy-title {
  font-size: 15px;
  font-weight: 600;
}
.proxy-desc {
  line-height: 1.6;
}
.loading-hint {
  padding: 24px;
  text-align: center;
}
</style>
