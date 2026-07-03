import { ref } from 'vue';
import { api } from '../api';
import type { Tag } from '../types';

const tags = ref<Tag[]>([]);

export function useTags() {
  async function loadTags() {
    tags.value = await api.getTags();
  }

  function tagOptions(selected: string[] = []) {
    const names = tags.value.map((t) => t.name);
    return [...new Set([...names, ...selected])]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((value) => ({ label: value, value }));
  }

  async function createTag(name: string) {
    const order = tags.value.length
      ? Math.max(...tags.value.map((t) => t.order)) + 1
      : 1;
    const tag = await api.createTag({ name, order });
    tags.value = [...tags.value, tag].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
    return tag;
  }

  async function updateTag(id: string, name: string) {
    const updated = await api.updateTag(id, { name });
    tags.value = tags.value
      .map((t) => (t._id === id ? updated : t))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
    return updated;
  }

  async function deleteTag(id: string) {
    await api.deleteTag(id);
    tags.value = tags.value.filter((t) => t._id !== id);
  }

  return { tags, loadTags, tagOptions, createTag, updateTag, deleteTag };
}
