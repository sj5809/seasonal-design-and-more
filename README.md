# Seasonal Design & More — website

Static site (no build step): `index.html`, `crafts.html`, `img/`.
Business: Seasonal Design and More Unlimited LLC (formerly All Things Craft), 6006 Taylor Mill Rd, Taylor Mill, KY 41015.

## Custom order form → seasonaldesign@outlook.com
The form posts to FormSubmit (free, no backend): `https://formsubmit.co/ajax/seasonaldesign@outlook.com`.

**One-time activation:** the FIRST time anyone submits the form on the live site, FormSubmit emails
seasonaldesign@outlook.com an "Activate form" link. Click it once — no submissions are delivered until then.
Tip: after activating, FormSubmit gives you a random alias string; swap it into ENDPOINT in index.html
so the real email address isn't visible in the page source (cuts spam).

Includes: honeypot spam field, optional photo attachment, reply-to set to the customer's email,
and a fallback message with the email address if sending fails.

## Deploy
- **GitHub Pages:** push this folder to a repo → Settings → Pages → deploy from `main` / root.
- **Vercel:** `vercel` in this folder (framework: Other).
- Domain: SeasonalDesignandMoreLLC.com is currently parked at GoDaddy (lapsed). If they re-register it, point it here.

## Adding crafts
Add a photo to `img/` and a card in `crafts.html` (copy an existing `<article class="card">`; set `data-cat` to
plates / glass / apparel / decor / painted; add a 9th field "contain" for wide shots like plates). Photos: owner (Oct 2026) + old All Things Craft Facebook page.

## To confirm with the owner
- Shop hours and a phone number (not listed anywhere public — add to the Visit section)
- Prices or price ranges, if they want them shown
