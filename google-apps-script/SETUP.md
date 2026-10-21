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
