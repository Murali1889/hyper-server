const { google } = require('googleapis');
const axios = require('axios');
const cheerio = require('cheerio');

const createAuthClient = (accessToken) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
};

const listAllSpreadsheets = async (accessToken) => {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)'
  });
  return response.data.files;
};

const getSheetHeaders = async (accessToken, spreadsheetId, sheetName) => {
  const auth = createAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  return response.data.values ? response.data.values[0] : [];
};

const getLastRow = async (accessToken, spreadsheetId, sheetName) => {
  const auth = createAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:A`,
  });
  const rows = response.data.values ? response.data.values : [];
  return rows.length;
};

const getLastColumn = async (accessToken, spreadsheetId, sheetName) => {
  const auth = createAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const columns = response.data.values ? response.data.values[0] : [];
  return columns.length;
};

const getSheetDetails = async (accessToken, spreadsheetId) => {
  const auth = createAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });

  const sheetDetails = {};
  const sheetPromises = response.data.sheets.map(async sheet => {
    const sheetName = sheet.properties.title;
    const headers = await getSheetHeaders(accessToken, spreadsheetId, sheetName);
    sheetDetails[sheetName] = headers;
  });

  await Promise.all(sheetPromises);
  return sheetDetails;
};

const getCompanyUrl = async (companyName) => {
  const query = `${companyName} company linkedin profile url`;
  let linkedinUrls = await fetchAndExtractData(query);
  if (!linkedinUrls || linkedinUrls.length === 0) {
    linkedinUrls = await fetchAndExtractDataUsingCustomSearch(query);
  }
  return linkedinUrls.length > 0 ? linkedinUrls[0] : null;
};

const fetchAndExtractData = async (query) => {
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  const options = {
    headers: {
      'User-Agent': getRandomUserAgent()
    }
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(10000); // Delay for 10 seconds
    try {
      const response = await axios.get(url, options);
      const html = response.data;
      const urls = extractLinkedInUrlsFromHtml(html);
      if (urls.length > 0) {
        return urls;
      }
    } catch (e) {
      console.error('Error fetching URL: ' + url + ' - ' + e.message);
    }
  }

  console.log('Failed to fetch data after 3 attempts, using Google Custom Search API.');
  return [];
};

const fetchAndExtractDataUsingCustomSearch = async (query) => {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    const urls = data.items ? data.items.map(item => item.link) : [];
    const linkedinUrls = urls.filter(url => url.includes('linkedin.com/company'));
    console.log('LinkedIn Company URLs from Custom Search API: ' + JSON.stringify(linkedinUrls));
    return linkedinUrls;
  } catch (e) {
    console.error('Error fetching data using Google Custom Search API: ' + e.message);
    return [];
  }
};

const extractLinkedInUrlsFromHtml = (html) => {
  const $ = cheerio.load(html);
  const links = [];
  $('a').each((i, link) => {
    const url = $(link).attr('href');
    if (url && url.includes('linkedin.com/company')) {
      links.push(url);
    }
  });
  return links;
};

const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.64'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const getCompanyDetails = async (url) => {
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': getRandomUserAgent() } });
    const html = response.data;

    const extractedData = extractDataFromHtml(html);
    console.log('Extracted Data: ' + JSON.stringify(extractedData));
    return extractedData;
  } catch (e) {
    console.error('Error fetching URL: ' + url + ' - ' + e.message);
    return { id: '', location: '' };
  }
};

const extractDataFromHtml = (html) => {
  try {
    const idRegex1 = /data-semaphore-content-urn="urn:li:organization:(\d+)"/;
    const idRegex2 = /currentCompany=%5B%22(\d+)%22%5D/;
    const locationRegex = /"addressLocality":"([^"]*)"(?:,"addressRegion":"([^"]*)")?/;

    const idMatch1 = idRegex1.exec(html);
    const idMatch2 = idRegex2.exec(html);
    const locationMatch = locationRegex.exec(html);

    let id = '';
    if (idMatch1 && idMatch1[1]) {
      id = idMatch1[1];
    } else if (idMatch2 && idMatch2[1]) {
      id = idMatch2[1];
    }

    let locality = locationMatch && locationMatch[1] ? locationMatch[1] : '';
    let region = locationMatch && locationMatch[2] ? locationMatch[2] : '';

    // Ensure locality and region are not numeric
    if (isNumeric(locality)) locality = '';
    if (isNumeric(region)) region = '';

    let location = '';
    if (locality && region) {
      location = locality + ', ' + region;
    } else if (locality) {
      location = locality;
    } else if (region) {
      location = region;
    }

    return { id: id, location: location };
  } catch (error) {
    console.error('Error: ' + error.message);
    return { id: '', location: '' };
  }
};

const isNumeric = (value) => {
  return !isNaN(value - parseFloat(value));
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getIdAndLocation = async (companyName) => {
  const url = await getCompanyUrl(companyName);
  if (url) {
    const { id, location } = await getCompanyDetails(url);
    return { id, location, url };
  }
  return { id: '', location: '', url: '' };
};

const googleSheetsController = {
  listAllSpreadsheets,
  getSheetHeaders,
  getLastRow,
  getLastColumn,
  getSheetDetails,
  getIdAndLocation,
  getCompanyUrl,
  getCompanyDetails,
  delay
};

module.exports = googleSheetsController;