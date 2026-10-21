/**
 * Seasonal Design & More – website inbox
 * Receives the custom-order form from the website, then:
 *   1. adds a row to the "Requests" tab of this Google Sheet
 *   2. saves any attached photo to a Drive folder
 *   3. emails the request (photo attached) to the shop, with Reply going to the customer
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
