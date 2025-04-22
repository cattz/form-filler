// Form Autofiller Assistant - Background Service Worker

// Listen for installation
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Initialize storage with default values
    chrome.storage.local.set({
      identities: [],
      domainMappings: {},
      generalMappings: {},
      debugMode: false
    }, () => {
      console.log('Form Autofiller Assistant installed and initialized');
    });
  }
});

// Optional: Listen for tab updates to detect new URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // We could notify the content script that the page has loaded
    // but this is usually not necessary as the content script
    // will execute automatically on page load
  }
});

// Optional: Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'log' && message.data) {
    console.log('[Form Autofiller]', message.data);
    sendResponse({ success: true });
  }
  
  return true; // Indicates we will respond asynchronously
});