import { defineEventHandler, readBody, createError } from "h3";
import { getSheets, getSheetId, SHEET_RANGE, HEADER_ROW } from "../utils/sheets";

type BarInput = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingsTotal: number | null;
  priceLevel: number | null;
  status: string | null;
  mapsUrl: string;
  checkStatus?: string;
  category?: string;
};

// POST /api/sheet — full replace: clear sheet and write new bars
export default defineEventHandler(async (event) => {
  const body = await readBody<{ bars: BarInput[] }>(event);

  if (!body?.bars || !Array.isArray(body.bars)) {
    throw createError({ statusCode: 400, statusMessage: "Missing bars array in body" });
  }

  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  // Build rows: header + data
  const dataRows = body.bars.map((b) => [
    b.placeId ?? "",
    b.name ?? "",
    b.address ?? "",
    b.lat != null ? String(b.lat) : "",
    b.lng != null ? String(b.lng) : "",
    b.rating != null ? String(b.rating) : "",
    b.ratingsTotal != null ? String(b.ratingsTotal) : "",
    b.priceLevel != null ? String(b.priceLevel) : "",
    b.status ?? "",
    b.mapsUrl ?? "",
    b.checkStatus ?? "unchecked",
    b.category ?? "other",
  ]);

  const allRows = [HEADER_ROW, ...dataRows];

  try {
    // Clear the entire sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    // Write all rows
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_RANGE}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: allRows,
      },
    });

    return { ok: true, count: body.bars.length };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets write error: ${e.message}`,
    });
  }
});
