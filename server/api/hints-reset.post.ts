import { defineEventHandler, createError } from "h3";
import { getSheets, getSheetId } from "../utils/sheets";

const HINTS_RANGE = "Hints";

// POST /api/hints-reset — clear all hints from the "Hints" tab
export default defineEventHandler(async () => {
  const sheets = getSheets();
  const spreadsheetId = getSheetId();

  try {
    // Ensure the Hints tab exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const tabExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === "Hints"
    );

    if (!tabExists) {
      // Create the tab if it doesn't exist
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
    }

    // Clear all data in the Hints tab
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: HINTS_RANGE,
    });

    // Write header back
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${HINTS_RANGE}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["hint", "timestamp"]],
      },
    });

    return { ok: true };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets hints reset error: ${e.message}`,
    });
  }
});
