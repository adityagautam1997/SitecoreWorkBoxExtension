document.addEventListener('DOMContentLoaded', function() {
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-keys');
    const statusMessage = document.getElementById('status-message');

    // Load saved settings
    loadSettings();

    // Save settings
    saveSettingsBtn.addEventListener('click', async function() {
        try {
            const devApiKey = document.getElementById('dev-api-key').value.trim();
            const qaApiKey = document.getElementById('qa-api-key').value.trim();
            const prodApiKey = document.getElementById('prod-api-key').value.trim();

            const settings = {
                dev: {
                    apiKey: devApiKey ? await encryptText(devApiKey) : '',
                    domain: document.getElementById('dev-domain').value.trim()
                },
                qa: {
                    apiKey: qaApiKey ? await encryptText(qaApiKey) : '',
                    domain: document.getElementById('qa-domain').value.trim()
                },
                prod: {
                    apiKey: prodApiKey ? await encryptText(prodApiKey) : '',
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
    
    // Helper function to encrypt via background script
    function encryptText(text) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'encrypt', text: text },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Encryption error:', chrome.runtime.lastError);
                        resolve('');
                    } else {
                        resolve(response.result);
                    }
                }
            );
        });
    }

    // Load settings from storage
    function loadSettings() {
        chrome.storage.local.get(['environments'], function(data) {
            const envs = data.environments || {};
            
            if (envs.dev) {
                document.getElementById('dev-api-key').value = envs.dev.apiKey || '';
                document.getElementById('dev-domain').value = envs.dev.domain || '';
            }
            if (envs.qa) {
                document.getElementById('qa-api-key').value = envs.qa.apiKey || '';
                document.getElementById('qa-domain').value = envs.qa.domain || '';
            }
            if (envs.prod) {
                document.getElementById('prod-api-key').value = envs.prod.apiKey || '';
                document.getElementById('prod-domain').value = envs.prod.domain || '';
            }
        });
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