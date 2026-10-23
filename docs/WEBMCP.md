# AI editing with WebMCP

Open `/admin/` in a browser/agent that supports native WebMCP, sign in through Cloudflare Access, and keep the Admin tab open. The AI can discover the page's `cms_*` tools and review or edit the whole documentation set. It shares the visible Tiptap editor with you.

Example requests:

- “List all pages and find which ones are missing Japanese translations.”
- “Check the English pages for inconsistent terminology, then fix those passages.”
- “Open Getting started in Japanese, improve the explanation, save the draft and show its Preview.”

## Supported operations

| Tool | Purpose |
| --- | --- |
| `cms_get_workspace` | Supported languages, selected page, live editor, schema and editing token |
| `cms_list_documents` | Localized page/folder tree, paths, translation/publication states and browser drafts; optional title/path query |
| `cms_read_document` | Read any page in an exact language, including available browser edits |
| `cms_open_document` | Select the page and language in the shared editor |
| `cms_set_locale` | Switch the selected page's document language |
| `cms_new_document` | Start a page in the default language, optionally within a folder |
| `cms_create_translation` | Copy a saved source language into a new translation and open it |
| `cms_edit_document` | Change title, description, shared navigation fields, full Tiptap JSON or text ranges |
| `cms_save_draft` | Save through the existing version-checked API |
| `cms_get_preview` | Saved-draft Preview URL and a separate public URL when the page has a publication |
| `cms_list_media` | Existing uploaded media and their protected Admin URLs |

The AI can iterate over pages and languages for a site-wide review. Reading another page does not select it; editing requires opening it first. Lists report missing translations explicitly instead of silently substituting another language. Admin display language and document language are separate.

## Tool discovery and visual review

The Admin registers tools with native `document.modelContext.registerTool`. The browser/agent discovers them on the open Admin tab and invokes their callbacks. Each callback validates its input and reads the current React editor state, then uses Tiptap or the existing same-origin Admin API with the user's Access session and normal CSRF header. No separate MCP endpoint, bridge server or API credentials are required. Reloading or navigating away invalidates browser tool handles; discover the current page's tools again.

WebMCP returns content and URLs, not a screenshot or image pixels. To review layout and images, the AI needs browser visual capabilities as well: save the draft, call `cms_get_preview`, open its `url` in the browser, check that the article images have loaded, and inspect the rendered page/screenshot. Managed images use the protected Admin media proxy in Preview and `/_cms-media/` Static Assets in the public build. Existing uploaded images can be selected with `cms_list_media` and inserted/updated through Tiptap JSON; new files use the existing upload UI and the browser's file chooser.

For published pages, `publicPage.url` opens the public site separately. `publicPage.source` is `last-deployed-site` and `deploymentStatus` is `unknown`: an accepted Publish/build request does not prove that deployment completed. Review the public URL after the expected build is deployed. Preview shares the site's Starlight shell and media, but does not rerun build-time Shiki or arbitrary MDX/remark transforms, so use the public page for the final deployed result.

## Editing and saving

Read the open page or workspace before editing. Pass its document ID, locale and `editToken` to `cms_edit_document` or `cms_save_draft`. New unsaved pages have an empty document ID and are read through `cms_get_workspace`. Human edits, page/language changes and saves invalidate previous tokens; read again after each operation.

Text ranges use the ProseMirror positions returned in `textBlocks`. Each replacement supplies `from`, `to`, `expectedText` and `text`, stays within one text block, and refers to the same read. Full replacements use Tiptap JSON. Both are validated before changes are applied and content edits use the editor's normal Undo.

Page/language loads start a fresh Undo history, so Undo cannot restore content from another article. Saving the same editor preserves its content-edit history.

Existing unsaved pages remain in this browser when switching pages or languages. Save a changed new page before leaving it. Resolve browser/server conflicts in Admin and finish image uploads before editing further. Translation creation copies the saved source, so save source-language browser edits first. Saved Preview does not include unsaved edits.

Use the existing Publish button to publish saved changes. Shared URL, parent and order fields retain their existing navigation/rebuild behavior when saved. Folder creation/renaming, uploads, history, publication and deletion remain available through the Admin UI.

## Browser support

WebMCP is an evolving browser API. Use a browser **and AI agent** that support native `document.modelContext.registerTool`. Chrome's local testing flag is `chrome://flags/#enable-webmcp-testing`; production Chrome usage may require its origin trial. Check the current [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp) and [implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md).

If the AI cannot find `cms_*` tools, check the active Admin tab, native browser/agent support and the `tools` Permissions Policy. Ordinary editing continues to work when WebMCP is unavailable or registration is denied. Public Docs and Preview do not register editing tools. Browser support does not replace Access protection; production Access behavior must be verified separately.

Implementation uses the native browser API with the MIT-licensed [official `webmcp-types`](https://github.com/webmachinelearning/webmcp-types) as a pinned development-only dependency. No AI API key or model runtime is added to the CMS.
