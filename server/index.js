const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const cheerio = require('cheerio');

// URL to fetch proxies
const proxyApiUrl = 'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc';

let proxies = [];

// Fetch proxies from the API
const fetchProxies = async () => {
  try {
    const response = await axios.get(proxyApiUrl);
    proxies = response.data.data.map(proxy => `${proxy.protocols[0]}://${proxy.ip}:${proxy.port}`);
  } catch (error) {
    console.error('Error fetching proxies:', error.message);
  }
};

// Get a random proxy
const getRandomProxy = () => {
  if (proxies.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
};

// Rotate user-agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/89.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.64'
];

// Get a random user-agent
const getRandomUserAgent = () => {
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
};

// Delay function to mimic human behavior
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to fetch and extract data
const fetchAndExtractData = async (query) => {
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);

  for (let attempt = 0; attempt < 3; attempt++) {
    const proxy = getRandomProxy();
    const userAgent = getRandomUserAgent();
    const options = {
      headers: {
        'User-Agent': userAgent
      }
    };

    if (proxy) {
      options.httpsAgent = new HttpsProxyAgent(proxy);
    }

    await delay(Math.random() * 5000 + 5000); // Delay between 5 to 10 seconds

    try {
      const response = await axios.get(url, options);
      const html = response.data;
      const urls = extractLinkedInUrlsFromHtml(html);
      if (urls.length > 0) {
        return urls;
      }
    } catch (e) {
      console.error('Error fetching URL:', e.message);
    }
  }

  console.log('Failed to fetch data after 3 attempts.');
  return [];
};

// Extract LinkedIn URLs from HTML
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

// Initialize and fetch proxies
(async () => {
  await fetchProxies(); // Fetch proxies once at the start

  const query = 'OpenAI company LinkedIn profile URL';
  const urls = await fetchAndExtractData(query);
  console.log('Extracted URLs:', urls);
})();