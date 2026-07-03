export type Mastery = 'new' | 'reviewing' | 'mastered';
export type EventStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewType = 'remote' | 'onsite';

export interface Category {
  _id: string;
  slug: string;
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
  relatedQuestionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  upcomingEvents: InterviewEvent[];
  mastery: Record<Mastery, number>;
  totalQuestions: number;
}
