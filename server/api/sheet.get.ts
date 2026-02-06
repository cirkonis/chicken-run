import { defineEventHandler, createError } from "h3";
import { getSheets, getSheetId, SHEET_RANGE, HEADER_ROW } from "../utils/sheets";

// GET /api/sheet — read all bars + statuses from the sheet
export default defineEventHandler(async () => {
  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = res.data.values ?? [];

    // If empty or only header, return empty
    if (rows.length <= 1) {
      return { bars: [] };
    }

    // First row is header, rest are data
    const header = rows[0];
    const dataRows = rows.slice(1);

    const bars = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((col: string, i: number) => {
        obj[col] = row[i] ?? "";
      });

      return {
        placeId: obj.placeId || "",
        name: obj.name || "",
        address: obj.address || "",
        lat: obj.lat ? Number(obj.lat) : null,
        lng: obj.lng ? Number(obj.lng) : null,
        rating: obj.rating ? Number(obj.rating) : null,
        ratingsTotal: obj.ratingsTotal ? Number(obj.ratingsTotal) : null,
        priceLevel: obj.priceLevel ? Number(obj.priceLevel) : null,
        status: obj.businessStatus || null,
        mapsUrl: obj.mapsUrl || "",
        checkStatus: obj.checkStatus || "unchecked",
        category: obj.category || "other",
      };
    });

    return { bars };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets read error: ${e.message}`,
    });
  }
});
