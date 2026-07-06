export type Mastery = 'new' | 'reviewing' | 'mastered';
export type EventStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewResult = 'pending' | 'passed' | 'failed' | 'offer';
export type InterviewType = 'remote' | 'onsite';

export interface Category {
  _id: string;
  slug: string;
  name: string;
  order: number;
}

export interface Tag {
  _id: string;
  name: string;
  order: number;
}

export interface Question {
  _id: string;
  title: string;
  categorySlug: string;
  content: string;
  myNotes: string;
  aiAnswer: string;
  mastery: Mastery;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewEvent {
  _id: string;
  company: string;
  round: string;
  start: string;
  end?: string;
  link: string;
  interviewType: InterviewType;
  location: string;
  notes: string;
  status: EventStatus;
  result: InterviewResult;
  relatedQuestionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardSummary {
  upcomingEvents: InterviewEvent[];
  mastery: Record<Mastery, number>;
  totalQuestions: number;
}
