import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        const encoded = encodeURIComponent(text);
        return `<div class="mermaid-block" data-mermaid="${encoded}"></div>`;
      }
      return false;
    },
  },
});

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'u', 's', 'del',
      'a', 'code', 'pre',
      'ul', 'ol', 'li',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-mermaid', 'data-rendered'],
  });
}
