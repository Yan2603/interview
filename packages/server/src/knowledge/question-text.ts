export type QuestionIndexFields = {
  title: string;
  content?: string;
  myNotes?: string;
  aiAnswer?: string;
};

export function buildQuestionIndexText(q: QuestionIndexFields): string {
  return [q.title, q.content, q.myNotes, q.aiAnswer]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}
