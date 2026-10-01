=== Olinda Chatbot ===
Requires at least: 6.3
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Adds the hosted Olinda chatbot to public pages, without frontend API keys.

== Installation ==
1. Upload olinda-chatbot.zip via Plugins > Add New Plugin > Upload Plugin.
2. Install and activate it.
3. Open Settings > Olinda Chatbot to change labels or display preferences.
4. Confirm your exact website origin is permitted by the chat backend.

Use either this plugin or a manual script embed, not both.

== External services ==
The plugin loads JavaScript, styles and images from https://olinda.rafistacks.dev.
Chat requests go to https://olinda-ai-backend-chatbot.onrender.com and are handled
by the existing Olinda backend, including its AI providers and database logging.
Recent conversations are stored in browser sessionStorage for refresh recovery.
Use your college-approved privacy notice for these services and data handling.
No AI provider key, privileged database key, or staff password belongs in WordPress.

== Limitations ==
Requires a theme that calls wp_footer, JavaScript-capable browsers, permitted
script/style/image/backend URLs in any site Content Security Policy, and a host
that permits uploading plugins. Review script optimization plugins if loading fails.
This plugin has not been installed/tested against a live WordPress instance yet.
