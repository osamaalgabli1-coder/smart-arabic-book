<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Notification relay credentials are AES-GCM encrypted in owner-scoped Cloud rows and accessed only through authenticated server functions; never store API keys in local app state or exports.
- Relay uses POST JSON with per-recipient operation metadata and a configurable Authorization Bearer or X-API-Key header; acceptance by the relay is not proof of recipient delivery.
