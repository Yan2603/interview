import { describe, expect, it } from 'vitest';
import { buildQuestionIndexText } from './question-text';

describe('buildQuestionIndexText', () => {
  it('joins title content myNotes aiAnswer', () => {
    const text = buildQuestionIndexText({
      title: '什么是响应式',
      content: '简述',
      myNotes: '笔记',
      aiAnswer: '答案',
    });
    expect(text).toContain('什么是响应式');
    expect(text).toContain('简述');
    expect(text).toContain('笔记');
    expect(text).toContain('答案');
  });

  it('skips empty optional fields', () => {
    const text = buildQuestionIndexText({
      title: '仅标题',
      content: '',
      myNotes: '',
      aiAnswer: '',
    });
    expect(text).toBe('仅标题');
  });
});
