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
        
        const { waveformData, zcr, energy, classification } = features;
        
        // Add to histories
        this.waveformHistory.push(waveformData);
        this.zcrHistory.push(zcr);
        this.energyHistory.push(energy);
        this.classificationHistory.push(classification);
        
        // Update current values
        this.currentZcr = zcr;
        this.currentEnergy = energy;
        this.currentClassification = classification;
        
        // Limit history length based on historyLength parameter (in seconds)
        this.limitHistoryLength();
    }
    
    // Limit the history length based on time duration
    limitHistoryLength(historyLength = 3) {
        if (!this.audioContext || this.waveformHistory.length === 0) return;
        
        const bufferSize = this.waveformHistory[0].length;
        const maxHistoryFrames = Math.ceil(historyLength * this.audioContext.sampleRate / bufferSize);
        
        if (this.waveformHistory.length > maxHistoryFrames) {
            this.waveformHistory.shift();
            this.zcrHistory.shift();
            this.energyHistory.shift();
            this.classificationHistory.shift();
        }
    }
    
    // Update the history length (called when the UI slider changes)
    updateHistoryLength(historyLength) {
        // Keep applying the limit until we're within the new length
        while (this.isActive && this.audioContext && 
               this.waveformHistory.length > 0 && 
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
            currentClassification: this.currentClassification
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