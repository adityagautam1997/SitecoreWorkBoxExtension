(function() {
    // Configuration object for Workbox Helper
    if (typeof window.workboxConfig === 'undefined') {
        window.workboxConfig = {
            observerConfig: { // MutationObserver configuration
                childList: true, // Watch for child node additions/removals
                subtree: true   // Watch all descendants
            },
            workboxSelector: '.scWorkBoxData', // Selector for workbox items
            workboxWrapperSelector: '.scWorkboxContentContainer', // Container selector
            workboxIframeSelector: 'iframe[src*="xmlcontrol=Workbox"]', // Workbox iframe selector
            pathSpanClass: 'scWorkBoxItemPath', // CSS class for path display element
            processedAttribute: 'data-path-processed', // Attribute to mark processed items
            pathLabel: 'Item Path: ', // Label text for path display
            cacheKey: 'workboxItemPaths', // LocalStorage key for cache
            cacheTTL: 24 * 60 * 60 * 1000, // Cache validity duration (24 hours)
            checkInterval: 1000, // Interval for checking workbox presence
            maxChecks: 10, // Maximum number of checks before giving up
            graphQLFields: `
                path
            `
        };
    }

    // Track if workbox has been found and initialized
    let workboxInitialized = false;

    /**
     * Safely access iframe document content
     * @param {HTMLIFrameElement} iframeElement - The iframe to access
     * @returns {Document|null} The iframe's document or null if inaccessible
     */
    function getIframeDocument(iframeElement) {
        try {
            return iframeElement.contentDocument || iframeElement.contentWindow.document;
        } catch (error) {
            console.warn('Cannot access iframe content:', error);
            return null;
        }
    }

    /**
     * Check for Workbox presence in the document
     * @param {Document} [targetDocument=document] - Document to check
     * @returns {boolean} True if workbox is found
     */
    function checkForWorkbox(targetDocument = document) {
        // Check for workbox container directly
        if (targetDocument.querySelector(workboxConfig.workboxWrapperSelector)) {
            return true;
        }
        
        // Check for workbox iframe
        const workboxIframe = targetDocument.querySelector(workboxConfig.workboxIframeSelector);
        if (workboxIframe) {
            try {
                const iframeDoc = getIframeDocument(workboxIframe);
                return iframeDoc ? !!iframeDoc.querySelector(workboxConfig.workboxWrapperSelector) : false;
            } catch (error) {
                console.warn('Error checking iframe content:', error);
                return false;
            }
        }
        
        return false;
    }

    /**
     * Initialize automatic workbox detection
     */
    function initializeAutomaticDetection() {
        // First immediate check
        if (checkForWorkbox()) {
            initializeWorkboxHelper();
            return;
        }

        // Set up periodic checking
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            checkCount++;
            
            if (checkForWorkbox()) {
                clearInterval(checkInterval);
                initializeWorkboxHelper();
            } else if (checkCount >= workboxConfig.maxChecks) {
                clearInterval(checkInterval);
                console.log('Workbox not found after maximum checks');
            }
        }, workboxConfig.checkInterval);

        // Also watch for DOM changes
        const observer = new MutationObserver(() => {
            if (!workboxInitialized && checkForWorkbox()) {
                initializeWorkboxHelper();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Retrieve cached item paths from localStorage
     * @returns {Object} Cache object with items and timestamp
     */
    function retrievePathCache() {
        try {
            const cachedData = localStorage.getItem(workboxConfig.cacheKey);
            if (!cachedData) return { items: {}, timestamp: 0 };
            
            const parsedCache = JSON.parse(cachedData);
            if (typeof Object.values(parsedCache.items)[0] === 'string') {
                const migratedItems = {};
                Object.entries(parsedCache.items).forEach(([id, path]) => {
                    migratedItems[id] = { itemPath: path };
                });
                parsedCache.items = migratedItems;
                storePathCache(parsedCache); // Save migrated format
            }
            return parsedCache;
        } catch (error) {
            console.warn('Error reading cache:', error);
            return { items: {}, timestamp: 0 };
        }
    }

    /**
     * Save item paths to cache in localStorage
     * @param {Object} cacheData - Cache object to store
     */
    function storePathCache(cacheData) {
        try {
            localStorage.setItem(workboxConfig.cacheKey, JSON.stringify({
                items: cacheData.items,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Error saving cache:', error);
        }
    }

    /**
     * Check if cache is still valid based on TTL
     * @param {Object} cacheData - Cache object to validate
     * @returns {boolean} True if cache is still valid
     */
    function isCacheStillValid(cacheData) {
        return (Date.now() - cacheData.timestamp) < workboxConfig.cacheTTL;
    }

    /**
     * Initialize MutationObserver to watch for workbox changes
     * @param {Document} [targetDocument=document] - Document to observe
     * @returns {MutationObserver} The active observer instance
     */
    function initializeDomObserver(targetDocument = document) {
        const workboxContainer = targetDocument.querySelector(workboxConfig.workboxWrapperSelector) || 
                                 targetDocument.body;
        
        const domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    clearTimeout(window.workboxProcessingTimeout);
                    window.workboxProcessingTimeout = setTimeout(() => {
                        processWorkboxItems(targetDocument);
                    }, 300);
                }
            });
        });
        
        domObserver.observe(workboxContainer, workboxConfig.observerConfig);
        return domObserver;
    }

    /**
     * Process workbox items and display their paths
     * @param {Document} [targetDocument=document] - Document containing workbox items
     */
    async function processWorkboxItems(targetDocument = document) {
        const unprocessedItems = targetDocument.querySelectorAll(
            `${workboxConfig.workboxSelector}:not([${workboxConfig.processedAttribute}])`
        );
        
        if (unprocessedItems.length === 0) return;

        const pathCache = retrievePathCache();
        const shouldUseCache = isCacheStillValid(pathCache);
        const cachedItemPaths = {};

        const uncachedItemIds = [];
        const itemsToUpdate = [];

        for (const itemElement of unprocessedItems) {
            const itemContainer = itemElement.querySelector("div");
            const clickHandler = itemContainer?.getAttribute("onclick");
            const itemIdMatch = clickHandler?.match(/\{([A-F0-9-]+)\}/i);

            if (itemIdMatch) {
                const itemId = `{${itemIdMatch[1]}}`;
                
                // Skip if already processed
                if (itemElement.querySelector(`.${workboxConfig.pathSpanClass}`)) {
                    continue;
                }

                // Create path display elements
                const pathDisplay = targetDocument.createElement('div');
                pathDisplay.className = workboxConfig.pathSpanClass;
                Object.assign(pathDisplay.style, {
                    color: '#000',
                    fontSize: '12px',
                    marginTop: '4px'
                });

                const pathLabel = targetDocument.createElement('span');
                pathLabel.textContent = workboxConfig.pathLabel;
                Object.assign(pathLabel.style, {
                    color: '#000',
                    fontWeight: '600',
                    fontSize: '12px'
                });

                const pathValue = targetDocument.createElement('span');
                pathValue.textContent = 'Loading...';
                
                // Assemble display elements
                pathDisplay.appendChild(pathLabel);
                pathDisplay.appendChild(pathValue);
                itemContainer.parentNode.insertBefore(pathDisplay, itemContainer.nextSibling);

                // Mark item as processed
                itemElement.setAttribute(workboxConfig.processedAttribute, 'true');
                
                // Check cache first
                if (shouldUseCache && pathCache.items[itemId]) {
                    cachedItemPaths[itemId] = pathCache.items[itemId];
                    pathValue.textContent = pathCache.items[itemId].itemPath || 'Path not available';
                } else {
                    uncachedItemIds.push(itemId);
                    itemsToUpdate.push({
                        element: itemElement,
                        pathElement: pathValue
                    });
                }
            }
        }

        // Log cache usage
        if (Object.keys(cachedItemPaths).length > 0) {
            console.log(`Used cached paths for ${Object.keys(cachedItemPaths).length} items`);
        }

        // Return if all items were in cache
        if (uncachedItemIds.length === 0) return;

        // Fetch remaining items from API
        try {
            console.log(`Fetching paths for ${uncachedItemIds.length} uncached items`);
            const freshItemPaths = await fetchItemPaths(uncachedItemIds);
            
            // Update cache with new data
            const updatedCache = retrievePathCache();
            Object.entries(freshItemPaths).forEach(([id, itemData]) => {
                updatedCache.items[id] = itemData;
            });
            storePathCache(updatedCache);
            
            // Update UI with fresh paths
            itemsToUpdate.forEach(({ pathElement }, index) => {
                const itemId = uncachedItemIds[index];
                const itemPath = freshItemPaths[itemId]?.itemPath || 'Path not available';
                pathElement.textContent = itemPath;
            });
        } catch (error) {
            console.error('Error loading paths:', error);
            itemsToUpdate.forEach(({ pathElement }) => {
                pathElement.textContent = 'Error loading path';
            });
        }
    }

    /**
     * Get environment API Keys
     */
    function getEnvironmentApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['environments'], (data) => {
                try {
                    if (!data.environments) {
                        console.log('No environments configured');
                        resolve(null);
                        return;
                    }
    
                    const currentHost = window.location.hostname.toLowerCase();
                    
                    const envs = data.environments;
                    let apiKey = null;
    
                    // Extract clean domain from stored URLs
                    const cleanDomain = (url) => {
                        if (!url) return null;
                        // Remove protocol and path
                        return url.replace(/^https?:\/\//, '')
                                  .replace(/\/.*$/, '')
                                  .toLowerCase();
                    };
    
                    // Check environments in priority order
                    if (envs.dev && envs.dev.apiKey) {
                        const devDomain = cleanDomain(envs.dev.domain);
                        if (!devDomain || currentHost === devDomain) {
                            apiKey = envs.dev.apiKey;
                        }
                    }
                    
                    if (!apiKey && envs.qa && envs.qa.apiKey) {
                        const qaDomain = cleanDomain(envs.qa.domain);
                        if (!qaDomain || currentHost === qaDomain) {
                            apiKey = envs.qa.apiKey;
                        }
                    }
                    
                    if (!apiKey && envs.prod && envs.prod.apiKey) {
                        const prodDomain = cleanDomain(envs.prod.domain);
                        if (!prodDomain || currentHost === prodDomain) {
                            apiKey = envs.prod.apiKey;
                        }
                    }
                    resolve(apiKey);
                } catch (error) {
                    console.error('Error in getEnvironmentApiKey:', error);
                    resolve(null);
                }
            });
        });
    }
    
    // Decrypt function
    function Decrypt(encryptedText) {
        return new Promise((resolve) => {
            if (!encryptedText) {
                resolve('');
                return;
            }
            
            chrome.runtime.sendMessage(
                { action: 'decrypt', text: encryptedText },
                (response) => {
                    if (chrome.runtime.lastError || !response || response.error) {
                        console.error('Decryption failed:', chrome.runtime.lastError || response.error);
                        resolve('');
                    } else {
                        resolve(response.result);
                    }
                }
            );
        });
    }
    async function fetchWithTimeout(url, options, timeout = 1000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }
    /**
     * Fetch item paths from Sitecore GraphQL API
     * @param {string[]} itemIds - Array of item IDs to fetch
     * @returns {Promise<Object>} Map of item IDs to their paths
     */
    async function fetchItemPaths(itemIds) {
        const sitecoreHost = window.location.origin;
        
        // Get the API key for current environment
        const apiKey = await getEnvironmentApiKey();
              
        if (!apiKey) {
            console.error('No API key found for this environment');
            return {};
        }
        
        const decryptedApiKey = await Decrypt(apiKey);
        if (!decryptedApiKey) {
            console.error('Failed to decrypt API key');
            return {};
        }
        
        const itemQueries = itemIds.map((id, index) => `
            item${index}: item(path: "${id}", language: "en") {
                ${workboxConfig.graphQLFields}
            }
        `).join('\n');
        
        const graphqlQuery = `query { ${itemQueries} }`;
    
        try {
            const apiResponse = await fetchWithTimeout(
                `${sitecoreHost}/sitecore/api/graph/edge?sc_apikey=${decryptedApiKey}`, 
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ query: graphqlQuery })
                },2000
            );
            
            if (!apiResponse.ok) {
                const errorData = await apiResponse.json().catch(() => ({}));
                console.error('API Error Details:', {
                    status: apiResponse.status,
                    statusText: apiResponse.statusText,
                    url: apiResponse.url,
                    errorData
                });
                throw new Error(`API request failed: ${apiResponse.status} - ${apiResponse.statusText}`);
            }
    
            const { data, errors } = await apiResponse.json();
            
            if (errors) {
                console.error('GraphQL Errors:', errors);
                throw new Error('GraphQL query errors occurred');
            }
            
            const itemDataMapping = {};
            itemIds.forEach((id, index) => {
                const queryKey = `item${index}`;
                const itemData = data[queryKey] || {};
                itemDataMapping[id] = {
                    itemPath: itemData.path || 'Path not available',
                };
            });
            return itemDataMapping;
        } catch (error) {
            console.error('Fetch Error:', error);
            throw error;
        }
    }

    /**
     * Clear expired cache on initialization
     */
    function cleanupExpiredCache() {
        const currentCache = retrievePathCache();
        if (!isCacheStillValid(currentCache)) {
            console.log('Clearing expired cache');
            localStorage.removeItem(workboxConfig.cacheKey);
        }
    }

    /**
     * Main initialization function for the Workbox helper
     */
    function initializeWorkboxHelper() {
        if (workboxInitialized) return;
        
        cleanupExpiredCache();
        
        // Process items in main document
        processWorkboxItems();
        initializeDomObserver();

        // Check for nested Workbox iframe
        const workboxIframe = document.querySelector(workboxConfig.workboxIframeSelector);
        if (workboxIframe) {
            try {
                const iframeDoc = getIframeDocument(workboxIframe);
                if (iframeDoc && checkForWorkbox(iframeDoc)) {
                    processWorkboxItems(iframeDoc);
                    initializeDomObserver(iframeDoc);
                }
            } catch (error) {
                console.error('Error accessing iframe content:', error);
            }
        }

        workboxInitialized = true;
    }

    // Start automatic detection when DOM is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeAutomaticDetection();
    } else {
        document.addEventListener('DOMContentLoaded', initializeAutomaticDetection);
    }
})();