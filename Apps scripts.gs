// ============================================================
// ATTENDANCE SYSTEM — Google Apps Script Backend
// Paste this entire code into Google Apps Script editor
// ============================================================

const SHEET_NAME = "Attendance";
const SHEET_ID = ""; // ← PASTE YOUR GOOGLE SHEET ID HERE (from URL)

// Column indices (1-based)
const COL_ID        = 1;
const COL_CODE      = 2;
const COL_ROOM      = 3;
const COL_TIMESTAMP = 4;
const COL_DATE      = 5;

// ─── MAIN ENTRY POINT ───────────────────────────────────────
function doPost(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);
    const studentCode = String(data.code || "").trim().toUpperCase();
    const room        = String(data.room || "").trim();

    if (!studentCode || !room) {
      response.setContent(JSON.stringify({ status: "error", message: "Missing code or room" }));
      return response;
    }

    const ss    = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);
    const today = getTodayDate();

    // ── Duplicate check ──────────────────────────────────────
    const data2D   = sheet.getDataRange().getValues();
    const existing = data2D.slice(1).find(row =>
      String(row[COL_CODE - 1]).trim().toUpperCase() === studentCode &&
      String(row[COL_DATE - 1]).trim() === today
    );

    if (existing) {
      response.setContent(JSON.stringify({
        status: "duplicate",
        message: `${studentCode} already marked present today`,
        room: existing[COL_ROOM - 1],
        time: existing[COL_TIMESTAMP - 1]
      }));
      return response;
    }

    // ── New entry ────────────────────────────────────────────
    const now       = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");
    const newId     = data2D.length; // auto-increment (header = row 1)

    sheet.appendRow([newId, studentCode, room, timestamp, today]);

    response.setContent(JSON.stringify({
      status: "success",
      message: `${studentCode} marked present`,
      id: newId,
      room: room,
      time: timestamp,
      date: today
    }));
    return response;

  } catch (err) {
    response.setContent(JSON.stringify({ status: "error", message: err.toString() }));
    return response;
  }
}

// ─── GET: Stats for Dashboard ────────────────────────────────
function doGet(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action || "stats";
    const ss     = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    const sheet  = getOrCreateSheet(ss);
    const today  = getTodayDate();
    const rows   = sheet.getDataRange().getValues().slice(1); // skip header

    if (action === "stats") {
      const todayRows  = rows.filter(r => String(r[COL_DATE - 1]).trim() === today);
      const roomCounts = {};
      todayRows.forEach(r => {
        const room = String(r[COL_ROOM - 1]);
        roomCounts[room] = (roomCounts[room] || 0) + 1;
      });

      const recent = todayRows.slice(-20).reverse().map(r => ({
        code: r[COL_CODE - 1],
        room: r[COL_ROOM - 1],
        time: r[COL_TIMESTAMP - 1]
      }));

      response.setContent(JSON.stringify({
        status: "ok",
        total: todayRows.length,
        roomCounts,
        recent,
        date: today
      }));
    }

    return response;
  } catch (err) {
    response.setContent(JSON.stringify({ status: "error", message: err.toString() }));
    return response;
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ID", "StudentCode", "Room", "Timestamp", "Date"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getTodayDate() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}