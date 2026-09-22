# Self-host vs Cueora Cloud

Same codebase. Mode is `CUEORA_MODE=selfhost|cloud`.

| | Self-host | Cloud (pay via Dodo) |
| --- | --- | --- |
| License | Apache-2.0 | Hosted ToS |
| Auth | Your Better Auth + Email | Same |
| Limits | None in code | Plan from Dodo webhook |
| Payments | Off | Dodo Checkout + webhooks |

## Cloud setup

1. Create products in Dodo: Pro monthly / yearly.
2. Secrets on the API worker: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, product IDs.
3. `CUEORA_MODE=cloud`
4. Webhook: `https://api.cueora.xyz/webhooks/dodo`

Self-host: leave `CUEORA_MODE=selfhost`. Billing routes 404. No Dodo keys required.
