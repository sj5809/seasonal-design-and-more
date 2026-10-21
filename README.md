# Seasonal Design & More — website

Static site (no build step): `index.html`, `crafts.html`, `img/`.
Business: Seasonal Design and More Unlimited LLC (formerly All Things Craft), 6006 Taylor Mill Rd, Taylor Mill, KY 41015.

## Custom order form → seasonaldesign@outlook.com
The form posts to a Google Apps Script web app on Sebastian's Google account (same setup as Crewitts Creek).
Each request:
1. adds a row to the **Requests** tab of the Google Sheet "Seasonal Design – Website Inbox"
2. saves the customer's photo to the Drive folder "Seasonal Design – Customer Photos"
3. emails seasonaldesign@outlook.com with the photo attached, and Reply goes to the customer

Code: `google-apps-script/Code.gs` · Setup / changes: `google-apps-script/SETUP.md`.
The site's `ENDPOINT` in index.html points at the web app's `/exec` URL. If sending fails, the form shows the shop email instead.

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
