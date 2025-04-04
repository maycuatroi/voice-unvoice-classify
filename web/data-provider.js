// data-provider.js
// Manages audio data and provides an interface between processors and visualization

class DataProvider {
    constructor() {
        // Data history
        this.waveformHistory = [];
        this.zcrHistory = [];
        this.energyHistory = [];
        this.classificationHistory = [];
        
        // Current values
        this.currentZcr = 0;
        this.currentEnergy = 0;
        this.currentClassification = 0; // 0: silence, 1: voiced, -1: unvoiced
        
        // FFT data
        this.fftData = new Float32Array(1024); // Default size, will be updated
        
        // State
        this.isActive = false;
        this.audioContext = null;
    }
    
    // Initialize the data provider
    initialize(audioContext) {
        this.audioContext = audioContext;
        this.isActive = !!audioContext;
        
        // Clear histories
        this.waveformHistory = [];
        this.zcrHistory = [];
        this.energyHistory = [];
        this.classificationHistory = [];
    }
    
    // Handle feature updates from audio processors
    handleFeatures(features) {
        if (!this.isActive) return;
        
        const { waveformData, zcr, energy, classification, fftData } = features;
        
        // Add to histories - only if the data is present
        if (waveformData !== undefined) {
            this.waveformHistory.push(waveformData);
        }
        
        if (zcr !== undefined) {
            this.zcrHistory.push(zcr);
            // Update current value
            this.currentZcr = zcr;
        }
        
        if (energy !== undefined) {
            this.energyHistory.push(energy);
            // Update current value
            this.currentEnergy = energy;
        }
        
        if (classification !== undefined) {
            this.classificationHistory.push(classification);
            // Update current value
            this.currentClassification = classification;
        }
        
        if (fftData) {
            this.fftData = fftData; // We only need the most recent FFT data
        }
        
        // Only limit history length if we have waveform data
        if (waveformData !== undefined && this.waveformHistory.length > 0) {
            // Limit history length based on historyLength parameter (in seconds)
            this.limitHistoryLength();
        }
    }
    
    // Limit the history length based on time duration
    limitHistoryLength(historyLength = 3) {
        if (!this.audioContext || this.waveformHistory.length === 0) return;
        
        // Add safety check for first element
        if (!this.waveformHistory[0] || typeof this.waveformHistory[0].length !== 'number') {
            console.warn('Invalid waveform data found. Removing.', this.waveformHistory[0]);
            this.waveformHistory.shift();
            return;
        }
        
        const bufferSize = this.waveformHistory[0].length;
        const maxHistoryFrames = Math.ceil(historyLength * this.audioContext.sampleRate / bufferSize);
        
        while (this.waveformHistory.length > maxHistoryFrames) {
            // Make sure we have data to shift
            if (this.waveformHistory.length > 0) this.waveformHistory.shift();
            if (this.zcrHistory.length > 0) this.zcrHistory.shift();
            if (this.energyHistory.length > 0) this.energyHistory.shift();
            if (this.classificationHistory.length > 0) this.classificationHistory.shift();
        }
    }
    
    // Update the history length (called when the UI slider changes)
    updateHistoryLength(historyLength) {
        // Safety checks
        if (!this.isActive || !this.audioContext || this.waveformHistory.length === 0) return;
        
        // Make sure we have valid waveform data
        if (!this.waveformHistory[0] || typeof this.waveformHistory[0].length !== 'number') {
            console.warn('Invalid waveform data found in updateHistoryLength');
            return;
        }
        
        // Keep applying the limit until we're within the new length
        while (this.waveformHistory.length > 0 && 
               this.waveformHistory.length > Math.ceil(historyLength * this.audioContext.sampleRate / this.waveformHistory[0].length)) {
            this.limitHistoryLength(historyLength);
        }
    }
    
    // Get all data for visualization
    getData() {
        return {
            isActive: this.isActive,
            waveformHistory: this.waveformHistory,
            zcrHistory: this.zcrHistory,
            energyHistory: this.energyHistory,
            classificationHistory: this.classificationHistory,
            currentZcr: this.currentZcr,
            currentEnergy: this.currentEnergy,
            currentClassification: this.currentClassification,
            fftData: this.fftData
        };
    }
    
    // Get data for export
    getExportData(parameters = {}) {
        return {
            timestamp: new Date().toISOString(),
            parameters: {
                sampleRate: this.audioContext ? this.audioContext.sampleRate : 0,
                ...parameters
            },
            samples: this.zcrHistory.map((zcr, i) => ({
                zcr,
                energy: this.energyHistory[i],
                classification: this.classificationHistory[i]
            }))
        };
    }
    
    // Clear all data when stopped
    clear() {
        this.waveformHistory = [];
        this.zcrHistory = [];
        this.energyHistory = [];
        this.classificationHistory = [];
        this.currentZcr = 0;
        this.currentEnergy = 0;
        this.currentClassification = 0;
        this.isActive = false;
        this.audioContext = null;
    }
}

export { DataProvider }; 