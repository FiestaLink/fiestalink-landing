const SPREADSHEET_ID = '1Sn6BIgEQGa92ZcTe-UZRWoAYxaxZhnFmob6HqPA6Z1U';
const RESPONSE_SHEET_NAME = 'Confirmaciones';
const GUEST_SHEET_NAME = 'Invitados';
const CONFIRMATION_CC_EMAIL = 'burrolala@icloud.com';
const RESPONSE_HEADERS = [
  'ID',
  'Fecha de confirmación',
  'Nombre',
  'Número de asistentes',
  'Código de invitación',
  'Correo de destino',
  'Estado del correo'
];
const GUEST_HEADERS = [
  'Codigo de invitacion',
  'Nombre del invitado',
  'Correo',
  'Maximo de personas',
  'Confirmacion'
];

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.website) {
    return jsonResponse({ ok: true });
  }

  try {
    const id = String(params.id || '').trim();
    const token = String(params.token || '').trim();
    const count = Number(params.count);
    const recipient = String(params.email || '').trim();

    if (!/^[A-Za-z0-9-]{16,80}$/.test(id)) {
      return jsonResponse({ ok: false, error: 'ID de confirmación inválido.' });
    }
    if (!/^[a-f0-9]{48}$/i.test(token)) {
      return jsonResponse({ ok: false, error: 'Código de invitación inválido.' });
    }
    if (!isValidEmail(recipient)) {
      return jsonResponse({ ok: false, error: 'Escribe un correo electrónico válido.' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let responseSheet;
    let responseRow;
    let guest;
    try {
      const guestSheet = getGuestSheet();
      guest = findGuestByToken(guestSheet, token);
      if (!guest) {
        return jsonResponse({ ok: false, error: 'No encontramos esta invitación.' });
      }
      if (!Number.isInteger(count) || count < 1 || count > guest.maxCount) {
        return jsonResponse({
          ok: false,
          error: 'El número de asistentes supera el máximo de esta invitación.'
        });
      }
      if (guest.confirmation.toLowerCase() === 'confirmado') {
        return jsonResponse({ ok: false, error: 'Esta invitación ya fue confirmada.' });
      }

      responseSheet = getResponseSheet();
      const existingRow = findResponseRowByToken(responseSheet, token);
      if (existingRow !== -1) {
        return jsonResponse({ ok: true, id: id, status: 'confirmed' });
      }

      responseRow = responseSheet.getLastRow() + 1;
      responseSheet.appendRow([
        id,
        new Date(),
        guest.name,
        count,
        token,
        recipient,
        'Pendiente'
      ]);
      guestSheet.getRange(guest.row, 5).setValue('Confirmado');
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    try {
      sendConfirmationEmail(recipient, guest.name, count);
      responseSheet.getRange(responseRow, 7).setValue('Enviado');
      SpreadsheetApp.flush();
    } catch (error) {
      console.error('La confirmación quedó guardada, pero no se pudo enviar el correo.', error);
      responseSheet.getRange(responseRow, 7).setValue('Error');
      SpreadsheetApp.flush();
      return jsonResponse({
        ok: false,
        error: 'La confirmación quedó guardada, pero no se pudo enviar el correo. Contacta a los anfitriones.'
      });
    }

    return jsonResponse({ ok: true, id: id });
  } catch (error) {
    console.error('No se pudo registrar la confirmación.', error);
    return jsonResponse({ ok: false, error: 'No se pudo registrar la confirmación.' });
  }
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || 'status');
  const callback = String(params.callback || '');
  if (!['guest', 'status'].includes(action) ||
      !new RegExp('^rsvp' + (action === 'guest' ? 'Guest' : 'Status') + '_[A-Za-z0-9_]+$').test(callback)) {
    return ContentService.createTextOutput('Solicitud inválida.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  let result;
  try {
    if (action === 'guest') {
      const token = String(params.token || '').trim();
      if (!/^[a-f0-9]{48}$/i.test(token)) {
        result = { status: 'error', message: 'El enlace de invitación no es válido.' };
      } else {
        const guest = findGuestByToken(getGuestSheet(), token);
        if (!guest || guest.confirmation.toLowerCase() === 'confirmado') {
          result = { status: 'error', message: 'Esta invitación no está disponible.' };
        } else {
          result = {
            status: 'ready',
            guest: {
              name: guest.name,
              email: guest.email,
              maxCount: guest.maxCount
            }
          };
        }
      }
    } else {
      const token = String(params.token || '').trim();
      if (!/^[a-f0-9]{48}$/i.test(token)) {
        result = { status: 'error', message: 'Código de invitación inválido.' };
      } else {
        const sheet = getResponseSheet();
        const row = findResponseRowByToken(sheet, token);
        if (row === -1) {
          result = { status: 'pending' };
        } else {
          const emailStatus = String(sheet.getRange(row, 7).getValue());
          if (emailStatus === 'Enviado') {
            result = { status: 'confirmed' };
          } else if (emailStatus === 'Error') {
            result = {
              status: 'error',
              message: 'La confirmación quedó guardada, pero no se pudo enviar el correo. Contacta a los anfitriones.'
            };
          } else {
            result = { status: 'pending' };
          }
        }
      }
    }
  } catch (error) {
    console.error('No se pudo consultar la invitación o confirmación.', error);
    result = { status: 'error', message: 'No se pudo consultar la invitación o confirmación.' };
  }

  const json = JSON.stringify(result).replace(/[<>&\u2028\u2029]/g, function (character) {
    return {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029'
    }[character];
  });
  return ContentService.createTextOutput(
    callback + '(' + json + ');'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getGuestSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(GUEST_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(GUEST_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(GUEST_HEADERS);
  } else {
    const headers = sheet.getRange(1, 1, 1, GUEST_HEADERS.length).getDisplayValues()[0];
    if (GUEST_HEADERS.some((header, index) => headers[index] !== header)) {
      throw new Error('La pestaña Invitados debe tener los encabezados definidos en el CSV.');
    }
  }

  return sheet;
}

function findGuestByToken(sheet, token) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, GUEST_HEADERS.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    if (String(row[0]).trim() !== token) {
      continue;
    }

    const name = String(row[1]).trim();
    const email = String(row[2]).trim();
    const maxCount = Number(row[3]);
    if (!name || name.length > 80 || !isValidEmail(email) ||
        !Number.isSafeInteger(maxCount) || maxCount < 1) {
      throw new Error('El registro de invitado tiene datos inválidos.');
    }

    return {
      row: index + 2,
      name: name,
      email: email,
      maxCount: maxCount,
      confirmation: String(row[4] || 'Pendiente').trim()
    };
  }

  return null;
}

function getResponseSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(RESPONSE_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RESPONSE_HEADERS);
  } else {
    const columnCount = sheet.getMaxColumns();
    if (columnCount < RESPONSE_HEADERS.length) {
      sheet.insertColumnsAfter(columnCount, RESPONSE_HEADERS.length - columnCount);
    }
    const currentHeaders = sheet.getRange(1, 1, 1, 4).getDisplayValues()[0];
    if (currentHeaders[0] !== 'ID' ||
        currentHeaders[1] !== 'Fecha de confirmación' ||
        currentHeaders[2] !== 'Nombre' ||
        currentHeaders[3] !== 'Número de asistentes') {
      throw new Error('Los encabezados de Confirmaciones no coinciden con el formato esperado.');
    }
    const headers = sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).getDisplayValues()[0];
    if (RESPONSE_HEADERS.some((header, index) => headers[index] !== header)) {
      sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
    }
  }

  return sheet;
}

function findResponseRowByToken(sheet, token) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  const match = sheet.getRange(2, 5, lastRow - 1, 1)
    .createTextFinder(token)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : -1;
}

function getSpreadsheet() {
  if (SPREADSHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
    throw new Error('Configura SPREADSHEET_ID en Code.gs.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sendConfirmationEmail(recipient, name, count) {
  const date = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'd MMMM yyyy, HH:mm'
  );
  const safeName = escapeHtml(name);
  const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;color:#183451;text-align:center;padding:36px}' +
    'h1{color:#123b70} .badge{display:inline-block;background:#ffd329;padding:10px 18px;border-radius:20px}' +
    '</style></head><body><span class="badge">Confirmación de asistencia</span>' +
    '<h1>Tres años de aventura</h1><p>¡Gracias por confirmar! Te esperamos para celebrar.</p>' +
    '<p><strong>Nombre:</strong> ' + safeName + '</p>' +
    '<p><strong>Total de asistentes:</strong> ' + count + '</p>' +
    '<p><strong>Fecha de confirmación:</strong> ' + escapeHtml(date) + '</p>' +
    '<p>Temática Paw Patrol</p></body></html>';
  const pdf = HtmlService.createHtmlOutput(html)
    .getBlob()
    .getAs(MimeType.PDF)
    .setName('Confirmacion-Tres-anos-Paw-Patrol.pdf');

  MailApp.sendEmail({
    to: recipient,
    cc: CONFIRMATION_CC_EMAIL,
    subject: 'Tu confirmación — Tres años Paw Patrol',
    body: 'Adjuntamos el comprobante PDF de tu confirmación. ¡Te esperamos!',
    htmlBody: html,
    attachments: [pdf]
  });
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character];
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
