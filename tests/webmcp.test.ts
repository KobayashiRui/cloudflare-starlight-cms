import { describe, expect, it, vi } from 'vitest';
import type { WebMCP } from 'webmcp-types';
import { getSchema } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { documentEditTransaction, documentTextBlocks, loadDocumentState, registerAdminTools, type AdminToolActions } from '../src/admin/webmcp';
import { renderPreviewContent } from '../src/starlight/preview-render';
import { renderDocumentContent } from '../src/starlight/render';
import { resolveContentMedia } from '../src/media/urls';

const schema = getSchema([StarterKit]);
const original = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Setup' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Install', marks: [{ type: 'bold' }] }, { type: 'text', text: ' the package.' }] },
] };
const initial = () => EditorState.create({ schema, doc: schema.nodeFromJSON(original), plugins: [history()] });

describe('WebMCP editing through ProseMirror transactions', () => {
  it('returns real positions and preserves rich content through text edits and Undo', () => {
    let state = initial();
    const blocks = documentTextBlocks(state);
    expect(blocks.map((block) => block.text)).toEqual(['Setup', 'Install the package.']);
    const start = blocks[1]!.from;
    state = state.apply(documentEditTransaction(state, { replacements: [
      { from: start, to: start + 7, expectedText: 'Install', text: 'Add' },
      { from: start + 12, to: start + 19, expectedText: 'package', text: 'dependency' },
    ] }));
    expect(state.doc.lastChild?.textContent).toBe('Add the dependency.');
    expect(state.doc.lastChild?.firstChild?.marks[0]?.type.name).toBe('bold');
    expect(state.doc.firstChild?.toJSON()).toEqual(schema.nodeFromJSON(original).firstChild?.toJSON());
    expect(undo(state, (tr) => { state = state.apply(tr); })).toBe(true);
    expect(state.doc.toJSON()).toEqual(initial().doc.toJSON());
  });
  it('rejects stale text, overlapping ranges, cross-block ranges and invalid JSON without changing state', () => {
    const state = initial();
    for (const replacements of [
      [{ from: 1, to: 6, expectedText: 'Wrong', text: 'New' }],
      [{ from: 1, to: 6, expectedText: 'Setup', text: 'New' }, { from: 2, to: 4, expectedText: 'et', text: 'x' }],
      [{ from: 1, to: 10, expectedText: state.doc.textBetween(1, 10, '\n'), text: 'New' }],
      [{ from: 999, to: 1000, expectedText: '', text: 'New' }],
    ]) expect(() => documentEditTransaction(state, { replacements })).toThrow();
    for (const contentJson of [
      { type: 'doc', content: [{ type: 'script', text: 'bad' }] },
      { type: 'doc', content: [{ type: 'text', text: 'bad' }] },
      { type: 'doc', content: [{ type: 'paragraph', attrs: { unknown: 'lost data' } }] },
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:bad' } }] }] }] },
    ]) expect(() => documentEditTransaction(state, { contentJson })).toThrow();
    expect(state.doc.toJSON()).toEqual(initial().doc.toJSON());
  });
  it('accepts complete Tiptap JSON as one undoable edit', () => {
    let state = initial();
    const updated = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Revised' }] }] };
    state = state.apply(documentEditTransaction(state, { contentJson: updated }));
    expect(state.doc.textContent).toBe('Revised');
    undo(state, (tr) => { state = state.apply(tr); });
    expect(state.doc.toJSON()).toEqual(initial().doc.toJSON());
  });
  it('starts a separate Undo history when another page or language is loaded', () => {
    let state = initial();
    state = state.apply(documentEditTransaction(state, { replacements: [{ from: 1, to: 6, expectedText: 'Setup', text: 'First page edit' }] }));
    const second = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second page' }] }] };
    state = loadDocumentState(state, second);
    expect(undo(state)).toBe(false);
    state = state.apply(documentEditTransaction(state, { replacements: [{ from: 1, to: 12, expectedText: 'Second page', text: 'Second page edit' }] }));
    expect(undo(state, (tr) => { state = state.apply(tr); })).toBe(true);
    expect(state.doc.textContent).toBe('Second page');
    expect(undo(state)).toBe(false);
  });
  it('retains a registered image and its alt text through AI edits, Preview and public rendering', () => {
    const imageSchema = getSchema([StarterKit, Image]);
    const objectKey = 'media/e74b5ce7-6e22-4a2e-a164-9b30e6df66b8.png';
    const src = `/admin/api/media/object/${objectKey}`;
    let state = EditorState.create({ schema: imageSchema });
    state = state.apply(documentEditTransaction(state, { contentJson: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Old explanation' }] },
      { type: 'image', attrs: { src, alt: 'Blue, green and orange panels' } },
    ] } }));
    const block = documentTextBlocks(state)[0]!;
    state = state.apply(documentEditTransaction(state, { replacements: [{ from: block.from, to: block.to, expectedText: block.text, text: 'Revised explanation' }] }));
    expect(state.doc.lastChild?.attrs).toMatchObject({ src, alt: 'Blue, green and orange panels' });
    expect(renderPreviewContent(state.doc.toJSON())).toContain(`<img src="${src}" alt="Blue, green and orange panels">`);
    const publicContent = resolveContentMedia(state.doc.toJSON(), new Set([objectKey]), 'public');
    expect(renderDocumentContent(publicContent)).toContain(`![Blue, green and orange panels](/_cms-media/${objectKey.slice('media/'.length)})`);
  });
});

const actions = (): AdminToolActions => ({
  workspace: vi.fn(() => ({ locale: 'en' })), listDocuments: vi.fn(async () => []),
  readDocument: vi.fn(async () => ({ source: 'editor' })), openDocument: vi.fn(async () => ({})),
  setLocale: vi.fn(async () => ({})), newDocument: vi.fn(async () => ({})),
  createTranslation: vi.fn(async () => ({})), editDocument: vi.fn(() => ({})),
  saveDraft: vi.fn(async () => ({})), preview: vi.fn(async () => ({})), listMedia: vi.fn(async () => []),
});
async function registered(getActions: () => AdminToolActions) {
  const definitions = new Map<string, WebMCP.ModelContextTool>();
  const controller = new AbortController();
  const context: Pick<WebMCP.ModelContext, 'registerTool'> = {
    registerTool: async (tool: WebMCP.ModelContextTool, options?: WebMCP.ModelContextRegisterToolOptions) => {
      definitions.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => definitions.delete(tool.name));
    },
  };
  await registerAdminTools(context, getActions, controller.signal);
  return { definitions, controller, call: (name: string, input = {}) => definitions.get(`cms_${name}`)!.execute(input, { signal: new AbortController().signal }) };
}

describe('native WebMCP tool registration', () => {
  it('registers workspace-wide tools with input schemas and removes them on unmount', async () => {
    let host = actions();
    const { definitions, controller, call } = await registered(() => host);
    expect([...definitions.keys()]).toContain('cms_list_documents');
    expect([...definitions.keys()]).toContain('cms_set_locale');
    expect(definitions.get('cms_edit_document')?.inputSchema).toMatchObject({ type: 'object' });
    expect(definitions.get('cms_read_document')?.annotations?.readOnlyHint).toBe(true);
    host = actions();
    await call('get_workspace');
    expect(host.workspace).toHaveBeenCalledOnce();
    controller.abort();
    expect(definitions.size).toBe(0);
  });
  it('validates language, target and edit input before calling Admin', async () => {
    const host = actions();
    const { call } = await registered(() => host);
    expect(await call('set_locale', { locale: 'not-supported' })).toMatchObject({ isError: true });
    expect(host.setLocale).not.toHaveBeenCalled();
    expect(await call('edit_document', { documentId: '', locale: 'en', editToken: '1', title: 'New page' })).not.toHaveProperty('isError');
    expect(host.editDocument).toHaveBeenCalledOnce();
    expect(await call('edit_document', { documentId: '', locale: 'en', editToken: '1', contentJson: original, replacements: [] })).toMatchObject({ isError: true });
    expect(host.editDocument).toHaveBeenCalledOnce();
  });
  it('returns meaningful failure results and rejects simultaneous operations', async () => {
    const host = actions();
    let finish: () => void = () => {};
    host.openDocument = () => new Promise<void>((resolve) => { finish = resolve; });
    host.saveDraft = async () => { throw new Error('Version conflict'); };
    const { call } = await registered(() => host);
    const target = { documentId: 'e74b5ce7-6e22-4a2e-a164-9b30e6df66b8', locale: 'en' };
    const pending = call('open_document', target);
    expect(await call('set_locale', { locale: 'ja' })).toMatchObject({ isError: true });
    finish(); await pending;
    expect(await call('save_draft', { ...target, editToken: '1' })).toEqual({ isError: true, content: [{ type: 'text', text: 'Version conflict' }] });
  });
});
