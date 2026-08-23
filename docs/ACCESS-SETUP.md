# Turning on the admin panel

Everything is built and deployed-ready. Two values are still missing, and
they can only come from the Cloudflare dashboard: the deploy token for this
project is `zone: read` only.

Until those two values are set, the Worker denies every request to `/admin`
and `/api/admin/*`. That is the intended failure direction — it fails closed,
not open — but nobody can sign in, including you.

## What is already done

- D1 database `bmxc` created (`18788aa1-60db-4026-803c-c556e0b1401e`)
- Schema applied to the **remote** database (`0001_users.sql`)
- Your admin account seeded: `jsnapoli1@gmail.com`, `is_admin = 1`
- CI applies migrations before every deploy

## Step 1 — create the Access application

In the Cloudflare dashboard: **Zero Trust → Access → Applications → Add an
application → Self-hosted**.

| Field | Value |
| --- | --- |
| Application name | `BMXC Admin` |
| Session duration | 24 hours |
| Public hostname | `bmxc.camp`, path `admin` |

Add a **second** hostname entry on the same application:

| Field | Value |
| --- | --- |
| Public hostname | `bmxc.camp`, path `api/admin` |

Both are needed. The first protects the panel; the second protects the API
the panel calls. Guarding only the page would leave the API reachable.

Then add a policy:

| Field | Value |
| --- | --- |
| Policy name | `Camp staff` |
| Action | Allow |
| Include | Emails → `jsnapoli1@gmail.com` |

## Step 2 — collect two values

**Application Audience (AUD) Tag** — on the application's overview page after
you create it. A long hex string.

**Team domain** — `https://<team-name>.cloudflareaccess.com`. Find it under
**Zero Trust → Settings → Custom Pages**, or read it out of the Zero Trust
dashboard URL.

## Step 3 — put them in `wrangler.jsonc`

```jsonc
"vars": {
  "TEAM_DOMAIN": "https://<your-team-name>.cloudflareaccess.com",
  "POLICY_AUD": "<the AUD tag>"
}
```

Neither is a secret. The AUD tag is an identifier and the team domain is
public; both are committed so CI deploys keep them. The security comes from
Access verifying the signature, not from these values being hidden.

## Step 4 — deploy and check

```bash
npm run build && npx wrangler deploy
```

Then verify, in this order:

1. **The public site is unchanged.** Visit `https://bmxc.camp/` and click
   through every page. CLAUDE.md is explicit that this project's bugs are
   invisible to a passing build — look at it, don't just load it.
2. **The panel is protected.** Open `https://bmxc.camp/admin` in a private
   window. You should get the Cloudflare Access login screen, *not* the
   panel.
3. **The API is protected.** Run:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://bmxc.camp/api/admin/users
   ```
   Expect `302` (Access redirect) or `403`. **Anything in the 2xx range is a
   failure — stop and investigate before going further.**
4. **Sign in.** After authenticating you should see "Signed in as Jack ·
   Administrator" and the People table.
5. **Exercise it.** Add a person, toggle each of their four permissions,
   then remove them. Confirm the Remove button does not appear on your own
   row and that your own admin checkbox cannot be unticked.
6. **Check the audit trail.**
   ```bash
   CLOUDFLARE_ACCOUNT_ID=9569781c361a80bd0b96dedbac0aca6d \
     npx wrangler d1 execute bmxc --remote \
     --command "SELECT actor_email, action, detail FROM audit_log ORDER BY id DESC LIMIT 10"
   ```
   You should see `user.create`, `user.update`, and `user.delete` attributed
   to your email.

## Adding someone else later

Two steps, in two places — this is the tradeoff of using Access for identity:

1. **Cloudflare dashboard** — add their email to the `Camp staff` policy.
   This decides whether they can reach the panel at all.
2. **The panel** — add them under People and tick the areas they may edit.
   This decides what they can do once inside.

Someone added to Access but not to the panel sees "you have not been given
access to anything yet" rather than an error. That is deliberate.
