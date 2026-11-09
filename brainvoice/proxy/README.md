# BrainVoice proxy

Holds the Anthropic API key so the mobile app never contains a secret. The app talks to
`POST /v1/messages` with a per-device bearer token and the exact Messages API body; the proxy
validates, forwards with `@anthropic-ai/sdk` and returns the response unchanged.

```bash
cd proxy
npm install
ANTHROPIC_API_KEY=sk-ant-… PROXY_TOKENS=$(openssl rand -hex 24) npm start
```

Environment:

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | required |
| `PROXY_TOKENS` | – | comma-separated device tokens (paste one in the app: Settings → AI & language) |
| `ALLOWED_MODELS` | `claude-opus-5,claude-sonnet-5,claude-haiku-4-5` | model allow-list |
| `MAX_TOKENS_CAP` | `4096` | upper bound for `max_tokens` |
| `RATE_LIMIT_PER_MINUTE` | `60` | per token |
| `PORT` | `8787` | |

Deploy behind HTTPS (Fly.io, Render, a VPS with Caddy…). `GET /health` returns `{ ok: true }`.
Rotate a token by changing `PROXY_TOKENS`.
