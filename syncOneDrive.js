const { Client, ResponseType } = require('@microsoft/microsoft-graph-client');
const fs = require('fs');
const path = require('path');

let connectionSettings = null;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('OneDrive not connected');
  }
  return accessToken;
}

async function getOneDriveClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

async function syncExcelFile() {
  console.log(`[${new Date().toISOString()}] Starting OneDrive sync...`);
  
  try {
    const client = await getOneDriveClient();
    
    const searchResults = await client.api('/me/drive/root/search(q=\'LaserBeamExcel.xlsx\')')
      .get();
    
    if (!searchResults.value || searchResults.value.length === 0) {
      console.log('LaserBeamExcel.xlsx not found in OneDrive');
      return;
    }
    
    const file = searchResults.value[0];
    console.log(`Found file: ${file.name} (ID: ${file.id})`);
    
    const fileContent = await client.api(`/me/drive/items/${file.id}/content`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get();
    
    const filePath = path.join(__dirname, 'LaserBeamExcel.xlsx');
    fs.writeFileSync(filePath, Buffer.from(fileContent));
    
    console.log(`[${new Date().toISOString()}] Successfully synced LaserBeamExcel.xlsx from OneDrive`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error syncing from OneDrive:`, error.message);
    throw error;
  }
}

if (require.main === module) {
  syncExcelFile()
    .then(() => {
      console.log('Sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncExcelFile };
