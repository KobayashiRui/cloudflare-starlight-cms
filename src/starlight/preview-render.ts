import { documentLinkUrl, documentMediaUrl, parseTiptapNode, tiptapChildren, type TiptapNode, youtubeEmbedHtml } from './tiptap.ts';
import { headingText } from '../documents/links.ts';
import GithubSlugger from 'github-slugger';
import { tableAttributes, cellAttributes } from '../documents/tables';

export interface PreviewHeading {
  id: string;
  level: number;
  text: string;
}

export interface PreviewDocument {
  html: string;
  headings: PreviewHeading[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function text(value: TiptapNode, literalMarkdown = false): string {
  // Entities preserve literal Markdown punctuation when embedded in a heading.
  let output = literalMarkdown
    ? Array.from(value.text ?? '', (character) => /[\\`*_[\]#!|~]/.test(character) ? `&#${character.charCodeAt(0)};` : escapeHtml(character)).join('')
    : escapeHtml(value.text ?? '');
  const marks = Array.isArray(value.marks) ? value.marks : [];
  for (const mark of marks) {
    if (!mark || typeof mark !== 'object' || !('type' in mark)) continue;
    const typed = mark as { type: unknown; attrs?: Record<string, unknown> };
    switch (typed.type) {
      case 'bold': output = `<strong>${output}</strong>`; break;
      case 'italic': output = `<em>${output}</em>`; break;
      case 'strike': output = `<s>${output}</s>`; break;
      case 'code': output = `<code>${output}</code>`; break;
      case 'link': output = `<a href="${escapeHtml(documentLinkUrl(typed.attrs?.href))}">${output}</a>`; break;
      default: throw new Error(`Unsupported Tiptap mark: ${String(typed.type)}`);
    }
  }
  return output;
}

function asideTitle(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\]\r\n]/g, ' ').trim() : 'Note';
}

function codeLanguage(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9+-]+$/i.test(value) ? ` class="language-${escapeHtml(value)}"` : '';
}

function headingContent(value: TiptapNode): string {
  return tiptapChildren(value).map((child) => {
    if (child.type === 'text') return text(child, true);
    if (child.type === 'hardBreak') return '<br> ';
    throw new Error(`Unsupported heading child: ${child.type}`);
  }).join('');
}

/** Keep literal text inside a span so Markdown retains edge spaces and trailing #. */
export function renderHeadingMarkdown(value: TiptapNode): string {
  const level = Number(value.attrs?.level ?? 2);
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Invalid heading level');
  return `${'#'.repeat(level)} <span>${headingContent(value)}</span>`;
}

/** Keep literal Tiptap heading text in Preview as in the public Markdown. */
export function renderHeadingHtml(value: TiptapNode, id?: string): string {
  const level = Number(value.attrs?.level ?? 2);
  if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Invalid heading level');
  return `<h${level}${id === undefined ? '' : ` id="${escapeHtml(id)}"`}>${headingContent(value)}</h${level}>`;
}

function createRenderer(allowAdminMediaProxy = true) {
  const headings: PreviewHeading[] = [];
  const slugger = new GithubSlugger();
  let tableDepth = 0;

  function inline(value: TiptapNode): string {
    return tiptapChildren(value).map(renderNode).join('');
  }

  function renderListItem(value: TiptapNode): string {
    return `<li>${inline(value)}</li>`;
  }

  function renderTableCell(value: TiptapNode): string {
    const tag = value.type === 'tableHeader' ? 'th' : 'td';
    const attrs = cellAttributes.parse(value.attrs ?? {});
    const widths = attrs.colwidth ? ` colwidth="${attrs.colwidth.join(',')}"` : '';
    const align = attrs.align ? ` style="text-align: ${attrs.align}"` : '';
    return `<${tag} colspan="${attrs.colspan}" rowspan="${attrs.rowspan}"${widths}${align}>${inline(value)}</${tag}>`;
  }

  function renderTableRow(value: TiptapNode): string {
    const cells = tiptapChildren(value);
    if (!cells.length || cells.some((cell) => !['tableCell', 'tableHeader'].includes(cell.type))) throw new Error('Invalid table row');
    return `<tr>${cells.map(renderTableCell).join('')}</tr>`;
  }

  function renderTable(value: TiptapNode): string {
    const attrs = tableAttributes.parse(value.attrs ?? {});
    const rows = tiptapChildren(value);
    if (!rows.length || rows.some((row) => row.type !== 'tableRow')) throw new Error('Invalid table');
    const widths = tiptapChildren(rows[0]!).flatMap((cell) => {
      const attrs = cellAttributes.parse(cell.attrs ?? {});
      return attrs.colwidth ?? Array.from({ length: attrs.colspan }, () => null);
    });
    const columns = widths.map((width) => width ? `<col style="width: ${width}px">` : '<col>').join('');
    const fullWidth = widths.every((width) => width !== null && width > 0) ? widths.reduce<number>((sum, width) => sum + (width ?? 0), 0) : null;
    const minWidth = widths.reduce<number>((sum, width) => sum + (width || 25), 0);
    let body: string;
    tableDepth += 1;
    try { body = rows.map(renderTableRow).join(''); } finally { tableDepth -= 1; }
    return `<div class="cms-table-scroll" tabindex="0"><table data-table-style="${attrs.tableStyle}"${fullWidth ? ` style="width: ${fullWidth}px"` : ` style="min-width: ${minWidth}px"`}><colgroup>${columns}</colgroup><tbody>${body}</tbody></table></div>`;
  }

  function renderTabs(value: TiptapNode): string {
    const tabs = tiptapChildren(value);
    if (tabs.length === 0) return '';
    // Public Docs render tab labels as H4 sections. Keep Preview equally visible
    // so every heading link works without a separate tab controller.
    return tabs.map((tab) => {
      const label = typeof tab.attrs?.label === 'string' ? tab.attrs.label : 'Tab';
      return `<h4${tableDepth ? '' : ` id="${escapeHtml(slugger.slug(label))}"`}>${escapeHtml(label)}</h4>${inline(tab)}`;
    }).join('');
  }

  function renderNode(value: TiptapNode): string {
    switch (value.type) {
      case 'text': return text(value);
      case 'doc': return tiptapChildren(value).map(renderNode).join('');
      case 'paragraph': {
        const align = value.attrs?.textAlign;
        const style = ['left', 'center', 'right', 'justify'].includes(String(align)) ? ` style="text-align: ${align}"` : '';
        return `<p${style}>${inline(value)}</p>`;
      }
      case 'heading': {
        const level = Number(value.attrs?.level ?? 2);
        if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Invalid heading level');
        if (tableDepth) return renderHeadingHtml(value);
        const label = headingText(value);
        const id = slugger.slug(label);
        headings.push({ id, level, text: label });
        return renderHeadingHtml(value, id);
      }
      case 'bulletList': return `<ul>${tiptapChildren(value).map(renderListItem).join('')}</ul>`;
      case 'orderedList': return `<ol>${tiptapChildren(value).map(renderListItem).join('')}</ol>`;
      case 'taskList': return `<ul class="contains-task-list">${tiptapChildren(value).map(renderNode).join('')}</ul>`;
      case 'taskItem': return `<li class="task-list-item"><input type="checkbox" disabled${value.attrs?.checked === true ? ' checked' : ''}>${inline(value)}</li>`;
      case 'listItem': return renderListItem(value);
      case 'blockquote': return `<blockquote>${inline(value)}</blockquote>`;
      case 'codeBlock': return `<pre><code${codeLanguage(value.attrs?.language)}>${inline(value)}</code></pre>`;
      case 'hardBreak': return '<br>';
      case 'horizontalRule': return '<hr>';
      case 'image': return `<img src="${escapeHtml(documentMediaUrl(value.attrs?.src, { allowAdminMediaProxy }))}" alt="${escapeHtml(typeof value.attrs?.alt === 'string' ? value.attrs.alt : '')}">`;
      case 'video': return `<video controls src="${escapeHtml(documentMediaUrl(value.attrs?.src, { allowAdminMediaProxy }))}"></video>`;
      case 'youtube': return youtubeEmbedHtml(value.attrs?.src);
      case 'callout': {
        const title = asideTitle(value.attrs?.title);
        return `<aside aria-label="${escapeHtml(title)}" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true">${escapeHtml(title)}</p><div class="starlight-aside__content">${inline(value)}</div></aside>`;
      }
      case 'steps': return `<ol class="sl-steps">${tiptapChildren(value).map(renderListItem).join('')}</ol>`;
      case 'tabs': return renderTabs(value);
      case 'tab': if (!tableDepth) slugger.slug(String(value.attrs?.label ?? 'Tab')); return inline(value);
      case 'table': return renderTable(value);
      case 'tableRow': return renderTableRow(value);
      case 'tableHeader':
      case 'tableCell': return renderTableCell(value);
      default: throw new Error(`Unsupported Tiptap node: ${value.type}`);
    }
  }

  return { headings, render: renderNode };
}

/** Render the supported CMS Tiptap subset into safe HTML inside Starlight's generated shell. */
export function renderPreviewContent(content: unknown): string {
  return renderPreviewDocument(content).html;
}

/** Render the saved document once so heading anchors and the generated TOC always agree. */
export function renderPreviewDocument(content: unknown): PreviewDocument {
  const renderer = createRenderer();
  return { html: renderer.render(parseTiptapNode(content)), headings: renderer.headings };
}

interface TocItem extends PreviewHeading { children: TocItem[]; }

function tocTree(headings: PreviewHeading[], minHeadingLevel: number, maxHeadingLevel: number): TocItem[] {
  const roots: TocItem[] = [];
  const add = (items: TocItem[], item: TocItem): void => {
    const last = items.at(-1);
    if (!last || last.level >= item.level) items.push(item);
    else add(last.children, item);
  };
  for (const heading of headings) {
    if (heading.level >= minHeadingLevel && heading.level <= maxHeadingLevel) add(roots, { ...heading, children: [] });
  }
  return roots;
}

function scopedClass(className: string): string {
  return className ? ` class="${escapeHtml(className)}"` : '';
}

function renderTocItems(items: TocItem[], depth: number, className: string): string {
  return items.map((item) => {
    const children = item.children.length > 0
      ? `<ul${scopedClass(className)} style="--depth: ${depth + 1};">${renderTocItems(item.children, depth + 1, className)}</ul>`
      : '';
    return `<li${scopedClass(className)} style="--depth: ${depth};"><a${scopedClass(className)} href="#${encodeURIComponent(item.id)}" style="--depth: ${depth};"><span${scopedClass(className)} style="--depth: ${depth};">${escapeHtml(item.text)}</span></a>${children}</li>`;
  }).join('');
}

/** Replace Starlight's static `Overview` item while retaining its generated TOC structure and styles. */
export function renderPreviewTocItems(headings: PreviewHeading[], minHeadingLevel: number, maxHeadingLevel: number, className: string): string {
  return renderTocItems(tocTree(headings, minHeadingLevel, maxHeadingLevel), 0, className);
}

/** Public tables retain structure and literal cell content rather than lossy Markdown pipes. */
export function renderPublicTable(value: TiptapNode): string {
  return createRenderer(false).render(value);
}
