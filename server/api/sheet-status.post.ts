import { defineEventHandler, readBody, createError } from "h3";
import { getSheets, getSheetId, SHEET_RANGE } from "../utils/sheets";

// POST /api/sheet-status — update a single bar's checkStatus
// Body: { placeId: string, checkStatus: "unchecked" | "checked" | "not_checking" }
export default defineEventHandler(async (event) => {
  const body = await readBody<{ placeId: string; checkStatus: string }>(event);

  if (!body?.placeId || !body?.checkStatus) {
    throw createError({ statusCode: 400, statusMessage: "Missing placeId or checkStatus" });
  }

  const validStatuses = ["unchecked", "checked", "not_checking"];
  if (!validStatuses.includes(body.checkStatus)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid checkStatus: ${body.checkStatus}` });
  }

  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  try {
    // Read column A (placeId) to find the row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!A:A`,
    });

    const rows = res.data.values ?? [];
    // Find the row index (1-based, row 1 is header)
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]?.[0] === body.placeId) {
        rowIndex = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      throw createError({ statusCode: 404, statusMessage: `Bar not found: ${body.placeId}` });
    }

    // Update column K for this row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_RANGE}!K${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[body.checkStatus]],
      },
    });

    return { ok: true, placeId: body.placeId, checkStatus: body.checkStatus };
  } catch (e: any) {
    if (e.statusCode) throw e; // re-throw our own errors
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets status update error: ${e.message}`,
    });
  }
});
