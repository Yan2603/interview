import { ref } from 'vue';
import { api } from '../api';
import type { Category } from '../types';

const categories = ref<Category[]>([]);

export function useCategories() {
  async function loadCategories() {
    categories.value = await api.getCategories();
  }

  async function createCategory(data: { slug: string; name: string }) {
    const order = categories.value.length
      ? Math.max(...categories.value.map((c) => c.order)) + 1
      : 1;
    const cat = await api.createCategory({ ...data, order });
    categories.value = [...categories.value, cat].sort((a, b) => a.order - b.order);
    return cat;
  }

  return { categories, loadCategories, createCategory };
}
