import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'span',
  'ul', 'ol', 'li',
  'blockquote',
  'a', 'code', 'pre',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'title', 'style'];

/** 过滤富文本 HTML，用于 wangEditor 内容的存取 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html.trim()) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
