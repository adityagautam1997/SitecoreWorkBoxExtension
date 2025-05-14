document.addEventListener('DOMContentLoaded', function() {
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-keys');
    const statusMessage = document.getElementById('status-message');
    const ENCRYPTION_KEY = 'FhxImvR3U4uIZUSR';
    // Load saved settings
    loadSettings();

    // Save settings
    saveSettingsBtn.addEventListener('click', async function() {
        try {
            const settings = {
                dev: {
                    apiKey: encryptString(document.getElementById('dev-api-key').value.trim()),
                    domain: document.getElementById('dev-domain').value.trim()
                },
                qa: {
                    apiKey: encryptString(document.getElementById('qa-api-key').value.trim()),
                    domain: document.getElementById('qa-domain').value.trim()
                },
                prod: {
                    apiKey: encryptString(document.getElementById('prod-api-key').value.trim()),
                    domain: document.getElementById('prod-domain').value.trim()
                }
            };
                
            // Save to chrome.storage.local
            await chrome.storage.local.set({ environments: settings });
            showStatus('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('Error saving settings', 'error');
        }
    });
     
    // Reset settings
    resetSettingsBtn.addEventListener('click', async function() {
        try {
            // Clear all input fields
            document.getElementById('dev-api-key').value = '';
            document.getElementById('dev-domain').value = '';
            document.getElementById('qa-api-key').value = '';
            document.getElementById('qa-domain').value = '';
            document.getElementById('prod-api-key').value = '';
            document.getElementById('prod-domain').value = '';
            
            // Clear storage
            await chrome.storage.local.remove('environments');
            showStatus('Settings reset successfully!', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            showStatus('Error resetting settings', 'error');
        }
    });
    
    // Load settings from storage
    function loadSettings() {
        chrome.storage.local.get(['environments'], function(data) {
            const envs = data.environments || {};
            
            if (envs.dev) {
                document.getElementById('dev-api-key').value = envs.dev.apiKey ? decryptString(envs.dev.apiKey) : '';
                document.getElementById('dev-domain').value = envs.dev.domain || '';
            }
            if (envs.qa) {
                document.getElementById('qa-api-key').value = envs.qa.apiKey ? decryptString(envs.qa.apiKey) : '';
                document.getElementById('qa-domain').value = envs.qa.domain || '';
            }
            if (envs.prod) {
                document.getElementById('prod-api-key').value = envs.prod.apiKey ? decryptString(envs.prod.apiKey) : '';
                document.getElementById('prod-domain').value = envs.prod.domain || '';
            }
        });
    }
    // Encryption function
    function encryptString(str) {
        if (!str) return '';
        return CryptoJS.AES.encrypt(str, ENCRYPTION_KEY).toString();
    }

    // Decryption function
    function decryptString(encryptedStr) {
        if (!encryptedStr) return '';
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedStr, ENCRYPTION_KEY);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.error('Decryption error:', e);
            return '';
        }
    }

    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status ' + type;
        setTimeout(() => {
            statusMessage.className = 'status';
            statusMessage.textContent = '';
        }, 3000);
    }
});