const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME = 'Confirmaciones';
const NOTIFICATION_EMAIL = '';
const HEADERS = ['ID', 'Fecha de confirmación', 'Nombre', 'Número de asistentes'];

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (params.website) {
      return jsonResponse({ ok: true });
    }

    const id = String(params.id || '').trim();
    const name = String(params.name || '').trim();
    const count = Number(params.count);

    if (!/^[A-Za-z0-9-]{16,80}$/.test(id)) {
      return jsonResponse({ ok: false, error: 'ID de confirmación inválido.' });
    }
    if (!name || name.length > 80) {
      return jsonResponse({ ok: false, error: 'El nombre es obligatorio y debe tener máximo 80 caracteres.' });
    }
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return jsonResponse({ ok: false, error: 'El número de asistentes debe estar entre 1 y 10.' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getResponseSheet();
      const existingRow = findConfirmationRow(sheet, id);
      if (existingRow === -1) {
        sheet.appendRow([id, new Date(), name, count]);
        SpreadsheetApp.flush();
        sendNotification(name, count);
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, id: id });
  } catch (error) {
    console.error('No se pudo registrar la confirmación.', error);
    return jsonResponse({ ok: false, error: 'No se pudo registrar la confirmación.' });
  }
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = String(params.callback || '');
  if (!/^rsvpStatus_[A-Za-z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput('Callback inválido.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  let result = { status: 'pending' };
  try {
    const id = String(params.id || '').trim();
    if (!/^[A-Za-z0-9-]{16,80}$/.test(id)) {
      result = { status: 'error', message: 'ID de confirmación inválido.' };
    } else {
      const sheet = getResponseSheet();
      if (findConfirmationRow(sheet, id) !== -1) {
        result = { status: 'confirmed' };
      }
    }
  } catch (error) {
    console.error('No se pudo consultar la confirmación.', error);
    result = { status: 'error', message: 'No se pudo consultar la confirmación.' };
  }

  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify(result) + ');'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getResponseSheet() {
  if (SPREADSHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
    throw new Error('Configura SPREADSHEET_ID en Code.gs.');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  return sheet;
}

function findConfirmationRow(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  const match = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : -1;
}

function sendNotification(name, count) {
  if (!NOTIFICATION_EMAIL) {
    return;
  }

  try {
    MailApp.sendEmail(
      NOTIFICATION_EMAIL,
      'Nueva confirmación — Tres años Paw Patrol',
      name + ' confirmó ' + count + (count === 1 ? ' asistencia.' : ' asistencias.')
    );
  } catch (error) {
    console.error('La confirmación quedó guardada, pero no se pudo enviar el correo.', error);
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
