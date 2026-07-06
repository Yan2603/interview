<script setup lang="ts">
import '@wangeditor/editor/dist/css/style.css';
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';

import { sanitizeRichTextHtml } from '../utils/sanitize-rich-text';

function normalizeHtml(value: string) {
  return value
    .replace(/<p><br><\/p>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .trim();
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    minHeight?: number;
    readonly?: boolean;
  }>(),
  {
    placeholder: '',
    minHeight: 300,
    readonly: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorRef = shallowRef<IDomEditor>();
const html = shallowRef(sanitizeRichTextHtml(props.modelValue));

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    'group-image',
    'group-video',
    'insertTable',
    'codeBlock',
    'fullScreen',
  ],
};

const editorConfig = computed<Partial<IEditorConfig>>(() => ({
  placeholder: props.readonly ? '' : props.placeholder,
  readOnly: props.readonly,
}));

const editorStyle = computed(() => ({
  height: props.readonly ? 'auto' : `${props.minHeight}px`,
  minHeight: props.readonly ? '80px' : undefined,
  overflowY: 'hidden' as const,
}));

watch(
  () => props.modelValue,
  (value) => {
    const safe = sanitizeRichTextHtml(value);
    if (normalizeHtml(html.value) !== normalizeHtml(safe)) {
      html.value = safe;
    }
  },
);

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor;
  if (props.readonly) {
    editor.disable();
  }
}

watch(
  () => props.readonly,
  (readonly) => {
    if (!editorRef.value) return;
    if (readonly) {
      editorRef.value.disable();
    } else {
      editorRef.value.enable();
    }
  },
);

function handleChange(editor: IDomEditor) {
  if (props.readonly) return;
  const next = sanitizeRichTextHtml(normalizeHtml(editor.getHtml()));
  if (normalizeHtml(props.modelValue) !== next) {
    emit('update:modelValue', next);
  }
}

onBeforeUnmount(() => {
  editorRef.value?.destroy();
});
</script>

<template>
  <div class="rich-text-editor" :class="{ readonly }">
    <Toolbar
      v-if="!readonly"
      class="toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      v-model="html"
      class="editor"
      :default-config="editorConfig"
      :style="editorStyle"
      mode="default"
      @on-created="handleCreated"
      @on-change="handleChange"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.toolbar {
  border-bottom: 1px solid #f0f0f0;
}

.editor :deep(.w-e-text-container) {
  background: #fff;
}

.editor :deep(.w-e-scroll) {
  overflow-y: auto !important;
}

.rich-text-editor.readonly {
  border: none;
  border-radius: 0;
}

.rich-text-editor.readonly .editor :deep(.w-e-text-container) {
  border: none;
}

.rich-text-editor.readonly .editor :deep(.w-e-scroll) {
  overflow-y: visible !important;
}

.rich-text-editor.readonly .editor :deep(.w-e-text-container [data-slate-editor]) {
  padding: 0;
}
</style>
