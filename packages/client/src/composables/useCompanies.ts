import { ref } from 'vue';
import { api } from '../api';
import type { Company } from '../types';

const companies = ref<Company[]>([]);

export function useCompanies() {
  async function loadCompanies() {
    companies.value = await api.getCompanies();
  }

  function companyOptions(selected: string[] = []) {
    const names = companies.value.map((c) => c.name);
    return [...new Set([...names, ...selected])]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((value) => ({ label: value, value }));
  }

  async function createCompany(name: string) {
    const order = companies.value.length
      ? Math.max(...companies.value.map((c) => c.order)) + 1
      : 1;
    const company = await api.createCompany({ name, order });
    companies.value = [...companies.value, company].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'),
    );
    return company;
  }

  async function updateCompany(id: string, name: string) {
    const updated = await api.updateCompany(id, { name });
    companies.value = companies.value
      .map((c) => (c._id === id ? updated : c))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'));
    return updated;
  }

  async function deleteCompany(id: string) {
    await api.deleteCompany(id);
    companies.value = companies.value.filter((c) => c._id !== id);
  }

  return {
    companies,
    loadCompanies,
    companyOptions,
    createCompany,
    updateCompany,
    deleteCompany,
  };
}
