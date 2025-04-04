// visualizer.js
// Class to handle all visualization and canvas drawing

class Visualizer {
    constructor(options = {}) {
        // Canvas elements
        this.waveformCanvas = options.waveformCanvas;
        this.zcrCanvas = options.zcrCanvas;
        this.energyCanvas = options.energyCanvas;
        this.classificationCanvas = options.classificationCanvas;
        
        // FFT canvas
        this.fftCanvas = options.fftCanvas;
        
        // Canvas contexts
        this.waveformCtx = this.waveformCanvas ? this.waveformCanvas.getContext('2d') : null;
        this.zcrCtx = this.zcrCanvas ? this.zcrCanvas.getContext('2d') : null;
        this.energyCtx = this.energyCanvas ? this.energyCanvas.getContext('2d') : null;
        this.classificationCtx = this.classificationCanvas ? this.classificationCanvas.getContext('2d') : null;
        this.fftCtx = this.fftCanvas ? this.fftCanvas.getContext('2d') : null;
        
        // Display elements
        this.currentZcrElement = options.currentZcrElement;
        this.currentEnergyElement = options.currentEnergyElement;
        this.currentClassificationElement = options.currentClassificationElement;
        
        // Parameter elements
        this.zcrThresholdInput = options.zcrThresholdInput;
        this.energyThresholdInput = options.energyThresholdInput;
        
        // Visualization state control
        this.isPaused = false;
        this.animationFrameId = null;
        
        // Bind methods to preserve 'this' context
        this.resizeCanvases = this.resizeCanvases.bind(this);
        this.updateVisualization = this.updateVisualization.bind(this);
        this.togglePause = this.togglePause.bind(this);
        
        // Initialize canvas sizes
        this.resizeCanvases();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.resizeCanvases);
        }
    }
    
    // Set canvas sizes
    resizeCanvases() {
        const canvases = [
            this.waveformCanvas, 
            this.zcrCanvas, 
            this.energyCanvas, 
            this.classificationCanvas,
            this.fftCanvas
        ].filter(canvas => canvas);
        
        canvases.forEach(canvas => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        });
    }
    
    // Toggle pause state for visualization
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }
    
    // Start visualization loop
    start(dataProvider) {
        this.dataProvider = dataProvider;
        this.stop(); // Stop any existing animation
        this.animationFrameId = requestAnimationFrame(this.updateVisualization);
    }
    
    // Stop visualization loop
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    // Main visualization update function
    updateVisualization() {
        if (!this.dataProvider) {
            this.animationFrameId = requestAnimationFrame(this.updateVisualization);
            return;
        }
        
        // Get current data from provider
        const {
            isActive,
            waveformHistory,
            zcrHistory,
            energyHistory,
            classificationHistory,
            currentZcr,
            currentEnergy,
            currentClassification,
            fftData
        } = this.dataProvider.getData();
        
        if (!isActive) {
            this.animationFrameId = requestAnimationFrame(this.updateVisualization);
            return;
        }
        
        // Only update visuals if not paused
        if (!this.isPaused) {
            // Draw waveform
            if (this.waveformCtx && this.waveformCanvas) {
                this.drawWaveform(waveformHistory);
            }
            
            // Draw ZCR
            if (this.zcrCtx && this.zcrCanvas) {
                this.drawZCR(zcrHistory);
            }
            
            // Draw energy
            if (this.energyCtx && this.energyCanvas) {
                this.drawEnergy(energyHistory);
            }
            
            // Draw classification
            if (this.classificationCtx && this.classificationCanvas) {
                this.drawClassification(classificationHistory);
            }
            
            // Draw FFT
            if (this.fftCtx && this.fftCanvas) {
                this.drawFFT(fftData);
            }
        }
        
        // Always update current value displays even when paused
        this.updateValueDisplays(currentZcr, currentEnergy, currentClassification);
        
        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.updateVisualization);
    }
    
    // Update numerical value displays
    updateValueDisplays(zcr, energy, classification) {
        if (this.currentZcrElement) {
            this.currentZcrElement.textContent = `ZCR: ${Math.round(zcr)}`;
        }
        
        if (this.currentEnergyElement) {
            this.currentEnergyElement.textContent = `Energy: ${energy.toFixed(5)}`;
        }
        
        if (this.currentClassificationElement) {
            let classText = "Classification: ";
            if (classification === 1) {
                classText += "Voiced";
                this.currentClassificationElement.style.color = "#3498db";
            } else if (classification === -1) {
                classText += "Unvoiced";
                this.currentClassificationElement.style.color = "#e74c3c";
            } else {
                classText += "Silence";
                this.currentClassificationElement.style.color = "#95a5a6";
            }
            this.currentClassificationElement.textContent = classText;
        }
    }
    
    // Draw waveform from history
    drawWaveform(waveformHistory) {
        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;
        
        this.waveformCtx.clearRect(0, 0, width, height);
        this.waveformCtx.beginPath();
        this.waveformCtx.strokeStyle = '#3498db';
        this.waveformCtx.lineWidth = 1.5;
        
        // Draw center line
        this.waveformCtx.beginPath();
        this.waveformCtx.strokeStyle = '#95a5a6';
        this.waveformCtx.lineWidth = 1;
        this.waveformCtx.moveTo(0, height / 2);
        this.waveformCtx.lineTo(width, height / 2);
        this.waveformCtx.stroke();
        
        if (!waveformHistory || waveformHistory.length === 0) return;
        
        // Combine all buffers in history to display continuously
        const totalSamples = waveformHistory.reduce((sum, buffer) => sum + buffer.length, 0);
        const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));
        
        this.waveformCtx.beginPath();
        this.waveformCtx.strokeStyle = '#3498db';
        this.waveformCtx.lineWidth = 1.5;
        
        let pixelX = 0;
        let sampleIdx = 0;
        let bufferIdx = 0;
        let buffer = waveformHistory[0];
        let localIdx = 0;
        
        for (let x = 0; x < width && pixelX < width; x++) {
            let minVal = 1.0;
            let maxVal = -1.0;
            
            // Process samples for this pixel
            for (let j = 0; j < samplesPerPixel; j++) {
                // If we've exhausted the current buffer, move to the next one
                if (localIdx >= buffer.length) {
                    bufferIdx++;
                    if (bufferIdx < waveformHistory.length) {
                        buffer = waveformHistory[bufferIdx];
                        localIdx = 0;
                    } else {
                        break;
                    }
                }
                
                const sample = buffer[localIdx++];
                if (sample < minVal) minVal = sample;
                if (sample > maxVal) maxVal = sample;
                
                sampleIdx++;
                if (sampleIdx >= totalSamples) break;
            }
            
            // Draw a line from min to max for this pixel
            const y1 = ((minVal + 1) / 2) * height;
            const y2 = ((maxVal + 1) / 2) * height;
            
            this.waveformCtx.moveTo(pixelX, y1);
            this.waveformCtx.lineTo(pixelX, y2);
            
            pixelX++;
            
            if (sampleIdx >= totalSamples) break;
        }
        
        this.waveformCtx.stroke();
    }
    
    // Draw Zero-Crossing Rate history
    drawZCR(zcrHistory) {
        const width = this.zcrCanvas.width;
        const height = this.zcrCanvas.height;
        const zcrThreshold = parseFloat(this.zcrThresholdInput ? this.zcrThresholdInput.value : 35);
        
        this.zcrCtx.clearRect(0, 0, width, height);
        
        if (!zcrHistory || zcrHistory.length === 0) return;
        
        // Find max ZCR for scaling
        const maxZCR = Math.max(...zcrHistory, zcrThreshold * 2);
        
        // Draw threshold line
        this.zcrCtx.beginPath();
        this.zcrCtx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        this.zcrCtx.lineWidth = 1;
        const thresholdY = height - (zcrThreshold / maxZCR * height);
        this.zcrCtx.moveTo(0, thresholdY);
        this.zcrCtx.lineTo(width, thresholdY);
        this.zcrCtx.stroke();
        
        // Draw ZCR history
        this.zcrCtx.beginPath();
        this.zcrCtx.strokeStyle = '#3498db';
        this.zcrCtx.lineWidth = 2;
        
        const stepX = width / zcrHistory.length;
        
        zcrHistory.forEach((zcr, i) => {
            const x = i * stepX;
            const y = height - (zcr / maxZCR * height);
            
            if (i === 0) {
                this.zcrCtx.moveTo(x, y);
            } else {
                this.zcrCtx.lineTo(x, y);
            }
        });
        
        this.zcrCtx.stroke();
    }
    
    // Draw Energy history
    drawEnergy(energyHistory) {
        const width = this.energyCanvas.width;
        const height = this.energyCanvas.height;
        const energyThreshold = parseFloat(this.energyThresholdInput ? this.energyThresholdInput.value : 0.002);
        
        this.energyCtx.clearRect(0, 0, width, height);
        
        if (!energyHistory || energyHistory.length === 0) return;
        
        // Find max energy for scaling
        const maxEnergy = Math.max(...energyHistory, energyThreshold * 10);
        
        // Draw threshold line
        this.energyCtx.beginPath();
        this.energyCtx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        this.energyCtx.lineWidth = 1;
        const thresholdY = height - (energyThreshold / maxEnergy * height);
        this.energyCtx.moveTo(0, thresholdY);
        this.energyCtx.lineTo(width, thresholdY);
        this.energyCtx.stroke();
        
        // Draw energy history
        this.energyCtx.beginPath();
        this.energyCtx.strokeStyle = '#27ae60';
        this.energyCtx.lineWidth = 2;
        
        const stepX = width / energyHistory.length;
        
        energyHistory.forEach((energy, i) => {
            const x = i * stepX;
            const y = height - (energy / maxEnergy * height);
            
            if (i === 0) {
                this.energyCtx.moveTo(x, y);
            } else {
                this.energyCtx.lineTo(x, y);
            }
        });
        
        this.energyCtx.stroke();
    }
    
    // Draw Classification history
    drawClassification(classificationHistory) {
        const width = this.classificationCanvas.width;
        const height = this.classificationCanvas.height;
        
        this.classificationCtx.clearRect(0, 0, width, height);
        
        if (!classificationHistory || classificationHistory.length === 0) return;
        
        const stepX = width / classificationHistory.length;
        
        classificationHistory.forEach((classification, i) => {
            const x = i * stepX;
            const barWidth = stepX + 1; // Slight overlap to avoid gaps
            
            if (classification === 1) {
                // Voiced - Blue
                this.classificationCtx.fillStyle = '#3498db';
            } else if (classification === -1) {
                // Unvoiced - Red
                this.classificationCtx.fillStyle = '#e74c3c';
            } else {
                // Silence - Gray
                this.classificationCtx.fillStyle = '#95a5a6';
            }
            
            this.classificationCtx.fillRect(x, 0, barWidth, height);
        });
    }
    
    // Draw FFT spectrum
    drawFFT(fftData) {
        if (!this.fftCtx || !this.fftCanvas || !fftData) return;
        
        const width = this.fftCanvas.width;
        const height = this.fftCanvas.height;
        
        this.fftCtx.clearRect(0, 0, width, height);
        
        // Check if dark mode is active
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Create gradient for the bars - using a richer spectrum for better visual distinction
        const gradient = this.fftCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#3498db');    // Blue for low amplitudes
        gradient.addColorStop(0.3, '#2ecc71');  // Green for medium-low
        gradient.addColorStop(0.6, '#f39c12');  // Orange for medium-high
        gradient.addColorStop(1, '#e74c3c');    // Red for high amplitudes
        
        this.fftCtx.fillStyle = gradient;
        
        // Calculate how many FFT bins to show
        // We'll limit to the first 10kHz which contains most speech information
        const maxFreq = 10000;
        const sampleRate = 48000; // Using the actual sample rate you specified
        const maxBin = Math.min(fftData.length, Math.floor(maxFreq / (sampleRate / 2 / fftData.length)));
        
        // Bar width based on how many bins we're showing
        const barWidth = width / maxBin;
        
        // Draw speech frequency bands in the background first
        this.addFrequencyBandIndicators();
        
        // Draw each frequency bin as a bar
        for (let i = 0; i < maxBin; i++) {
            // Get normalized magnitude (should be 0-1)
            let magnitude = fftData[i];
            
            // Make sure it's within range
            magnitude = Math.max(0, Math.min(1, magnitude));
            
            // Apply a slight logarithmic scaling to emphasize smaller values
            // This helps visualize weaker frequency components in speech
            const logFactor = 0.3; // Adjust for more/less logarithmic effect
            const scaledMagnitude = logFactor * Math.log10(1 + 9 * magnitude);
            
            const barHeight = scaledMagnitude * height;
            const x = i * barWidth;
            const y = height - barHeight;
            
            this.fftCtx.fillRect(x, y, barWidth - 1, barHeight);
        }
        
        // Add frequency axis labels
        const textColor = isDarkMode ? '#ecf0f1' : '#333';
        const bgColor = isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)';
        
        this.fftCtx.font = '10px Arial';
        this.fftCtx.textAlign = 'center';
        
        // Draw frequency markers optimized for speech frequencies
        const frequencies = [250, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];
        frequencies.forEach(freq => {
            const bin = Math.floor(freq / (sampleRate / 2 / fftData.length));
            if (bin < maxBin) {
                const x = bin * barWidth;
                
                // Draw a background behind text for better contrast
                const text = `${freq < 1000 ? freq : (freq/1000)+'k'}`;
                const textWidth = this.fftCtx.measureText(text).width;
                this.fftCtx.fillStyle = bgColor;
                this.fftCtx.fillRect(x - textWidth/2 - 2, height - 18, textWidth + 4, 14);
                this.fftCtx.fillStyle = textColor;
                this.fftCtx.fillText(text, x, height - 7);
            }
        });
    }
    
    // Add indicators for speech-relevant frequency bands
    addFrequencyBandIndicators() {
        if (!this.fftCtx || !this.fftCanvas) return;
        
        const width = this.fftCanvas.width;
        const height = this.fftCanvas.height;
        const sampleRate = 48000;
        
        // Define important speech frequency bands
        const bands = [
            { name: "F0", min: 80, max: 255, color: "rgba(255,105,180,0.1)", desc: "Pitch" },
            { name: "F1", min: 300, max: 800, color: "rgba(100,149,237,0.1)", desc: "Vowel" },
            { name: "F2", min: 850, max: 2500, color: "rgba(46,204,113,0.1)", desc: "Vowel quality" },
            { name: "F3", min: 2500, max: 3500, color: "rgba(241,196,15,0.1)", desc: "Voice quality" },
            { name: "Consonants", min: 3500, max: 8000, color: "rgba(231,76,60,0.1)", desc: "Consonants" }
        ];
        
        // Calculate bin width for the 10kHz range
        const maxFreq = 10000;
        const maxBin = Math.floor(maxFreq / (sampleRate / 2 / 1024));
        const barWidth = width / maxBin;
        
        // Draw frequency bands
        bands.forEach(band => {
            const binStart = Math.floor(band.min / (sampleRate / 2 / 1024));
            const binEnd = Math.floor(band.max / (sampleRate / 2 / 1024));
            
            // Draw band background
            this.fftCtx.fillStyle = band.color;
            this.fftCtx.fillRect(binStart * barWidth, 0, (binEnd - binStart) * barWidth, height);
            
            // Add band label at the top
            const isDarkMode = document.body.classList.contains('dark-mode');
            this.fftCtx.fillStyle = isDarkMode ? "#ecf0f1" : "#333";
            this.fftCtx.font = "10px Arial";
            this.fftCtx.textAlign = "center";
            const labelX = (binStart + (binEnd - binStart) / 2) * barWidth;
            this.fftCtx.fillText(band.name, labelX, 10);
        });
    }
    
    // Clean up resources
    dispose() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.resizeCanvases);
        }
        this.stop();
    }
}

export { Visualizer }; 