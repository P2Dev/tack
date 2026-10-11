# Tack recovery

| Evidence | Response |
| --- | --- |
| Tools missing/server failed startup | Check configured Node and packaged entry paths, Node 24.9+, explicit environment/private-file settings, and server connection state. Use the package's `--check` outside stdio mode. Never read or display the key to diagnose a connection. |
| Client says the tool requires approval | The client policy blocked the call before Tack received it. Do not report the change as completed, retry it with different tools, or change the policy silently. Explain which requested operation needs client approval; unattended clients need an operator-selected tool policy as well as the API capability. |
| `401 invalid_credentials` | Expired/revoked key or disabled owner. Ask the operator to replace the credential through Tack's API keys page; retry only after credentials change. |
| `403 insufficient_scope` | The current key cannot perform that action. Describe the missing capability; do not broaden scopes or switch credentials silently. |
| `404 not_found` | Card/board may be absent or outside scope. Check the permitted boards and supplied key. Do not assume it was deleted or reveal inaccessible metadata. |
| `409 revision_conflict` | Reread the card. Preserve others' edits; use a fresh revision and new operation ID only after reconsidering the requested change. If intent now conflicts, clarify. |
| `409 idempotency_conflict` | That operation ID was used with different arguments. Recover the original intended operation; do not generate another ID just to bypass the error. |
| `429 rate_limited` | Wait the advertised retry delay (HTTP-date values are converted to seconds); retry the same operation and arguments once when appropriate. |
| `connection_unconfirmed`, malformed/oversized response, or HTTP 5xx | Connectivity/response uncertainty. A write may have committed. Retry exact arguments with the same ID within 24 hours; after the window, inspect the card before retrying. Keep retries bounded and report unresolved uncertainty. |

Use a user-owned card key containing `read` and only the requested additional scopes. A `projects:sync` key belongs to the separate Cloud integration and deliberately cannot pass `tack_me`. API access is not browser sign-in. The adapter pins the Tack origin, rejects redirects, and uses HTTPS outside loopback; private CA trust must be set before Node starts.

Skill discovery and MCP connection are separate. A visible skill does not prove tool connectivity; successful SDK tool calls do not prove the particular Codex desktop client has been configured.
