import { z } from 'zod';

const node = z.object({ type: z.string(), text: z.string().optional(), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(z.unknown()).optional() }).passthrough();
type Node = z.infer<typeof node>;

function children(value: Node): Node[] { return (value.content ?? []).map((item) => node.parse(item)); }
function decorateText(value: Node, output: string): string {
  const marks = Array.isArray(value.marks) ? value.marks : [];
  for (const mark of marks) {
    if (!mark || typeof mark !== 'object' || !('type' in mark)) continue;
    const typed = mark as { type: unknown; attrs?: Record<string, unknown> };
    if (typed.type === 'bold') output = `**${output}**`;
    if (typed.type === 'italic') output = `*${output}*`;
    if (typed.type === 'strike') output = `~~${output}~~`;
    if (typed.type === 'code') output = `\`${output}\``;
    if (typed.type === 'link') output = `[${output}](${url(typed.attrs?.href)})`;
  }
  return output;
}
function text(value: Node): string { return decorateText(value, children(value).map(render).join('')); }
function asideTitle(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\]\r\n]/g, ' ').trim() : 'Note';
}
function url(value: unknown): string {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value) && !value.startsWith('/')) throw new Error('Unsafe media or link URL');
  if (value.startsWith('/admin/api/media/object/')) throw new Error('Published media requires MEDIA_PUBLIC_URL');
  return value.replace(/["<>]/g, '');
}

export function render(nodeValue: unknown): string {
  const value = node.parse(nodeValue);
  switch (value.type) {
    case 'text': return decorateText(value, value.text ?? '');
    case 'doc': return `${children(value).map(render).join('\n\n')}\n`;
    case 'paragraph': return text(value);
    case 'heading': return `${'#'.repeat(Number(value.attrs?.level ?? 2))} ${text(value)}`;
    case 'bulletList': return children(value).map((item) => `- ${text(item)}`).join('\n');
    case 'orderedList': return children(value).map((item, index) => `${index + 1}. ${text(item)}`).join('\n');
    case 'taskList': return children(value).map((item) => `- [${item.attrs?.checked === true ? 'x' : ' '}] ${text(item)}`).join('\n');
    case 'taskItem': return text(value);
    case 'listItem': return text(value);
    case 'blockquote': return text(value).split('\n').map((line) => `> ${line}`).join('\n');
    case 'codeBlock': return `\`\`\`${typeof value.attrs?.language === 'string' ? value.attrs.language : ''}\n${text(value)}\n\`\`\``;
    case 'hardBreak': return '  \n';
    case 'horizontalRule': return '---';
    case 'image': return `![${typeof value.attrs?.alt === 'string' ? value.attrs.alt : ''}](${url(value.attrs?.src)})`;
    case 'video': return `<video controls src="${url(value.attrs?.src)}"></video>`;
    case 'callout': return `:::note[${asideTitle(value.attrs?.title)}]\n${children(value).map(render).join('\n\n')}\n:::`;
    case 'steps': return children(value).map((item, index) => `${index + 1}. ${text(item)}`).join('\n');
    case 'tabs': return children(value).map((item) => `#### ${typeof item.attrs?.label === 'string' ? item.attrs.label : 'Tab'}\n\n${text(item)}`).join('\n\n');
    case 'tab': return text(value);
    case 'table': {
      const rows = children(value);
      return rows.map((row, index) => {
        const cells = children(row);
        const markdown = `| ${cells.map(text).join(' | ')} |`;
        return index === 0 ? `${markdown}\n| ${cells.map(() => '---').join(' | ')} |` : markdown;
      }).join('\n');
    }
    case 'tableRow': return `| ${children(value).map(text).join(' | ')} |`;
    case 'tableHeader':
    case 'tableCell': return text(value);
    default: throw new Error(`Unsupported Tiptap node: ${value.type}`);
  }
}

export function renderDocumentContent(content: unknown): string {
  return render(content);
}
