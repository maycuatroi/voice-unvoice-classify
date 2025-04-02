// script-processor.js
// Fallback implementation using the deprecated ScriptProcessorNode API

// Class to encapsulate ScriptProcessorNode functionality
class ScriptProcessorHandler {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.options = options;
        this.bufferSize = options.bufferSize || 1024;
        this.processorNode = null;
        
        // Store threshold values
        this.zcrThreshold = options.zcrThreshold || 35;
        this.energyThreshold = options.energyThreshold || 0.002;
        
        // Callback functions
        this.onFeaturesCalculated = options.onFeaturesCalculated || (() => {});
        this.onError = options.onError || (() => {});
        this.onParameterUpdated = options.onParameterUpdated || (() => {});
    }
    
    // Update parameters dynamically
    updateParameters(params = {}) {
        if (params.zcrThreshold !== undefined) {
            this.zcrThreshold = params.zcrThreshold;
        }
        
        if (params.energyThreshold !== undefined) {
            this.energyThreshold = params.energyThreshold;
        }
        
        // Update stored options
        this.options = {
            ...this.options,
            ...params
        };
        
        // Notify about parameter update if callback provided
        if (this.onParameterUpdated) {
            this.onParameterUpdated({
                zcrThreshold: this.zcrThreshold,
                energyThreshold: this.energyThreshold
            });
        }
        
        return true;
    }
    
    // Create and initialize the ScriptProcessorNode
    initialize() {
        try {
            // Create script processor node
            this.processorNode = this.audioContext.createScriptProcessor(
                this.bufferSize,
                1, // One input channel
                1  // One output channel
            );
            
            // Process audio data
            this.processorNode.onaudioprocess = this.processAudio.bind(this);
            
            return this.processorNode;
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
            console.error('Error initializing ScriptProcessorNode:', error);
            return null;
        }
    }
    
    // Process audio data from ScriptProcessorNode
    processAudio(event) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Clone the input data for waveform display
        const waveformData = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            waveformData[i] = inputData[i];
        }
        
        // Calculate features
        const zcr = this.calculateZCR(inputData);
        const energy = this.calculateEnergy(inputData);
        const classification = this.classifyFrame(zcr, energy);
        
        // Send features to main thread via callback
        if (this.onFeaturesCalculated) {
            this.onFeaturesCalculated({
                waveformData,
                zcr,
                energy,
                classification
            });
        }
    }
    
    // Calculate Zero-Crossing Rate
    calculateZCR(buffer) {
        let crossings = 0;
        
        for (let i = 1; i < buffer.length; i++) {
            if ((buffer[i] >= 0 && buffer[i - 1] < 0) || 
                (buffer[i] < 0 && buffer[i - 1] >= 0)) {
                crossings++;
            }
        }
        
        // Normalize to crossings per second
        return (crossings * this.audioContext.sampleRate) / buffer.length;
    }
    
    // Calculate Energy
    calculateEnergy(buffer) {
        let sum = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        
        return sum / buffer.length;
    }
    
    // Classify frame
    classifyFrame(zcr, energy) {
        // Use current threshold values from instance properties, not options
        // This ensures we're using the most up-to-date values after updateParameters calls
        
        // First check if it's silence based on energy
        if (energy < this.energyThreshold / 5) {
            return 0; // Silence
        }
        
        // Explicitly check for unvoiced sounds (high ZCR and lower energy)
        if (zcr > this.zcrThreshold * 1.2 && energy < this.energyThreshold * 2) {
            return -1; // Unvoiced
        } else {
            return 1; // Everything else is considered voiced
        }
    }
    
    // Clean up resources
    dispose() {
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }
    }
}

export { ScriptProcessorHandler }; 