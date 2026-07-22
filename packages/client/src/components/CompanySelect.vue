<script setup lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { useCompanies } from '../composables/useCompanies';
import { getErrorMessage } from '../utils/error';

const props = withDefaults(
  defineProps<{
    value?: string;
    placeholder?: string;
    allowClear?: boolean;
  }>(),
  {
    placeholder: '从公司库选择',
    allowClear: true,
  },
);

const emit = defineEmits<{
  'update:value': [value: string | undefined];
}>();

const VNodes = defineComponent({
  props: {
    vnodes: { type: Object, required: true },
  },
  render() {
    return this.vnodes;
  },
});

const { companies, loadCompanies, companyOptions, createCompany } = useCompanies();

const adding = ref(false);
const creating = ref(false);
const newName = ref('');
const inputRef = ref<{ focus: () => void } | null>(null);

const options = computed(() =>
  companyOptions(props.value ? [props.value] : []),
);

onMounted(() => {
  void loadCompanies();
});

async function onDropdownVisibleChange(visible: boolean) {
  if (visible && companies.value.length === 0) {
    await loadCompanies();
  }
  if (!visible) resetAdd();
}

function onSelectChange(value: string | undefined) {
  emit('update:value', value);
  resetAdd();
}

function resetAdd() {
  adding.value = false;
  newName.value = '';
}

function startAdd(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  adding.value = true;
  newName.value = '';
  nextTick(() => inputRef.value?.focus());
}

async function confirmAdd() {
  const name = newName.value.trim();
  if (!name) {
    message.warning('请填写公司名称');
    return;
  }
  creating.value = true;
  try {
    const company = await createCompany(name);
    emit('update:value', company.name);
    resetAdd();
    message.success('公司已添加');
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    creating.value = false;
  }
}

function getPopupContainer(trigger: HTMLElement) {
  return (trigger.closest('.ant-modal-body') as HTMLElement) ?? trigger.parentElement ?? document.body;
}
</script>

<template>
  <a-select
    :value="value"
    show-search
    option-filter-prop="label"
    :allow-clear="allowClear"
    :placeholder="placeholder"
    :options="options"
    :get-popup-container="getPopupContainer"
    style="width: 100%"
    @dropdown-visible-change="onDropdownVisibleChange"
    @update:value="onSelectChange"
  >
    <!-- 不要包外层 div，否则虚拟列表高度为 0，选项不显示（官方 demo 也是多根节点） -->
    <template #dropdownRender="{ menuNode: menu }">
      <VNodes :vnodes="menu" />
      <div class="company-select-footer" @mousedown.prevent>
        <template v-if="adding">
          <a-input
            ref="inputRef"
            v-model:value="newName"
            size="small"
            placeholder="输入新公司名称"
            :disabled="creating"
            @press-enter="confirmAdd"
            @keydown.esc="resetAdd"
          />
          <a-button type="link" size="small" :loading="creating" @click="confirmAdd">
            确定
          </a-button>
          <a-button type="link" size="small" :disabled="creating" @click="resetAdd">
            取消
          </a-button>
        </template>
        <a-button v-else type="link" size="small" class="add-btn" @click="startAdd">
          <template #icon><PlusOutlined /></template>
          添加公司
        </a-button>
      </div>
    </template>
  </a-select>
</template>

<style scoped>
.company-select-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
}

.add-btn {
  padding-inline: 0;
}
</style>
