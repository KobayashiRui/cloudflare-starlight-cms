import { z } from 'zod';

export const tableStyles = ['standard', 'striped', 'minimal'] as const;
export const tableAttributes = z.looseObject({
  tableStyle: z.enum(tableStyles).default('standard'),
});
export const cellAttributes = z.looseObject({
  colspan: z.number().int().min(1).max(1000).default(1),
  rowspan: z.number().int().min(1).max(1000).default(1),
  colwidth: z.array(z.number().int().min(0).max(10000)).nullable().default(null),
  align: z.enum(['left', 'center', 'right']).nullable().default(null),
}).superRefine((attrs, context) => {
  if (attrs.colwidth && attrs.colwidth.length !== attrs.colspan) context.addIssue({ code: 'custom', message: 'Column widths must match colspan' });
});

/** Validate only supported table attributes; arbitrary CSS never becomes output. */
export function assertTableAttributes(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const node = z.looseObject({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(z.unknown()).optional() }).parse(value);
  if (node.type === 'table') tableAttributes.parse(node.attrs ?? {});
  if (node.type === 'tableCell' || node.type === 'tableHeader') cellAttributes.parse(node.attrs ?? {});
  for (const child of node.content ?? []) assertTableAttributes(child);
}
