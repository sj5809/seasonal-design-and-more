/**
 * Seasonal Design & More – website inbox
 * Receives the custom-order form from the website, then:
 *   1. adds a row to the "Requests" tab of this Google Sheet
 *   2. saves any attached photo to a Drive folder
 *   3. emails the request (photo attached) to the shop, with Reply going to the customer
 *
 * It also powers /myshop, the owner's page for adding items, taking them down and changing the notice.
 * Those changes are saved into the GitHub repo (items.json, site.json, img/uploads/), and GitHub Pages republishes.
 *
 * Setup: see SETUP.md. Run setup() once, then Deploy → Web app (Execute as: Me, Access: Anyone).
 */

const OWNER_EMAIL = 'seasonaldesign@outlook.com';
const SHEET_NAME = 'Requests';
const FOLDER_NAME = 'Seasonal Design – Customer Photos';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TZ = 'America/New_York';

const FIELDS = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['item_type', 'What they want'],
  ['occasion', 'Occasion'],
  ['text_to_add', 'Words / names / dates'],
  ['quantity', 'How many'],
  ['needed_by', 'Needed by'],
  ['delivery', 'Pickup or ship'],
  ['details', 'Details'],
];

/** Run once from the editor to create the sheet tab and photo folder (and grant permissions). */
function setup() {
  const sh = getSheet_();
  getFolder_();
  Logger.log('Ready. Sheet tab: ' + sh.getName() + ' · Emails left today: ' + MailApp.getRemainingDailyQuota());
}

/** Health check: opening the /exec URL in a browser shows this. */
function doGet() {
  return json_({ ok: true, service: 'Seasonal Design website inbox' });
}

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.action) return json_(handleAdmin_(d)); // requests from /myshop
    if (d._honey) return json_({ ok: true }); // spam bot filled the hidden field

    const v = {};
    FIELDS.forEach(([k]) => (v[k] = clean_(d[k], k === 'details' ? 5000 : 500)));
    if (!v.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) || !v.details) {
      return json_({ ok: false, error: 'missing_fields' });
    }

    // Photo → Drive + email attachment
    let blob = null, photoUrl = '';
    if (d.photo && d.photo.data) {
      const bytes = Utilities.base64Decode(d.photo.data);
      if (bytes.length <= MAX_PHOTO_BYTES) {
        const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm');
        const fname = stamp + ' ' + v.name + ' - ' + (clean_(d.photo.name, 120) || 'photo.jpg');
        blob = Utilities.newBlob(bytes, clean_(d.photo.type, 100) || 'application/octet-stream', fname);
        photoUrl = getFolder_().createFile(blob).getUrl();
      }
    }

    // Log to sheet
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      getSheet_().appendRow([new Date()].concat(FIELDS.map(([k]) => v[k]), [photoUrl]));
    } finally {
      lock.releaseLock();
    }

    // Email the shop
    const rows = FIELDS.filter(([k]) => v[k])
      .map(([k, label]) => '<tr><td style="padding:6px 12px 6px 0;color:#566b64;vertical-align:top;white-space:nowrap"><b>' + label +
        '</b></td><td style="padding:6px 0">' + esc_(v[k]).replace(/\n/g, '<br>') + '</td></tr>').join('');
    const photoLine = photoUrl
      ? '<p>Their photo is attached, and saved in Drive: <a href="' + photoUrl + '">open full-size photo</a></p>'
      : '<p style="color:#566b64">No photo attached.</p>';
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      replyTo: v.email,
      name: 'Seasonal Design website',
      subject: 'New custom order request from ' + v.name + (v.item_type ? ' (' + v.item_type + ')' : ''),
      htmlBody:
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f3a33">' +
        '<h2 style="font-weight:normal;margin:0 0 12px">New request from your website</h2>' +
        '<table style="border-collapse:collapse">' + rows + '</table>' + photoLine +
        '<p style="color:#566b64">Just hit Reply to answer ' + esc_(v.name) + ' directly.</p></div>',
      attachments: blob ? [blob] : [],
    });

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    const header = ['Received'].concat(FIELDS.map(f => f[1]), ['Photo']);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder deleted; make a new one */ }
  }
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function clean_(s, max) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/* =====================================================================
 * /myshop admin
 * Script properties (Project Settings → Script properties), never in this file:
 *   GH_TOKEN        fine-grained GitHub token, this repo only, Contents: read & write
 *   ADMIN_PASSWORD  set once; setupAdmin() swaps it for a salted hash and deletes it
 * ===================================================================== */

const ADMIN_EMAIL = 'seasonaldesign@outlook.com';
const NOTIFY_EMAIL = 'sebastianjwade@gmail.com';
const GH_REPO = 'sj5809/seasonal-design-and-more';
const GH_BRANCH = 'main';
const SESSION_DAYS = 90;
const MAX_FAILS = 8; // per 15 minutes
const CATS = {
  plates: 'License plate',
  glass: 'Printed glass',
  apparel: 'Shirts & sweatshirts',
  decor: 'Wreaths & arrangements',
  painted: 'Painted pieces',
  other: 'Handmade',
};

/** Run once after adding GH_TOKEN and ADMIN_PASSWORD in Script properties. */
function setupAdmin() {
  const p = PropertiesService.getScriptProperties();
  if (/^(PASTE|TYPE)_/.test(p.getProperty('GH_TOKEN') || '') || /^(PASTE|TYPE)_/.test(p.getProperty('ADMIN_PASSWORD') || '')) {
    throw new Error('Replace the placeholder values in Project Settings → Script properties first, then run setupAdmin again.');
  }
  if (!p.getProperty('SESSION_SECRET')) p.setProperty('SESSION_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const pw = p.getProperty('ADMIN_PASSWORD');
  if (pw) {
    const salt = Utilities.getUuid();
    p.setProperty('ADMIN_SALT', salt);
    p.setProperty('ADMIN_PASSWORD_HASH', hash_(salt, pw.trim()));
    p.deleteProperty('ADMIN_PASSWORD');
    // A new password signs everyone out.
    p.setProperty('SESSION_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  if (!p.getProperty('ADMIN_PASSWORD_HASH')) throw new Error('Add ADMIN_PASSWORD in Script properties, then run setupAdmin again.');
  if (!p.getProperty('GH_TOKEN')) throw new Error('Add GH_TOKEN in Script properties, then run setupAdmin again.');
  const items = readJson_('items.json');
  Logger.log('Admin ready. Password hashed. GitHub OK: items.json has ' + items.data.items.length + ' items.');
}

function handleAdmin_(d) {
  try {
    if (d.action === 'login') return login_(d.email, d.password);
    if (!checkToken_(d.token)) return { ok: false, error: 'signed_out' };
    switch (d.action) {
      case 'list': {
        const items = readJson_('items.json').data, site = readJson_('site.json').data;
        return { ok: true, items: items.items, removed: items.removed || [], notice: site.notice || '' };
      }
      case 'add': return addItem_(d);
      case 'remove': return moveItem_(d.id, 'items', 'removed', 'Took down');
      case 'restore': return moveItem_(d.id, 'removed', 'items', 'Put back');
      case 'notice': return setNotice_(d.notice);
    }
    return { ok: false, error: 'unknown_action' };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'server_error' };
  }
}

function login_(email, password) {
  const cache = CacheService.getScriptCache();
  const key = 'fails';
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: 'locked' };
  const p = PropertiesService.getScriptProperties();
  const good = String(email || '').trim().toLowerCase() === ADMIN_EMAIL &&
    p.getProperty('ADMIN_PASSWORD_HASH') &&
    hash_(p.getProperty('ADMIN_SALT'), String(password || '').trim()) === p.getProperty('ADMIN_PASSWORD_HASH');
  if (!good) {
    cache.put(key, String(fails + 1), 15 * 60);
    if (fails + 1 === MAX_FAILS) notify_('Website sign-in locked', 'Someone typed the wrong /myshop password ' + MAX_FAILS + ' times. Sign-in is paused for 15 minutes.');
    return { ok: false, error: 'bad_login' };
  }
  cache.remove(key);
  const exp = String(Date.now() + SESSION_DAYS * 864e5);
  return { ok: true, token: exp + '.' + sign_(exp) };
}

function checkToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || Number(parts[0]) < Date.now()) return false;
  return sign_(parts[0]) === parts[1];
}

function sign_(s) {
  const secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret)).replace(/=+$/, '');
}

function hash_(salt, pw) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8));
}

function addItem_(d) {
  const name = clean_(d.name, 80);
  const blurb = clean_(d.blurb, 300);
  const cat = CATS[d.cat] ? d.cat : 'other';
  if (!name || !d.photo || !d.photo.data) return { ok: false, error: 'missing_fields' };
  const bytes = Utilities.base64Decode(d.photo.data);
  if (bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'photo_too_big' };

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  const id = slug + '-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss');
  const img = 'img/uploads/' + id + '.jpg';
  gh_('PUT', img, { message: 'Add photo: ' + name + ' (from /myshop)', content: d.photo.data, branch: GH_BRANCH });

  const item = { id: id, name: name, cat: cat, tag: CATS[cat], blurb: blurb, img: img,
    w: Number(d.photo.w) || 1000, h: Number(d.photo.h) || 1000, added: new Date().toISOString() };
  const out = updateItems_(function (doc) { doc.items.unshift(item); }, 'Add item: ' + name + ' (from /myshop)');
  notify_('New item on the website: ' + name,
    'Added from /myshop:\n\n' + name + '\n' + CATS[cat] + '\n' + (blurb || '(no description)') +
    '\n\nPhoto: https://github.com/' + GH_REPO + '/blob/' + GH_BRANCH + '/' + img);
  return { ok: true, item: item, items: out.items, removed: out.removed };
}

function moveItem_(id, from, to, verb) {
  let moved = null;
  const out = updateItems_(function (doc) {
    doc.removed = doc.removed || [];
    const i = doc[from].findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    moved = doc[from].splice(i, 1)[0];
    doc[to].unshift(moved);
    doc.removed = doc.removed.slice(0, 30);
  }, verb + ' item: ' + id + ' (from /myshop)');
  if (!moved) return { ok: false, error: 'not_found' };
  notify_(verb + ' on the website: ' + moved.name, verb + ' from /myshop: ' + moved.name);
  return { ok: true, items: out.items, removed: out.removed };
}

function setNotice_(text) {
  const notice = clean_(text, 200);
  withRetry_(function () {
    const f = readJson_('site.json');
    f.data.notice = notice;
    writeJson_('site.json', f.data, f.sha, (notice ? 'Update' : 'Clear') + ' notice (from /myshop)');
  });
  notify_('Website notice ' + (notice ? 'changed' : 'removed'), notice ? 'New notice: ' + notice : 'The notice was taken off the website.');
  return { ok: true, notice: notice };
}

function updateItems_(mutate, message) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let doc;
    withRetry_(function () {
      const f = readJson_('items.json');
      doc = f.data;
      doc.removed = doc.removed || [];
      mutate(doc);
      writeJson_('items.json', doc, f.sha, message);
    });
    return doc;
  } finally {
    lock.releaseLock();
  }
}

function withRetry_(fn) {
  try { fn(); } catch (e) {
    if (String(e).indexOf('409') < 0) throw e; // only retry an edit clash
    Utilities.sleep(1500);
    fn();
  }
}

function readJson_(path) {
  const r = gh_('GET', path);
  const text = Utilities.newBlob(Utilities.base64Decode(r.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
  return { sha: r.sha, data: JSON.parse(text) };
}

function writeJson_(path, data, sha, message) {
  gh_('PUT', path, {
    message: message, sha: sha, branch: GH_BRANCH,
    content: Utilities.base64Encode(JSON.stringify(data, null, 2) + '\n', Utilities.Charset.UTF_8),
  });
}

function gh_(method, path, body) {
  const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) throw new Error('GH_TOKEN missing');
  let url = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  if (method === 'GET') url += '?ref=' + GH_BRANCH + '&t=' + Date.now();
  const opts = {
    method: method.toLowerCase(), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  };
  if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
  const r = UrlFetchApp.fetch(url, opts);
  const code = r.getResponseCode();
  if (code >= 300) throw new Error('GitHub ' + method + ' ' + path + ' failed: ' + code + ' ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}

function notify_(subject, text) {
  try { MailApp.sendEmail(NOTIFY_EMAIL, '[Seasonal Design site] ' + subject, text); } catch (e) { console.error(e); }
}
