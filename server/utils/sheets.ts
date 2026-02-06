import { google, sheets_v4 } from "googleapis";

let _sheets: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  // The private key comes with literal \n in env vars — convert to real newlines
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

export function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID env var");
  return id;
}

// Column layout for the sheet:
// A: placeId
// B: name
// C: address
// D: lat
// E: lng
// F: rating
// G: ratingsTotal
// H: priceLevel
// I: businessStatus
// J: mapsUrl
// K: checkStatus (unchecked | checked | not_checking)
// L: category (bar | cafe | restaurant | hotel | other)
export const SHEET_RANGE = "Sheet1";
export const HEADER_ROW = [
  "placeId",
  "name",
  "address",
  "lat",
  "lng",
  "rating",
  "ratingsTotal",
  "priceLevel",
  "businessStatus",
  "mapsUrl",
  "checkStatus",
  "category",
];
