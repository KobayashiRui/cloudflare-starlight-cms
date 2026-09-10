export function adminHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>Docs CMS</title>
    <link rel="stylesheet" href="/admin/app.css">
  </head>
  <body>
    <div id="admin-root"></div>
    <script type="module" src="/admin/app.js"></script>
  </body>
</html>`;
}
