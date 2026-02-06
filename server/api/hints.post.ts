import { defineEventHandler, readBody, createError } from "h3";
import { getSheets, getSheetId } from "../utils/sheets";

const HINTS_RANGE = "Hints";

// POST /api/hints — add a new hint to the "Hints" tab
export default defineEventHandler(async (event) => {
  const body = await readBody<{ hint: string }>(event);

  if (!body?.hint?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Missing hint text" });
  }

  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  try {
    // Ensure the Hints tab exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const tabExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === "Hints"
    );

    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: "Hints" },
              },
            },
          ],
        },
      });

      // Write header
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${HINTS_RANGE}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["hint", "timestamp"]],
        },
      });
    }

    // Append the new hint
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: HINTS_RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[body.hint.trim(), timestamp]],
      },
    });

    return { ok: true, hint: body.hint.trim(), timestamp };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets hints write error: ${e.message}`,
    });
  }
});
