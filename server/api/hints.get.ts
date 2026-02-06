import { defineEventHandler, createError } from "h3";
import { getSheets, getSheetId } from "../utils/sheets";

const HINTS_RANGE = "Hints";

// GET /api/hints — read all hints from the "Hints" tab
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
      // Create the tab
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

      return { hints: [] };
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: HINTS_RANGE,
    });

    const rows = res.data.values ?? [];
    if (rows.length <= 1) {
      return { hints: [] };
    }

    // Skip header row, return hints with timestamps
    const hints = rows.slice(1).map((row) => ({
      text: row[0] ?? "",
      timestamp: row[1] ?? "",
    }));

    return { hints };
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Google Sheets hints read error: ${e.message}`,
    });
  }
});
