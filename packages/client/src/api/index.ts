import axios from 'axios';
import type {
  Category,
  Company,
  DashboardSummary,
  InterviewEvent,
  InterviewType,
  Mastery,
  PaginatedResponse,
  Question,
  Tag,
} from '../types';

const http = axios.create({
  baseURL: '/api',
  timeout: 300000, // AI 作答可能超过 60s
});

export const api = {
  getDashboard: () => http.get<DashboardSummary>('/dashboard').then((r) => r.data),

  getCategories: () => http.get<Category[]>('/categories').then((r) => r.data),

  createCategory: (data: { slug: string; name: string; order?: number }) =>
    http.post<Category>('/categories', data).then((r) => r.data),

  deleteCategory: (id: string) => http.delete(`/categories/${id}`).then((r) => r.data),

  updateCategory: (id: string, data: { name: string }) =>
    http.patch<Category>(`/categories/${id}`, data).then((r) => r.data),

  getQuestions: (params?: {
    category?: string;
    search?: string;
    mastery?: Mastery;
    company?: string;
    page?: number;
    pageSize?: number;
  }) =>
    http.get<PaginatedResponse<Question>>('/questions', { params }).then((r) => r.data),

  getTags: () => http.get<Tag[]>('/tags').then((r) => r.data),

  createTag: (data: { name: string; order?: number }) =>
    http.post<Tag>('/tags', data).then((r) => r.data),

  updateTag: (id: string, data: { name: string }) =>
    http.patch<Tag>(`/tags/${id}`, data).then((r) => r.data),

  deleteTag: (id: string) => http.delete(`/tags/${id}`).then((r) => r.data),

  getCompanies: () => http.get<Company[]>('/companies').then((r) => r.data),

  createCompany: (data: { name: string; order?: number }) =>
    http.post<Company>('/companies', data).then((r) => r.data),

  updateCompany: (id: string, data: { name: string }) =>
    http.patch<Company>(`/companies/${id}`, data).then((r) => r.data),

  deleteCompany: (id: string) => http.delete(`/companies/${id}`).then((r) => r.data),

  getQuestion: (id: string) => http.get<Question>(`/questions/${id}`).then((r) => r.data),

  createQuestion: (data: {
    title: string;
    categorySlug: string;
    content?: string;
    myNotes?: string;
    tags?: string[];
    companies?: string[];
  }) => http.post<Question>('/questions', data).then((r) => r.data),

  updateQuestion: (id: string, data: Partial<Question>) =>
    http.patch<Question>(`/questions/${id}`, data).then((r) => r.data),

  deleteQuestion: (id: string) => http.delete(`/questions/${id}`).then((r) => r.data),

  generateAiAnswer: (id: string, mode: 'standard' | 'deep' = 'standard') =>
    http
      .post<{ aiAnswer: string }>(`/questions/${id}/ai-answer`, {}, { params: { mode } })
      .then((r) => r.data),

  getEvents: (params?: { from?: string; to?: string }) =>
    http.get<InterviewEvent[]>('/events', { params }).then((r) => r.data),

  getEvent: (id: string) => http.get<InterviewEvent>(`/events/${id}`).then((r) => r.data),

  createEvent: (data: {
    company: string;
    round?: string;
    start: string;
    end?: string;
    link?: string;
    interviewType?: InterviewEvent['interviewType'];
    location?: string;
    notes?: string;
    status?: InterviewEvent['status'];
    result?: InterviewEvent['result'];
  }) => http.post<InterviewEvent>('/events', data).then((r) => r.data),

  updateEvent: (id: string, data: Partial<InterviewEvent>) =>
    http.patch<InterviewEvent>(`/events/${id}`, data).then((r) => r.data),

  deleteEvent: (id: string) => http.delete(`/events/${id}`).then((r) => r.data),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<{ url: string }>('/uploads', form, {
        timeout: 60000,
      })
      .then((r) => r.data);
  },

  // TODO: 后续鉴权提案实现真实接口 POST /api/auth/sms/send，此处仅 mock 成功
  sendSmsCode: (_phone: string, _dialCode: string): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 500)),
};

export const MASTERY_LABELS: Record<Mastery, string> = {
  new: '未看',
  reviewing: '复习中',
  mastered: '已掌握',
};

export const MASTERY_COLORS: Record<Mastery, string> = {
  new: 'default',
  reviewing: 'processing',
  mastered: 'success',
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  remote: '远程',
  onsite: '线下',
};

export const EVENT_STATUS_LABELS: Record<InterviewEvent['status'], string> = {
  scheduled: '待面试',
  completed: '已完成',
  cancelled: '已取消',
};

export const EVENT_STATUS_COLORS: Record<InterviewEvent['status'], string> = {
  scheduled: 'processing',
  completed: 'success',
  cancelled: 'default',
};

export const INTERVIEW_RESULT_LABELS: Record<InterviewEvent['result'], string> = {
  pending: '待结果',
  passed: '通过',
  failed: '未通过',
  offer: '拿到 offer',
};

export const INTERVIEW_RESULT_COLORS: Record<InterviewEvent['result'], string> = {
  pending: 'default',
  passed: 'success',
  failed: 'error',
  offer: 'gold',
};
