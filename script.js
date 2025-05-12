class OsuMapPackDownloader {
    constructor() {
        // Constants
        this.BASE_URL = 'https://packs.ppy.sh/S';
        this.DOWNLOAD_DELAY = 1200; // Increased to be more gentle on the server
        this.IFRAME_REMOVAL_DELAY = 5000;
        this.MAX_CONCURRENT_DOWNLOADS = 1; // Always set to 1, no longer configurable
        
        // State variables
        this.totalDownloads = 0;
        this.completedDownloads = 0;
        this.activeDownloads = 0;
        this.statusList = [];
        this.downloadQueue = [];
        this.isProcessing = false;
        
        // DOM Elements
        this.downloadBtn = document.getElementById('downloadBtn');
        this.startInput = document.getElementById('startNumber');
        this.endInput = document.getElementById('endNumber');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.downloadStatusDiv = document.getElementById('downloadStatus');
        this.olderPacksCheckbox = document.getElementById('olderPacks');
        this.delayInput = document.getElementById('downloadDelay');
        
        // Load settings from localStorage
        this.loadSettings();
        
        // Initialize app
        this.initEventListeners();
        this.showDisclaimer();
    }
    
    /**
     * Load saved settings from localStorage
     */
    loadSettings() {
        const savedDelay = localStorage.getItem('downloadDelay');
        if (savedDelay) {
            this.DOWNLOAD_DELAY = parseInt(savedDelay, 10);
            if (this.delayInput) this.delayInput.value = this.DOWNLOAD_DELAY;
        }        
        // Restore last used pack numbers
        const lastStart = localStorage.getItem('lastStartNumber');
        const lastEnd = localStorage.getItem('lastEndNumber');
        if (lastStart && this.startInput) this.startInput.value = lastStart;
        if (lastEnd && this.endInput) this.endInput.value = lastEnd;
    }
    
    /**
     * Save current settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('downloadDelay', this.DOWNLOAD_DELAY);
        localStorage.setItem('lastStartNumber', this.startInput.value);
        localStorage.setItem('lastEndNumber', this.endInput.value);
    }
    
    /**
     * Display a disclaimer to the user
     */
    showDisclaimer() {
        // Check if user has already acknowledged disclaimer
        if (!localStorage.getItem('disclaimerAccepted')) {
            const disclaimer = `
                DISCLAIMER:
                
                This tool helps you download osu! beatmap packs for personal use.
                By using it, you agree to:
                
                1. Only download content you have legitimate access to
                2. Have a valid osu! account
                3. Not overload the osu! servers with excessive requests
                4. Use the downloaded content according to osu!'s terms of service
                
                This tool is provided for educational purposes and personal convenience only.
            `;
            
            if (confirm(disclaimer)) {
                localStorage.setItem('disclaimerAccepted', 'true');
            } else {
                // If user doesn't accept, disable the app
                this.downloadBtn.disabled = true;
                this.updateStatus({
                    status: 'error',
                    message: 'Please accept the disclaimer to use this tool.'
                });
            }
        }
    }
    
    /**
     * Set up event listeners
     */
    initEventListeners() {
        this.downloadBtn.addEventListener('click', () => this.startDownload());
        
        // Add settings event listeners if elements exist
        if (this.delayInput) {
            this.delayInput.addEventListener('change', () => {
                this.DOWNLOAD_DELAY = parseInt(this.delayInput.value, 10);
                this.saveSettings();
            });
        }
    }
    
    /**
     * Begin the download process based on user inputs
     */
    startDownload() {
        const startNum = parseInt(this.startInput.value, 10);
        const endNum = parseInt(this.endInput.value, 10);
        
        // Validate inputs
        if (!this.validateInputs(startNum, endNum)) {
            return;
        }
        
        // Save settings
        this.saveSettings();
        
        // Reset state and UI
        this.resetState(startNum, endNum);
        
        // Fill the download queue
        for (let i = startNum; i <= endNum; i++) {
            this.downloadQueue.push(i);
        }
        
        // Start the download process
        this.processQueue();
    }
    
    /**
     * Process downloads from the queue up to the concurrent limit
     */
    processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        // Process as many downloads as allowed by the concurrent limit
        while (this.downloadQueue.length > 0 && this.activeDownloads < this.MAX_CONCURRENT_DOWNLOADS) {
            const packNumber = this.downloadQueue.shift();
            this.activeDownloads++;
            
            // Start the download with a small staggered delay
            setTimeout(() => {
                this.downloadMapPack(packNumber).finally(() => {
                    this.activeDownloads--;
                    // Continue processing the queue
                    this.isProcessing = false;
                    this.processQueue();
                });
            }, this.activeDownloads * 300); // Stagger the starts
        }
        
        // If queue is empty and no active downloads, we're done
        if (this.downloadQueue.length === 0 && this.activeDownloads === 0) {
            this.finishDownloadProcess();
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Validate user input values
     * @param {Number} startNum - Starting pack number
     * @param {Number} endNum - Ending pack number
     * @returns {Boolean} - Whether inputs are valid
     */
    validateInputs(startNum, endNum) {
        if (isNaN(startNum) || isNaN(endNum)) {
            alert('Please enter valid numbers for both start and end pack numbers.');
            return false;
        }
        
        if (startNum > endNum) {
            alert('Start number must be less than or equal to end number.');
            return false;
        }
        
        // Add a safeguard against downloading too many packs at once
        const totalPacks = endNum - startNum + 1;
        if (totalPacks > 100) {
            const confirm = window.confirm(
                `You're about to download ${totalPacks} packs. This might put load on the osu! servers. Are you sure you want to continue?`
            );
            if (!confirm) return false;
        }
        
        return true;
    }
    
    /**
     * Reset state and UI before starting downloads
     * @param {Number} startNum - Starting pack number
     * @param {Number} endNum - Ending pack number
     */
    resetState(startNum, endNum) {
        this.totalDownloads = endNum - startNum + 1;
        this.completedDownloads = 0;
        this.activeDownloads = 0;
        this.statusList = [];
        this.downloadQueue = [];
        this.downloadStatusDiv.innerHTML = '';
        this.updateProgress(0);
        this.downloadBtn.disabled = true;
    }
    
    /**
     * Complete the download process and update UI
     */
    finishDownloadProcess() {
        this.downloadBtn.disabled = false;
        this.updateStatus({
            packNumber: 0,
            status: 'success',
            message: `All downloads completed.`
        });
    }
    
    /**
     * Download an individual map pack
     * @param {Number} packNumber - The pack number to download
     */
    async downloadMapPack(packNumber) {
        try {
            // Try to determine the correct URL format
            const fileName = await this.findCorrectFileName(packNumber);
            
            if (!fileName) {
                this.handleFailedDownload(packNumber);
            } else {
                this.executeDownload(packNumber, fileName);
            }
        } catch (error) {
            this.updateStatus({
                packNumber,
                status: 'error',
                message: `Error downloading pack #${packNumber}: ${error.message}`
            });
        } finally {
            // Increment counter for progress tracking
            this.completedDownloads++;
            this.updateProgress((this.completedDownloads / this.totalDownloads) * 100);
        }
    }
    
    /**
     * Handle case where download format couldn't be found
     * @param {Number} packNumber - The pack number that failed
     */
    handleFailedDownload(packNumber) {
        this.updateStatus({
            packNumber,
            status: 'error',
            message: `Failed to find the correct format for pack #${packNumber}`
        });
    }
    
    /**
     * Execute the actual download using an iframe
     * @param {Number} packNumber - The pack number to download
     * @param {String} fileName - The determined file name
     */
    executeDownload(packNumber, fileName) {
        this.updateStatus({
            packNumber,
            status: 'success',
            message: `Downloading pack #${packNumber}: ${fileName}`
        });
        
        // Create a hidden iframe for download to avoid navigation issues
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Use the iframe to download
        iframe.src = `${this.BASE_URL}${encodeURIComponent(fileName)}`;
        
        // Remove the iframe after a delay
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, this.IFRAME_REMOVAL_DELAY);
    }
    
    /**
     * Determine the correct filename format to use based on pack number
     * @param {Number} packNumber - The pack number to check
     * @returns {String|null} - The correct filename or null if none found
     */
    async findCorrectFileName(packNumber) {
        // Get possible formats for this pack number
        const formats = this.getPossibleFormats(packNumber);
        
        // Try each format and return the first one that works
        return await this.testFormats(formats);
    }
    
    /**
     * Generate possible file name formats based on pack number
     * @param {Number} packNumber - The pack number to generate formats for
     * @returns {Array} - Array of possible file name formats
     */
    getPossibleFormats(packNumber) {
        const formats = [];
        
        // Based on your provided URLs, we now know:
        // - Packs below 1300 use .7z format
        // - Packs 1300 and above use .zip format
        // - At pack 1347 the naming changes to include "osu!" in the name
        
        if (packNumber < 1300) {
            // Older packs: .7z format
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.7z`);
            
            if (packNumber < 20) {
                // Very old packs might have different naming
                formats.push(`Beatmap Pack #${packNumber}.7z`);
                formats.push(`${packNumber} - Standard Beatmap Pack #${packNumber}.7z`);
            }
        } else if (packNumber < 1347) {
            // Transitional packs: .zip format but same naming convention
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.zip`);
        } else {
            // Newer packs: .zip format with "osu!" in the name
            formats.push(`${packNumber} - osu! Beatmap Pack #${packNumber}.zip`);
        }
        
        // Add fallbacks in case the naming conventions change
        if (packNumber < 1300) {
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.zip`);
        } else if (packNumber < 1347) {
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.7z`);
        } else {
            // For newer packs, try without "osu!" in the name
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.zip`);
            formats.push(`${packNumber} - osu! Beatmap Pack #${packNumber}.7z`);
        }
        
        return formats;
    }
    
    /**
     * Test a series of file name formats to find one that works
     * @param {Array} formats - Array of possible file name formats
     * @returns {String|null} - The first working format or null if none work
     */
    async testFormats(formats) {
        for (const format of formats) {
            const encodedFileName = encodeURIComponent(format);
            const url = `${this.BASE_URL}${encodedFileName}`;
            
            try {
                // Try to fetch headers only to check if file exists
                const response = await fetch(url, { 
                    method: 'HEAD',
                    mode: 'no-cors'  // This is important for cross-origin requests
                });
                
                return format; // If we get here without an error, assume the file exists
            } catch (error) {
                // Continue to next format if this one failed
                continue;
            }
        }
        
        // If we get here, none of the formats worked
        return null;
    }
    
    /**
     * Update the progress bar
     * @param {Number} percent - Percentage complete (0-100)
     */
    updateProgress(percent) {
        const roundedPercent = Math.round(percent);
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${roundedPercent}%`;
    }
    
    /**
     * Add a status message to the status list
     * @param {Object} status - Status object containing message and type
     */
    updateStatus(status) {
        const statusItem = document.createElement('div');
        statusItem.className = `status-item status-${status.status}`;
        statusItem.textContent = status.message;
        this.downloadStatusDiv.appendChild(statusItem);
        statusItem.scrollIntoView();
        
        this.statusList.push(status);
        
        // Log to console for debugging
        console.log(`[${status.status}] ${status.message}`);
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new OsuMapPackDownloader();
});