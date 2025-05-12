class OsuMapPackDownloader {
    constructor() {
        this.BASE_URL = 'https://packs.ppy.sh/S';
        this.totalDownloads = 0;
        this.completedDownloads = 0;
        this.statusList = [];
        this.downloadBtn = document.getElementById('downloadBtn');
        this.startInput = document.getElementById('startNumber');
        this.endInput = document.getElementById('endNumber');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.downloadStatusDiv = document.getElementById('downloadStatus');
        this.olderPacksCheckbox = document.getElementById('olderPacks');
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.downloadBtn.addEventListener('click', () => this.startDownload());
    }
    
    startDownload() {
        const startNum = parseInt(this.startInput.value, 10);
        const endNum = parseInt(this.endInput.value, 10);
        
        if (isNaN(startNum) || isNaN(endNum)) {
            alert('Please enter valid numbers for both start and end pack numbers.');
            return;
        }
        
        if (startNum > endNum) {
            alert('Start number must be less than or equal to end number.');
            return;
        }
        
        this.totalDownloads = endNum - startNum + 1;
        this.completedDownloads = 0;
        this.statusList = [];
        this.downloadStatusDiv.innerHTML = '';
        this.updateProgress(0);
        this.downloadBtn.disabled = true;
        
        // Process downloads sequentially to avoid overwhelming the browser
        this.processDownloads(startNum, endNum);
    }
    
    // Process downloads one by one to avoid too many simultaneous requests
    async processDownloads(current, end) {
        if (current > end) {
            this.downloadBtn.disabled = false;
            this.updateStatus({
                packNumber: 0,
                status: 'success',
                message: `All downloads completed.`
            });
            return;
        }
        
        await this.downloadMapPack(current);
        
        // Process next download with a small delay
        setTimeout(() => {
            this.processDownloads(current + 1, end);
        }, 800);
    }
    
    async downloadMapPack(packNumber) {
        // Try to determine the correct URL format by checking multiple possibilities
        const fileName = await this.findCorrectFileName(packNumber);
        
        if (!fileName) {
            this.updateStatus({
                packNumber,
                status: 'error',
                message: `Failed to find the correct format for pack #${packNumber}`
            });
        } else {
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
            }, 5000);
        }
        
        // Increment counter for progress tracking
        this.completedDownloads++;
        this.updateProgress((this.completedDownloads / this.totalDownloads) * 100);
    }
    
    async findCorrectFileName(packNumber) {
        // Based on your samples, we can test formats in order of likelihood
        const formats = [];
        
        // Most likely format based on pack number
        if (packNumber < 1347) {
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.7z`);
            if (packNumber < 20) {
                // Very old packs might have different naming
                formats.push(`Beatmap Pack #${packNumber}.7z`);
                formats.push(`${packNumber} - Standard Beatmap Pack #${packNumber}.7z`);
            }
        } else {
            formats.push(`${packNumber} - osu! Beatmap Pack #${packNumber}.zip`);
        }
        
        // Try less likely formats as fallbacks
        if (packNumber < 1347) {
            formats.push(`${packNumber} - Beatmap Pack #${packNumber}.zip`);
        } else {
            formats.push(`${packNumber} - osu! Beatmap Pack #${packNumber}.7z`);
        }
        
        // Try each format and return the first one that works
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
    
    updateProgress(percent) {
        const roundedPercent = Math.round(percent);
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${roundedPercent}%`;
    }
    
    updateStatus(status) {
        const statusItem = document.createElement('div');
        statusItem.className = `status-item status-${status.status}`;
        statusItem.textContent = status.message;
        this.downloadStatusDiv.appendChild(statusItem);
        statusItem.scrollIntoView();
        
        this.statusList.push(status);
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new OsuMapPackDownloader();
});