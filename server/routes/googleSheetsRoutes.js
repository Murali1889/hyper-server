const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const googleSheetsController = require('../controllers/googleSheetsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/list-spreadsheets', authMiddleware, async (req, res) => {
  try {
    const spreadsheets = await googleSheetsController.listAllSpreadsheets(req.user.accessToken);
    res.json(spreadsheets);
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    res.status(500).send('Internal server error');
  }
});

router.get('/get-sheet-details', authMiddleware, async (req, res) => {
  const { spreadsheetId } = req.query;

  if (!spreadsheetId) {
    return res.status(400).send('Missing required parameters');
  }

  try {
    const sheetDetails = await googleSheetsController.getSheetDetails(req.user.accessToken, spreadsheetId);
    res.json(sheetDetails);
  } catch (error) {
    console.error('Error getting sheet details:', error);
    res.status(500).send('Internal server error');
  }
});

router.post('/generate-company-ids-location', authMiddleware, async (req, res) => {
  const { spreadsheetId, columnName, sheetName } = req.body;

  if (!spreadsheetId || !columnName || !sheetName) {
    return res.status(400).send('Missing required parameters');
}

try {
const auth = new google.auth.OAuth2();
auth.setCredentials({ access_token: req.user.accessToken });
const sheets = google.sheets({ version: 'v4', auth });
const headers = await googleSheetsController.getSheetHeaders(req.user.accessToken, spreadsheetId, sheetName);
const columnIndex = headers.indexOf(columnName) + 1;
if (columnIndex === 0) {
  return res.status(400).send('Invalid column name');
}

let idIndex = headers.indexOf('Company ID');
let locationIndex = headers.indexOf('Company Location');
let urlIndex = headers.indexOf('Company URL');

const newHeaders = [];
if (idIndex === -1) {
  idIndex = headers.length;
  newHeaders.push('Company ID');
}
if (locationIndex === -1) {
  locationIndex = headers.length + newHeaders.length;
  newHeaders.push('Company Location');
}
if (urlIndex === -1) {
  urlIndex = headers.length + newHeaders.length;
  newHeaders.push('Company URL');
}

if (newHeaders.length > 0) {
  const updatedHeaders = [...headers, ...newHeaders];
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!1:1`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [updatedHeaders]
    },
  });
}

const lastRow = await googleSheetsController.getLastRow(req.user.accessToken, spreadsheetId, sheetName);

const response = await sheets.spreadsheets.values.get({
  spreadsheetId: spreadsheetId,
  range: `${sheetName}!${String.fromCharCode(64 + columnIndex)}2:${String.fromCharCode(64 + columnIndex)}${lastRow}`,
});
const companyNames = response.data.values ? response.data.values.flat() : [];

const existingIdValuesResponse = await sheets.spreadsheets.values.get({
  spreadsheetId: spreadsheetId,
  range: `${sheetName}!${String.fromCharCode(65 + idIndex)}2:${String.fromCharCode(65 + idIndex)}${lastRow}`,
});
const existingLocationValuesResponse = await sheets.spreadsheets.values.get({
  spreadsheetId: spreadsheetId,
  range: `${sheetName}!${String.fromCharCode(65 + locationIndex)}2:${String.fromCharCode(65 + locationIndex)}${lastRow}`,
});
const existingUrlValuesResponse = await sheets.spreadsheets.values.get({
  spreadsheetId: spreadsheetId,
  range: `${sheetName}!${String.fromCharCode(65 + urlIndex)}2:${String.fromCharCode(65 + urlIndex)}${lastRow}`,
});

const existingIdValues = existingIdValuesResponse.data.values ? existingIdValuesResponse.data.values.flat() : [];
const existingLocationValues = existingLocationValuesResponse.data.values ? existingLocationValuesResponse.data.values.flat() : [];
const existingUrlValues = existingUrlValuesResponse.data.values ? existingUrlValuesResponse.data.values.flat() : [];

for (let index = 0; index < companyNames.length; index++) {
  if (!existingIdValues[index] || !existingLocationValues[index] || !existingUrlValues[index]) {
    const { id, location, url } = await googleSheetsController.getIdAndLocation(companyNames[index]);
    const rowUpdate = [];
    if (!existingIdValues[index]) rowUpdate.push(id);
    if (!existingLocationValues[index]) rowUpdate.push(location);
    if (!existingUrlValues[index]) rowUpdate.push(url);

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!${String.fromCharCode(65 + idIndex)}${index + 2}:${String.fromCharCode(65 + urlIndex)}${index + 2}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowUpdate]
      },
    });

    await googleSheetsController.delay(10000); // Delay for 10 seconds
  }
}

res.status(200).send('Company IDs, Locations, and URLs added successfully');
} catch (error) {
        console.error('Error generating company IDs and locations:', error);
        res.status(500).send('Internal server error');
}
});
    
module.exports = router;