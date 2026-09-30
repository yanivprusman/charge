# גבייה — charge

Ask one person for money for one thing: a Grow payment link (Bit + card), sent
on WhatsApp from your own number. This repo is three skins over `d charge`:

| | Where | How it signs in |
| :-- | :-- | :-- |
| **Phone app** | `mobile/` (Compose, package `com.automatelinux.charge.dev`) | bearer token baked into the APK |
| **Web** | `app/` — the same one screen, in a browser | session cookie, after one sign-in |
| **API** | `app/api/` — `charge`, `charge/cancel`, `charges` | either of the above |

None of them decides anything about money. The daemon owns the Grow call, the
`charges` table and the WhatsApp send; its refusals are shown as it words them.

## Web

Open the dev server (`d getPort --key charge-dev`) in a browser. The first time,
it asks for an access code — the value of `CHARGE_API_TOKEN` in `.env.local` — or
use a link instead of typing it:

```bash
node scripts/make-link.mjs                          # this machine, valid 10 minutes
node scripts/make-link.mjs 60 http://10.7.0.2:3139   # another device on the VPN, valid an hour
```

The session is a cookie holding an HMAC of the token, so the secret is never in
a browser, and rotating the token signs every browser out.

## Rules worth knowing before editing

- **`app/page.tsx` and `app/signin/**` must stay synchronous.** `proxy.ts`
  chooses between them. A page that awaits `cookies()` leaves its script out of
  the HTML, and the client's late fetch of it was cancelled on 7 of 8 cold loads
  (Next 16.3.4 webpack dev, Chrome 144). The numbers are in `proxy.ts`.
- **Every API route calls `authorize()` itself** (`lib/auth.ts`). `proxy.ts`
  only picks a screen; it guards nothing.
- **A cookie-authenticated write must come from the app's own origin.** What is
  protected is a WhatsApp message sent in the owner's name.
- **The form does not validate.** A real mobile number, a positive amount, a
  two-word name — those are the daemon's rules, in one place.
