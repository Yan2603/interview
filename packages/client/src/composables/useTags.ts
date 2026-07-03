import { ref } from 'vue';
import { api } from '../api';

const tags = ref<string[]>([]);

export function useTags() {
  async function loadTags() {
    tags.value = await api.getTags();
  }

  function tagOptions(selected: string[] = []) {
    return [...new Set([...tags.value, ...selected])]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((value) => ({ label: value, value }));
  }

  return { tags, loadTags, tagOptions };
}
