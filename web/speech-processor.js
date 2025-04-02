// speech-processor.js
// AudioWorklet processor for speech analysis

class SpeechProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Get processor options
        const processorOptions = options.processorOptions || {};
        this.bufferSize = processorOptions.bufferSize || 1024;
        
        // Default threshold values
        this.zcrThreshold = processorOptions.zcrThreshold || 35;
        this.energyThreshold = processorOptions.energyThreshold || 0.002;
        
        // Buffer to accumulate samples
        this.sampleBuffer = new Float32Array(this.bufferSize);
        this.bufferFill = 0;
        
        // Initialize sampleRate (will be set when process() is called)
        this.sampleRate = 0;
        
        // Set up message port for parameter updates
        this.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            if (type === 'updateParameters') {
                // Update parameters when received from main thread
                if (data.zcrThreshold !== undefined) {
                    this.zcrThreshold = data.zcrThreshold;
                }
                if (data.energyThreshold !== undefined) {
                    this.energyThreshold = data.energyThreshold;
                }
                
                // Send confirmation back to main thread
                this.port.postMessage({
                    type: 'parameterUpdate',
                    status: 'success',
                    data: {
                        zcrThreshold: this.zcrThreshold,
                        energyThreshold: this.energyThreshold
                    }
                });
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        // Get input samples from first channel of first input
        const input = inputs[0][0];
        
        // Set sampleRate if not already set
        if (this.sampleRate === 0 && sampleRate) {
            this.sampleRate = sampleRate;
        }
        
        if (!input || input.length === 0) {
            return true; // Keep processor alive
        }
        
        // Fill the buffer with new samples
        for (let i = 0; i < input.length; i++) {
            if (this.bufferFill < this.bufferSize) {
                this.sampleBuffer[this.bufferFill++] = input[i];
            }
        }
        
        // If we have a full buffer, process it
        if (this.bufferFill === this.bufferSize) {
            // Calculate features
            const waveformData = new Float32Array(this.sampleBuffer);
            const zcr = this.calculateZCR(this.sampleBuffer);
            const energy = this.calculateEnergy(this.sampleBuffer);
            const classification = this.classifyFrame(zcr, energy);
            
            // Send features to main thread
            this.port.postMessage({
                type: 'features',
                waveformData,
                zcr,
                energy,
                classification
            });
            
            // Reset buffer fill counter
            this.bufferFill = 0;
        }
        
        return true; // Keep the processor alive
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
        return (crossings * this.sampleRate) / buffer.length;
    }
    
    // Calculate Energy
    calculateEnergy(buffer) {
        let sum = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        
        return sum / buffer.length;
    }
    
    // Classify frame as voiced/unvoiced/silence
    classifyFrame(zcr, energy) {
        // Use the current threshold values (which may have been updated from main thread)
        
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
}

// Register the processor
registerProcessor('speech-processor', SpeechProcessor); 