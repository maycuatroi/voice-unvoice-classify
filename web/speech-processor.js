// speech-processor.js
// AudioWorklet processor for speech analysis

class SpeechProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Get processor options
        const processorOptions = options.processorOptions || {};
        this.bufferSize = processorOptions.bufferSize || 1024;
        
        // Buffer to accumulate samples
        this.sampleBuffer = new Float32Array(this.bufferSize);
        this.bufferFill = 0;
        
        // Initialize sampleRate (will be set when process() is called)
        this.sampleRate = 0;
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
    // Note: In a real implementation, you would need to pass the thresholds
    // from the main thread to the worklet or use reasonable defaults
    classifyFrame(zcr, energy) {
        // Default thresholds (in production, these should be configurable)
        const zcrThreshold = 35;
        const energyThreshold = 0.002;
        
        // First check if it's silence based on energy
        if (energy < energyThreshold / 5) {
            return 0; // Silence
        }
        
        // Explicitly check for unvoiced sounds (high ZCR and lower energy)
        if (zcr > zcrThreshold * 1.2 && energy < energyThreshold * 2) {
            return -1; // Unvoiced
        } else {
            return 1; // Everything else is considered voiced
        }
    }
}

// Register the processor
registerProcessor('speech-processor', SpeechProcessor); 