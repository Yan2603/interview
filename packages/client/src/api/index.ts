import axios from 'axios';
import type {
  Category,
  DashboardSummary,
  InterviewEvent,
  InterviewType,
  Mastery,
  Question,
  Tag,
} from '../types';

const http = axios.create({ baseURL: '/api' });

export const api = {
  getDashboard: () => http.get<DashboardSummary>('/dashboard').then((r) => r.data),

  getCategories: () => http.get<Category[]>('/categories').then((r) => r.data),

  createCategory: (data: { slug: string; name: string; order?: number }) =>
    http.post<Category>('/categories', data).then((r) => r.data),

  deleteCategory: (id: string) => http.delete(`/categories/${id}`).then((r) => r.data),

  updateCategory: (id: string, data: { name: string }) =>
    http.patch<Category>(`/categories/${id}`, data).then((r) => r.data),

  getQuestions: (params?: { category?: string; search?: string; mastery?: Mastery }) =>
    http.get<Question[]>('/questions', { params }).then((r) => r.data),

  getTags: () => http.get<Tag[]>('/tags').then((r) => r.data),

  createTag: (data: { name: string; order?: number }) =>
    http.post<Tag>('/tags', data).then((r) => r.data),

  updateTag: (id: string, data: { name: string }) =>
    http.patch<Tag>(`/tags/${id}`, data).then((r) => r.data),

  deleteTag: (id: string) => http.delete(`/tags/${id}`).then((r) => r.data),

  getQuestion: (id: string) => http.get<Question>(`/questions/${id}`).then((r) => r.data),

  createQuestion: (data: {
    title: string;
    categorySlug: string;
    content?: string;
    myNotes?: string;
    tags?: string[];
  }) => http.post<Question>('/questions', data).then((r) => r.data),

  updateQuestion: (id: string, data: Partial<Question>) =>
    http.patch<Question>(`/questions/${id}`, data).then((r) => r.data),

  deleteQuestion: (id: string) => http.delete(`/questions/${id}`).then((r) => r.data),

  generateAiAnswer: (id: string, mode: 'standard' | 'deep' = 'standard') =>
    http.post<{ aiAnswer: string }>(`/questions/${id}/ai-answer`, null, { params: { mode } }).then((r) => r.data),

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
  }) => http.post<InterviewEvent>('/events', data).then((r) => r.data),

  updateEvent: (id: string, data: Partial<InterviewEvent>) =>
    http.patch<InterviewEvent>(`/events/${id}`, data).then((r) => r.data),

  deleteEvent: (id: string) => http.delete(`/events/${id}`).then((r) => r.data),
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
