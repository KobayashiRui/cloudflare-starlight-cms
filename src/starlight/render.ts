import { renderHeadingMarkdown, renderPublicTable } from './preview-render.ts';
import { documentLinkUrl, documentMediaUrl, parseTiptapNode, tiptapChildren, type TiptapNode, youtubeEmbedHtml } from './tiptap.ts';

function decorateText(value: TiptapNode, output: string): string {
  const marks = Array.isArray(value.marks) ? value.marks : [];
  for (const mark of marks) {
    if (!mark || typeof mark !== 'object' || !('type' in mark)) continue;
    const typed = mark as { type: unknown; attrs?: Record<string, unknown> };
    if (typed.type === 'bold') output = `**${output}**`;
    if (typed.type === 'italic') output = `*${output}*`;
    if (typed.type === 'strike') output = `~~${output}~~`;
    if (typed.type === 'code') output = `\`${output}\``;
    if (typed.type === 'link') output = `[${output}](${documentLinkUrl(typed.attrs?.href)})`;
  }
  return output;
}
function text(value: TiptapNode): string { return decorateText(value, tiptapChildren(value).map(render).join('')); }
function asideTitle(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\]\r\n]/g, ' ').trim() : 'Note';
}
export function render(nodeValue: unknown): string {
  const value = parseTiptapNode(nodeValue);
  switch (value.type) {
    case 'text': return decorateText(value, value.text ?? '');
    case 'doc': return `${tiptapChildren(value).map(render).join('\n\n')}\n`;
    case 'paragraph': return text(value);
    case 'heading': return renderHeadingMarkdown(value);
    case 'bulletList': return tiptapChildren(value).map((item) => `- ${text(item)}`).join('\n');
    case 'orderedList': return tiptapChildren(value).map((item, index) => `${index + 1}. ${text(item)}`).join('\n');
    case 'taskList': return tiptapChildren(value).map((item) => `- [${item.attrs?.checked === true ? 'x' : ' '}] ${text(item)}`).join('\n');
    case 'taskItem': return text(value);
    case 'listItem': return text(value);
    case 'blockquote': return text(value).split('\n').map((line) => `> ${line}`).join('\n');
    case 'codeBlock': return `\`\`\`${typeof value.attrs?.language === 'string' ? value.attrs.language : ''}\n${text(value)}\n\`\`\``;
    case 'hardBreak': return '  \n';
    case 'horizontalRule': return '---';
    case 'image': return `![${typeof value.attrs?.alt === 'string' ? value.attrs.alt : ''}](${documentMediaUrl(value.attrs?.src)})`;
    case 'video': return `<video controls src="${documentMediaUrl(value.attrs?.src)}"></video>`;
    case 'youtube': return youtubeEmbedHtml(value.attrs?.src);
    case 'callout': return `:::note[${asideTitle(value.attrs?.title)}]\n${tiptapChildren(value).map(render).join('\n\n')}\n:::`;
    case 'steps': return tiptapChildren(value).map((item, index) => `${index + 1}. ${text(item)}`).join('\n');
    case 'tabs': return tiptapChildren(value).map((item) => {
      const label = typeof item.attrs?.label === 'string' ? item.attrs.label : 'Tab';
      return `${renderHeadingMarkdown({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: label }] })}\n\n${text(item)}`;
    }).join('\n\n');
    case 'tab': return text(value);
    case 'table': return renderPublicTable(value);
    case 'tableRow':
    case 'tableHeader':
    case 'tableCell': return renderPublicTable(value);
    default: throw new Error(`Unsupported Tiptap node: ${value.type}`);
  }
}

export function renderDocumentContent(content: unknown): string {
  return render(content);
}
