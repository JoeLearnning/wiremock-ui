<script setup lang="ts">
import { ref, onMounted, watch, provide } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import Playground from '@/views/Playground.vue'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()

const navItems = [
  { path: '/', label: 'Mock 管理', icon: 'app' },
  { key: 'playground', label: '请求测试', icon: 'play' },
  { path: '/requests', label: '请求记录', icon: 'view-list' },
]

const showPlayground = ref(false)
const playgroundPreset = ref<any>(null)
const customColor = ref(themeStore.activeColor)

// 提供 openPlayground 给子组件（Dashboard）调用
provide('openPlayground', (config?: any) => {
  playgroundPreset.value = config || null
  showPlayground.value = true
})

function handleNav(item: typeof navItems[0]) {
  if ('key' in item) {
    playgroundPreset.value = null
    showPlayground.value = true
  } else {
    router.push(item.path)
  }
}

// 暗黑模式
const isDark = ref(false)

function toggleDark() {
  isDark.value = !isDark.value
}

onMounted(() => {
  const saved = localStorage.getItem('wiremock-ui-dark')
  if (saved !== null) {
    isDark.value = saved === 'true'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyDark()
})

watch(isDark, () => {
  localStorage.setItem('wiremock-ui-dark', String(isDark.value))
  applyDark()
})

function applyDark() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

function selectThemeColor(color: string) {
  themeStore.setActiveColor(color)
}

function selectCustomThemeColor(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }
  themeStore.setActiveColor(target.value)
}

watch(
  () => themeStore.activeColor,
  (value) => {
    customColor.value = value
  },
  { immediate: true }
)
</script>

<template>
  <t-layout class="app-layout">
    <t-header class="app-header">
      <div class="header-left">
        <t-icon name="logo-github" size="24px" />
        <span class="header-title">WireMock UI</span>
      </div>
      <nav class="header-nav">
        <span
          v-for="item in navItems"
          :key="item.path || item.key"
          class="nav-item"
          :class="{ active: 'key' in item ? showPlayground : route.path === item.path }"
          @click="handleNav(item)"
        >
          <t-icon :name="item.icon" size="16px" />
          {{ item.label }}
        </span>
      </nav>
      <Playground v-model:visible="showPlayground" :preset-request="playgroundPreset" />
      <t-popup trigger="click" placement="bottom-right">
        <t-button
          theme="default"
          variant="text"
          shape="square"
          class="theme-toggle"
          title="选择主题色"
        >
          <t-icon name="palette" size="18px" />
        </t-button>
        <template #content>
          <div class="theme-picker" role="listbox" aria-label="主题色选择">
            <div class="theme-swatches">
              <button
                v-for="color in themeStore.palette"
                :key="color"
                class="theme-swatch"
                :class="{ active: themeStore.activeColor === color }"
                :style="{ backgroundColor: color }"
                :title="`主题色 ${color}`"
                @click="selectThemeColor(color)"
              />
            </div>
            <div class="theme-custom-row">
              <span class="theme-custom-label">自定义</span>
              <input
                class="theme-custom-input"
                type="color"
                :value="customColor"
                @input="selectCustomThemeColor"
                aria-label="自定义主题色"
              />
              <span class="theme-custom-value">{{ customColor }}</span>
            </div>
          </div>
        </template>
      </t-popup>
      <t-button
        theme="default"
        variant="text"
        shape="square"
        class="dark-toggle"
        @click="toggleDark"
        :title="isDark ? '切换亮色模式' : '切换暗色模式'"
      >
        <t-icon :name="isDark ? 'sunny' : 'moon'" size="18px" />
      </t-button>
    </t-header>
    <t-content class="app-content">
      <RouterView />
    </t-content>
  </t-layout>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: var(--td-brand-color);
  height: 56px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  margin-right: 32px;
}
.header-title {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}
.header-nav {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.nav-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}
.nav-item.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  font-weight: 500;
}
.dark-toggle {
  color: rgba(255, 255, 255, 0.85) !important;
  margin-left: 8px;
}
.theme-toggle {
  color: rgba(255, 255, 255, 0.85) !important;
  margin-left: 8px;
}
.dark-toggle:hover {
  color: #fff !important;
}
.theme-toggle:hover {
  color: #fff !important;
}
.theme-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
}
.theme-swatches {
  display: grid;
  grid-template-columns: repeat(3, 24px);
  gap: 8px;
}
.theme-swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.theme-swatch:hover {
  transform: scale(1.06);
}
.theme-swatch.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--td-brand-color);
}
.theme-custom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.theme-custom-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
.theme-custom-input {
  width: 28px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}
.theme-custom-value {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  font-family: Consolas, 'Courier New', monospace;
}
.app-content {
  flex: 1;
  overflow: hidden;
  background: var(--td-bg-color-page);
}
</style>
