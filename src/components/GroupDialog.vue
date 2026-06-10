<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import type { GroupInfo } from '@/api/types'

const props = defineProps<{
  visible: boolean
  group: GroupInfo | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [data: { name: string; description: string; parentId?: string }]
}>()

const groupsStore = useGroupsStore()

const name = ref('')
const description = ref('')
const parentId = ref<string>('')
const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

// 获取可选的父级分组（排除自己和后代）
const availableParents = computed(() => {
  if (!props.group) return groupsStore.groups
  const descendantIds = groupsStore.getDescendantIds(props.group.id)
  return groupsStore.groups.filter((g) => !descendantIds.includes(g.id) && g.id !== props.group?.id)
})

watch(
  () => props.visible,
  (val) => {
    if (val) {
      name.value = props.group?.name || ''
      description.value = props.group?.description || ''
      parentId.value = props.group?.parentId || ''
    }
  }
)

function handleConfirm() {
  if (!name.value.trim()) return
  emit('confirm', {
    name: name.value.trim(),
    description: description.value.trim(),
    parentId: parentId.value || undefined
  })
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="group ? '编辑分组' : '新建分组'"
    :width="480"
    :confirm-btn="{ content: '确定', disabled: !name.trim() }"
    @confirm="handleConfirm"
  >
    <t-form label-width="80px">
      <t-form-item label="分组名称" required>
        <t-input v-model="name" placeholder="例如：用户中心、订单服务" />
      </t-form-item>
      <t-form-item label="父级分组">
        <t-select v-model="parentId" clearable placeholder="不选择则为顶级分组">
          <t-option
            v-for="g in availableParents"
            :key="g.id"
            :value="g.id"
            :label="g.name"
          />
        </t-select>
      </t-form-item>
      <t-form-item label="描述">
        <t-textarea
          v-model="description"
          placeholder="可选描述信息"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>
