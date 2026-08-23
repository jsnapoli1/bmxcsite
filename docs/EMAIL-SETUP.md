# Email on bmxc.camp

`bmxc.camp` receives mail through Cloudflare Email Routing and forwards it to
Gmail. The directors' existing mailbox on `bluemountainxccamp.com` (hosted at
iPage) is **not** part of this and was never touched.

## What is live

MX records point at Cloudflare:

```
10 route2.mx.cloudflare.net
24 route1.mx.cloudflare.net
82 route3.mx.cloudflare.net
```

Forwarding rules, all enabled, all to the verified destination
`jsnapoli1@gmail.com`:

| Address | Rule id |
| --- | --- |
| `info@bmxc.camp` | `31dad0fc820941d7b20d7305c929f8a2` |
| `ken@bmxc.camp` | `8d95632d837e49dbb4639964411f427b` |
| `sarah@bmxc.camp` | `811b301d9d5548d3813c8aedb6655b5f` |
| catch-all | (built-in) |

DKIM is published at `cf2024-1._domainkey.bmxc.camp` — Cloudflare added it
when routing was enabled.

## One record still needs fixing

SPF still names Namecheap's forwarding service, which no longer handles this
domain:

```
v=spf1 include:spf.efwd.registrar-servers.com ~all      ← stale
v=spf1 include:_spf.mx.cloudflare.net ~all              ← should be this
```

Inbound forwarding works regardless — SPF describes who may *send* as this
domain. But leaving it stale means the domain vouches for a service that no
longer sends for it, which hurts deliverability if anything ever sends from
`@bmxc.camp`. Fix in the dashboard: **DNS → the `bmxc.camp` TXT record →
replace the content above**. Wrangler cannot edit DNS records, and this
project's deploy token is `zone: read` only.

Consider adding DMARC at the same time, starting permissively:

```
Name:    _dmarc.bmxc.camp
Type:    TXT
Content: v=DMARC1; p=none; rua=mailto:jsnapoli1@gmail.com
```

`p=none` monitors without rejecting anything — the right first step.

## Verifying it works

Send a message from any account to `info@bmxc.camp` and confirm it reaches
`jsnapoli1@gmail.com`. This could not be tested from the development machine:
outbound port 25 is blocked there to every mail server, Google's included,
which is a standard ISP anti-spam measure and says nothing about this
configuration.

Cloudflare reports the zone as `misconfigured/locked` until SPF is corrected.
That status reflects the stale SPF record, not the routing rules.

## The public contact address

The site still shows `directors@bluemountainxccamp.com`. Switching it to
`info@bmxc.camp` is deliberately held until a real test message has been seen
arriving, because that address is what parents use — pointing them at a route
that silently drops mail would be worse than leaving the old address in place.

## Adding an address later

```bash
CLOUDFLARE_ACCOUNT_ID=9569781c361a80bd0b96dedbac0aca6d \
  npx wrangler email routing rules create bmxc.camp \
  --name "<name>" --match-type literal --match-field to \
  --match-value "<name>@bmxc.camp" --action-type forward \
  --action-value <destination>
```

A destination address must be verified before it can receive: Cloudflare
emails it a link that the owner has to click. `jsnapoli1@gmail.com` was
verified on 2026-08-11. Forwarding to Ken's or Sarah's own inboxes would
require each of them to click their own link.
