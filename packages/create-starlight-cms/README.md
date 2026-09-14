# create-starlight-cms

Creates a self-hosted Astro Starlight documentation CMS for Cloudflare Workers.

```sh
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

Use `.` to create a project in the current empty directory. The CLI never installs dependencies, initializes Git, deploys, or accesses a Cloudflare account.

The normalized project name also becomes the generated `wrangler.jsonc` Worker name. `DB` and `MEDIA` are binding-only definitions, so Cloudflare provisions the D1 database and R2 bucket on the first deployment.

The generated project is an independent copy of the CMS template. To review an upgrade later, run:

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

The first command only shows the three-way update plan. `--apply` updates files that are unchanged from the recorded template version. Conflicting files are never overwritten. Run `npm install` afterwards when the plan reports dependency changes.

Requires Node.js 22.19 or later. See the generated project's README for Cloudflare setup, including its one-time custom domain, R2 public URL, Access, and Deploy Hook configuration.
