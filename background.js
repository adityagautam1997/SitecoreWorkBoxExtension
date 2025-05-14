// Background service worker for extension management
chrome.runtime.onInstalled.addListener(() => {
    console.log('Sitecore Workbox Helper installed');
    
    // Set empty environments if they don't exist
    chrome.storage.local.get(['environments'], function(data) {
        if (!data.environments) {
            chrome.storage.local.set({
                environments: {
                    dev: { apiKey: '', domain: '' },
                    qa: { apiKey: '', domain: '' },
                    prod: { apiKey: '', domain: '' }
                }
            });
        }
    });
});