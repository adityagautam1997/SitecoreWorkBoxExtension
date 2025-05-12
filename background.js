importScripts('crypto-js-min.js');

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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const secretBytes = CryptoJS.enc.Utf8.parse("?sv/e{7I88tS~y6:");
    
    if (request.action === 'encrypt') {
        const encrypted = CryptoJS.AES.encrypt(request.text, secretBytes, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        }).toString();
        sendResponse({ result: encrypted });
    }
    else if (request.action === 'decrypt') {
        try {
            const decrypted = CryptoJS.AES.decrypt(request.text, secretBytes, {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            }).toString(CryptoJS.enc.Utf8);
            sendResponse({ result: decrypted });
        } catch (e) {
            sendResponse({ error: "Decryption failed" });
        }
    }
    return true; 
});
