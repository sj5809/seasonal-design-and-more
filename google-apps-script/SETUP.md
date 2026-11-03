# Website inbox (Google Apps Script)

Lives in the Google Sheet **"Seasonal Design – Website Inbox"** (sebastianjwade@gmail.com) → Extensions → Apps Script
→ project **"Seasonal Design Website Inbox"**.

- Deployed as **Web app**, Execute as: **Me**, Who has access: **Anyone**.
- `setup()` has been run (creates the Requests tab + "Seasonal Design – Customer Photos" Drive folder).
- Gmail sending limit on a personal Google account: ~100 emails/day.

## Changing the script
1. Paste the new `Code.gs` into the editor and save.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
   Never use "New deployment": that creates a new URL and the website would stop sending.

## Moving it to the owner's account later
Make a copy of the Sheet from her Google account, open its Apps Script, run `setup()`, deploy as a web app,
and replace `ENDPOINT` in index.html with the new `/exec` URL.

## /myshop (owner's page to update the site)
Address: https://seasonaldesignsandmore.com/myshop/ · Sign-in email: seasonaldesign@outlook.com
The password is never stored in this repo.

The same script handles /myshop. Her changes are committed to this repo by the script:
`items.json` (items + recently taken down), `site.json` (the yellow notice), `img/uploads/` (her photos).
GitHub Pages republishes within about a minute. Sebastian gets an email for every change.

Script properties (Apps Script → ⚙️ Project Settings → Script properties):
- `GH_TOKEN`: fine-grained GitHub token, **only this repo**, permission **Contents: Read and write**.
- `ADMIN_PASSWORD`: add it once, then run `setupAdmin()`. That stores a salted hash and deletes the plain password.
  To change her password later: add `ADMIN_PASSWORD` again, then run `setupAdmin()` (this signs her out everywhere).

8 wrong passwords in a row pauses sign-in for 15 minutes and emails Sebastian.
Sessions last 90 days on her phone.

Rebuild the baked HTML after editing items by hand: `python3 tools/build.py`.
(The pages also load items.json and site.json live, so her changes show without a rebuild.)
