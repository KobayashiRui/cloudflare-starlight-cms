import { documentUrl, parseTiptapNode, tiptapChildren, type TiptapNode } from './tiptap.ts';
import GithubSlugger from 'github-slugger';

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

function text(value: TiptapNode): string {
  let output = escapeHtml(value.text ?? '');
  const marks = Array.isArray(value.marks) ? value.marks : [];
  for (const mark of marks) {
    if (!mark || typeof mark !== 'object' || !('type' in mark)) continue;
    const typed = mark as { type: unknown; attrs?: Record<string, unknown> };
    switch (typed.type) {
      case 'bold': output = `<strong>${output}</strong>`; break;
      case 'italic': output = `<em>${output}</em>`; break;
      case 'strike': output = `<s>${output}</s>`; break;
      case 'code': output = `<code>${output}</code>`; break;
      case 'link': output = `<a href="${escapeHtml(documentUrl(typed.attrs?.href))}">${output}</a>`; break;
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

function headingText(value: TiptapNode): string {
  if (value.type === 'text') return value.text ?? '';
  if (value.type === 'hardBreak') return ' ';
  return tiptapChildren(value).map(headingText).join('');
}

function createRenderer() {
  const headings: PreviewHeading[] = [];
  const slugger = new GithubSlugger();

  function inline(value: TiptapNode): string {
    return tiptapChildren(value).map(renderNode).join('');
  }

  function renderListItem(value: TiptapNode): string {
    return `<li>${inline(value)}</li>`;
  }

  function renderTableRow(value: TiptapNode, header: boolean): string {
    const cell = header ? 'th' : 'td';
    return `<tr>${tiptapChildren(value).map((item) => `<${cell}>${inline(item)}</${cell}>`).join('')}</tr>`;
  }

  function renderTabs(value: TiptapNode): string {
    const tabs = tiptapChildren(value);
    if (tabs.length === 0) return '';
    const labels = tabs.map((tab) => typeof tab.attrs?.label === 'string' ? tab.attrs.label : 'Tab');
    return `<starlight-tabs><div class="tablist-wrapper not-content"><ul role="tablist">${labels.map((label, index) => `<li role="presentation" class="tab"><a role="tab" href="#cms-preview-tab-${index}" aria-selected="${index === 0}"${index === 0 ? '' : ' tabindex="-1"'}>${escapeHtml(label)}</a></li>`).join('')}</ul></div>${tabs.map((tab, index) => `<section id="cms-preview-tab-${index}" role="tabpanel"${index === 0 ? '' : ' hidden'}>${inline(tab)}</section>`).join('')}</starlight-tabs>`;
  }

  function renderNode(value: TiptapNode): string {
    switch (value.type) {
      case 'text': return text(value);
      case 'doc': return tiptapChildren(value).map(renderNode).join('');
      case 'paragraph': return `<p>${inline(value)}</p>`;
      case 'heading': {
        const level = Number(value.attrs?.level ?? 2);
        if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('Invalid heading level');
        const label = headingText(value).replace(/\s+/g, ' ').trim() || 'Section';
        const id = slugger.slug(label);
        headings.push({ id, level, text: label });
        return `<h${level} id="${escapeHtml(id)}">${inline(value)}</h${level}>`;
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
      case 'image': return `<img src="${escapeHtml(documentUrl(value.attrs?.src))}" alt="${escapeHtml(typeof value.attrs?.alt === 'string' ? value.attrs.alt : '')}">`;
      case 'video': return `<video controls src="${escapeHtml(documentUrl(value.attrs?.src))}"></video>`;
      case 'callout': {
        const title = asideTitle(value.attrs?.title);
        return `<aside aria-label="${escapeHtml(title)}" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true">${escapeHtml(title)}</p><div class="starlight-aside__content">${inline(value)}</div></aside>`;
      }
      case 'steps': return `<ol class="sl-steps">${tiptapChildren(value).map(renderListItem).join('')}</ol>`;
      case 'tabs': return renderTabs(value);
      case 'tab': return inline(value);
      case 'table': {
        const rows = tiptapChildren(value);
        return `<table><tbody>${rows.map((row, index) => renderTableRow(row, index === 0)).join('')}</tbody></table>`;
      }
      case 'tableRow': return renderTableRow(value, false);
      case 'tableHeader':
      case 'tableCell': return inline(value);
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
