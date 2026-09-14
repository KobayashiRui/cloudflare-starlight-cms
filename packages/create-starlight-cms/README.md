<p align="center">
  <img src="https://raw.githubusercontent.com/KobayashiRui/cloudflare-starlight-cms/main/src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="280">
</p>

# create-starlight-cms

Create a Cloudflare-native CMS for Astro Starlight.

```sh
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

Docs run at `http://127.0.0.1:4321`; Admin runs at `http://127.0.0.1:8787/admin/`. Local development needs no Cloudflare account.

Use `.` to create a project in the current empty directory. The CLI never installs dependencies, initializes Git, deploys, or accesses a Cloudflare account.

To review an upgrade later:

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

The first command only shows the update plan. `--apply` updates files unchanged from the recorded template and stops on conflicts. Run `npm install` afterwards when dependencies changed.

Requires Node.js 22.19 or later. See [Cloudflare Starlight CMS](https://github.com/KobayashiRui/cloudflare-starlight-cms) for deployment, configuration, and troubleshooting guides.
