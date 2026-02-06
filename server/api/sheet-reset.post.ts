import { defineEventHandler, createError } from "h3";
import { getSheets, getSheetId, SHEET_RANGE } from "../utils/sheets";

// POST /api/sheet-reset — reset all checkStatus values to "unchecked"
// Keeps the bars data intact, just resets column K (checkStatus)
export default defineEventHandler(async () => {
  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  try {
    // Read current data to know how many rows there are
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = res.data.values ?? [];
    if (rows.length <= 1) {
      return { ok: true, message: "Nothing to reset" };
    }

    // Column K (index 10) is checkStatus — set all data rows to "unchecked"
    const resetValues = rows.slice(1).map(() => ["unchecked"]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_RANGE}!K2:K${rows.length}`,
      valueInputOption: "RAW",
      requestBody: {
        values: resetValues,
      },
    });

    return { ok: true, resetCount: resetValues.length };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets reset error: ${e.message}`,
    });
  }
});
