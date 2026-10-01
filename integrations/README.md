# Add Olinda to your website

Public script URL: **https://olinda.rafistacks.dev/widget.js**

No AI API keys, Supabase keys, staff credentials or extra browser authentication setup are needed. Choose one installation method per website.

## 1. WordPress plugin — easiest installation

1. Download `wordpress/olinda-chatbot.zip`.
2. In WordPress, open **Plugins → Add New Plugin → Upload Plugin**.
3. Upload the ZIP, choose **Install Now**, then **Activate**.
4. Visit **Settings → Olinda Chatbot** to change the name/college, choose whether chat opens automatically, or set an optional privacy-notice URL.
5. Open a public website page and test the chatbot.

The plugin adds the widget on all public pages by default. To remove it, deactivate the plugin, or turn off “Show chatbot” in its settings. It requires WordPress 6.3+, PHP 7.4+, a theme with `wp_footer()`, and permission to upload plugins. No plugin has been uploaded or published by Codex. Live WordPress verification remains pending.

The implementation uses WordPress's [script enqueue API](https://developer.wordpress.org/reference/functions/wp_enqueue_script/) and [script tag filter](https://developer.wordpress.org/reference/hooks/script_loader_tag/).

## 2. One script for WordPress, HTML and other websites

Copy this into your website's HTML, preferably immediately before `</body>`:

```html
<script defer
  src="https://olinda.rafistacks.dev/widget.js"
  data-backend="https://olinda-ai-backend-chatbot.onrender.com"
  data-name="Olinda"
  data-college="Hobart College"
  data-auto-open="false">
</script>
```

In WordPress, use a trusted footer-script tool/theme facility, or a Custom HTML block if your account/site allows scripts. Some editors sanitize scripts; use the plugin above if that happens. Use either the plugin or the manual script, not both.

For plain HTML, see the complete `examples/embed.html`. Set `data-auto-open="true"` if you want the panel open on page load. Add `data-privacy-url="https://YOUR_APPROVED_NOTICE"` only after replacing the placeholder with the real HTTPS notice URL.

## 3. React

Use the same script in the application's main HTML template, outside React's component tree:

- **Vite React:** add it to the root `index.html`, before `</body>`.
- **Existing Create React App:** add it to `public/index.html`, before `</body>`.

The widget creates its own interface; you do not need an npm package, component, hook or additional stylesheet. Keeping this script in the page template loads it once, independently of React component mounting and navigation.

For Next.js App Router, add this to the root layout alongside your page children:

```jsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          id="olinda-chatbot"
          src="https://olinda.rafistacks.dev/widget.js"
          strategy="afterInteractive"
          data-backend="https://olinda-ai-backend-chatbot.onrender.com"
          data-name="Olinda"
          data-college="Hobart College"
          data-auto-open="false"
        />
      </body>
    </html>
  );
}
```

See the official [Next.js Script documentation](https://nextjs.org/docs/app/api-reference/components/script). The snippet is prepared for integration; it has not been tested inside your particular React/Next.js app.

## 4. Node.js / Express / server-rendered applications

The widget runs in the visitor's browser, not inside Node.js. Add the same HTML script to your EJS/Pug/Handlebars layout or HTML response, before the closing body tag.

A standalone example requiring no npm packages is supplied:

```text
node integrations/examples/node-server.mjs
```

Then open `http://127.0.0.1:3000`. Backend origin approval is still required for that localhost address. Avoid opening `embed.html` directly as a `file://` page: browser module/origin restrictions can prevent chat from working.

## 5. Approve the website domain once

An embed can display on many frameworks, but your backend deliberately accepts chat requests only from approved website origins. Current configured origins:

```text
https://hobartcollege.education.tas.edu.au,https://olinda.rafistacks.dev,https://portal-olinda.rafistacks.dev
```

For another website, append its exact origin to **chatbot Render service → Environment → FRONTEND_ORIGINS**, then apply the approved restart/deployment. Include `https://` and the hostname, without a trailing slash or page path. Keep existing entries. Approve `www` and non-`www` separately if both are used; localhost ports are separate origins too. Installing the plugin does not automatically change backend permissions.

Do not use a wildcard API origin just to install the widget. Public widget assets can load cross-origin; the chat API uses its separate origin allowlist, minute/day limits and existing logs. All sites using this backend share its 200/day allowance.

If a website uses Content Security Policy, its administrator must permit:

| Resource | Required host |
| --- | --- |
| Scripts, widget styles and images | `https://olinda.rafistacks.dev` |
| API connections | `https://olinda-ai-backend-chatbot.onrender.com` |

Test the launcher, one answer, refresh recovery and new-conversation reset. If the launcher is missing, inspect failed script/module/style requests and any cache/optimization tools. If the launcher appears but cannot answer, check backend origin approval and backend/provider/database availability.

This integration does not require new backend code or database changes. The latest session-storage frontend fix must be deployed on the widget host to retain messages across refreshes.
