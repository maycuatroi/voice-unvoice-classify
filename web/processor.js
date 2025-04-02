
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const statusElement = document.getElementById('status');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const zcrCanvas = document.getElementById('zcrCanvas');
    const energyCanvas = document.getElementById('energyCanvas');
    const classificationCanvas = document.getElementById('classificationCanvas');
    
    // Parameter elements
    const bufferSizeSelect = document.getElementById('bufferSize');
    const zcrThresholdInput = document.getElementById('zcrThreshold');
    const energyThresholdInput = document.getElementById('energyThreshold');
    const historyLengthInput = document.getElementById('historyLength');
    
    // Display elements for current values
    const zcrThresholdValue = document.getElementById('zcrThresholdValue');
    const energyThresholdValue = document.getElementById('energyThresholdValue');
    const historyLengthValue = document.getElementById('historyLengthValue');
    const currentZcrElement = document.getElementById('currentZcr');
    const currentEnergyElement = document.getElementById('currentEnergy');
    const currentClassificationElement = document.getElementById('currentClassification');
    
    // Update displayed values when sliders change
    zcrThresholdInput.addEventListener('input', () => {
        zcrThresholdValue.textContent = zcrThresholdInput.value;
    });
    
    energyThresholdInput.addEventListener('input', () => {
        energyThresholdValue.textContent = parseFloat(energyThresholdInput.value).toFixed(3);
    });
    
    historyLengthInput.addEventListener('input', () => {
        historyLengthValue.textContent = historyLengthInput.value;
    });
    
    // Drawing context for canvases
    const waveformCtx = waveformCanvas.getContext('2d');
    const zcrCtx = zcrCanvas.getContext('2d');
    const energyCtx = energyCanvas.getContext('2d');
    const classificationCtx = classificationCanvas.getContext('2d');
    
    // Set canvas sizes
    function resizeCanvases() {
        [waveformCanvas, zcrCanvas, energyCanvas, classificationCanvas].forEach(canvas => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        });
    }
    
    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();
    
    // Audio processing variables
    let audioContext;
    let analyserNode;
    let microphone;
    let processorNode;
    let stream;
    
    // Data history
    let waveformHistory = [];
    let zcrHistory = [];
    let energyHistory = [];
    let classificationHistory = [];
    
    // Current values
    let currentZcr = 0;
    let currentEnergy = 0;
    let currentClassification = 0; // 0: silence, 1: voiced, -1: unvoiced
    
    // Start real-time analysis
    startButton.addEventListener('click', async () => {
        try {
            // Initialize audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get microphone stream
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create microphone source
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Create analyser node for visualization
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048;
            
            // Get buffer size
            const bufferSize = parseInt(bufferSizeSelect.value);
            
            // Create script processor node for custom processing
            // Note: ScriptProcessorNode is deprecated but used here for compatibility
            // In production, AudioWorkletNode should be used instead
            processorNode = audioContext.createScriptProcessor(
                bufferSize,
                1,
                1
            );
            
            // Connect the nodes
            microphone.connect(analyserNode);
            analyserNode.connect(processorNode);
            processorNode.connect(audioContext.destination);
            
            // Process audio data
            processorNode.onaudioprocess = processAudio;
            
            // Start visualization
            requestAnimationFrame(updateVisualization);
            
            // Update UI
            startButton.disabled = true;
            stopButton.disabled = false;
            statusElement.textContent = 'Analyzing speech in real-time...';
            
            // Clear histories
            waveformHistory = [];
            zcrHistory = [];
            energyHistory = [];
            classificationHistory = [];
            
        } catch (error) {
            statusElement.textContent = 'Error: ' + error.message;
            console.error('Error accessing microphone:', error);
        }
    });
    
    // Stop analysis
    stopButton.addEventListener('click', () => {
        if (processorNode) {
            processorNode.disconnect();
            processorNode = null;
        }
        
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
        
        if (analyserNode) {
            analyserNode.disconnect();
            analyserNode = null;
        }
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        startButton.disabled = false;
        stopButton.disabled = true;
        statusElement.textContent = 'Analysis stopped';
    });
    
    // Process audio data
    function processAudio(event) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Clone the input data for waveform display
        const waveformData = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            waveformData[i] = inputData[i];
        }
        
        // Add to waveform history
        waveformHistory.push(waveformData);
        
        // Calculate Zero-Crossing Rate
        let zcr = calculateZCR(inputData);
        zcrHistory.push(zcr);
        currentZcr = zcr;
        
        // Calculate Energy
        let energy = calculateEnergy(inputData);
        energyHistory.push(energy);
        currentEnergy = energy;
        
        // Classify voiced/unvoiced
        let classification = classifyFrame(zcr, energy);
        classificationHistory.push(classification);
        currentClassification = classification;
        
        // Limit history length
        const historyLength = parseFloat(historyLengthInput.value);
        const maxHistoryFrames = Math.ceil(historyLength * audioContext.sampleRate / inputData.length);
        
        if (waveformHistory.length > maxHistoryFrames) {
            waveformHistory.shift();
            zcrHistory.shift();
            energyHistory.shift();
            classificationHistory.shift();
        }
    }
    
    // Calculate Zero-Crossing Rate
    function calculateZCR(buffer) {
        let crossings = 0;
        
        for (let i = 1; i < buffer.length; i++) {
            if ((buffer[i] >= 0 && buffer[i - 1] < 0) || 
                (buffer[i] < 0 && buffer[i - 1] >= 0)) {
                crossings++;
            }
        }
        
        // Normalize to crossings per second
        return (crossings * audioContext.sampleRate) / buffer.length;
    }
    
    // Calculate Energy
    function calculateEnergy(buffer) {
        let sum = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        
        return sum / buffer.length;
    }
    
    // Classify frame
    function classifyFrame(zcr, energy) {
        const zcrThreshold = parseFloat(zcrThresholdInput.value);
        const energyThreshold = parseFloat(energyThresholdInput.value);
        
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
    
    // Update visualization
    function updateVisualization() {
        if (!audioContext) {
            requestAnimationFrame(updateVisualization);
            return;
        }
        
        // Draw waveform
        drawWaveform();
        
        // Draw ZCR
        drawZCR();
        
        // Draw energy
        drawEnergy();
        
        // Draw classification
        drawClassification();
        
        // Update current value displays
        currentZcrElement.textContent = `ZCR: ${Math.round(currentZcr)}`;
        currentEnergyElement.textContent = `Energy: ${currentEnergy.toFixed(5)}`;
        
        let classText = "Classification: ";
        if (currentClassification === 1) {
            classText += "Voiced";
            currentClassificationElement.style.color = "#3498db";
        } else if (currentClassification === -1) {
            classText += "Unvoiced";
            currentClassificationElement.style.color = "#e74c3c";
        } else {
            classText += "Silence";
            currentClassificationElement.style.color = "#95a5a6";
        }
        currentClassificationElement.textContent = classText;
        
        requestAnimationFrame(updateVisualization);
    }
    
    // Draw waveform from history
    function drawWaveform() {
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;
        
        waveformCtx.clearRect(0, 0, width, height);
        waveformCtx.beginPath();
        waveformCtx.strokeStyle = '#3498db';
        waveformCtx.lineWidth = 1.5;
        
        // Draw center line
        waveformCtx.beginPath();
        waveformCtx.strokeStyle = '#95a5a6';
        waveformCtx.lineWidth = 1;
        waveformCtx.moveTo(0, height / 2);
        waveformCtx.lineTo(width, height / 2);
        waveformCtx.stroke();
        
        if (waveformHistory.length === 0) return;
        
        // Combine all buffers in history to display continuously
        const totalSamples = waveformHistory.reduce((sum, buffer) => sum + buffer.length, 0);
        const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));
        
        waveformCtx.beginPath();
        waveformCtx.strokeStyle = '#3498db';
        waveformCtx.lineWidth = 1.5;
        
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
            
            waveformCtx.moveTo(pixelX, y1);
            waveformCtx.lineTo(pixelX, y2);
            
            pixelX++;
            
            if (sampleIdx >= totalSamples) break;
        }
        
        waveformCtx.stroke();
    }
    
    // Draw Zero-Crossing Rate history
    function drawZCR() {
        const width = zcrCanvas.width;
        const height = zcrCanvas.height;
        const zcrThreshold = parseFloat(zcrThresholdInput.value);
        
        zcrCtx.clearRect(0, 0, width, height);
        
        if (zcrHistory.length === 0) return;
        
        // Find max ZCR for scaling
        const maxZCR = Math.max(...zcrHistory, zcrThreshold * 2);
        
        // Draw threshold line
        zcrCtx.beginPath();
        zcrCtx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        zcrCtx.lineWidth = 1;
        const thresholdY = height - (zcrThreshold / maxZCR * height);
        zcrCtx.moveTo(0, thresholdY);
        zcrCtx.lineTo(width, thresholdY);
        zcrCtx.stroke();
        
        // Draw ZCR history
        zcrCtx.beginPath();
        zcrCtx.strokeStyle = '#3498db';
        zcrCtx.lineWidth = 2;
        
        const stepX = width / zcrHistory.length;
        
        zcrHistory.forEach((zcr, i) => {
            const x = i * stepX;
            const y = height - (zcr / maxZCR * height);
            
            if (i === 0) {
                zcrCtx.moveTo(x, y);
            } else {
                zcrCtx.lineTo(x, y);
            }
        });
        
        zcrCtx.stroke();
    }
    
    // Draw Energy history
    function drawEnergy() {
        const width = energyCanvas.width;
        const height = energyCanvas.height;
        const energyThreshold = parseFloat(energyThresholdInput.value);
        
        energyCtx.clearRect(0, 0, width, height);
        
        if (energyHistory.length === 0) return;
        
        // Find max energy for scaling
        const maxEnergy = Math.max(...energyHistory, energyThreshold * 10);
        
        // Draw threshold line
        energyCtx.beginPath();
        energyCtx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        energyCtx.lineWidth = 1;
        const thresholdY = height - (energyThreshold / maxEnergy * height);
        energyCtx.moveTo(0, thresholdY);
        energyCtx.lineTo(width, thresholdY);
        energyCtx.stroke();
        
        // Draw energy history
        energyCtx.beginPath();
        energyCtx.strokeStyle = '#27ae60';
        energyCtx.lineWidth = 2;
        
        const stepX = width / energyHistory.length;
        
        energyHistory.forEach((energy, i) => {
            const x = i * stepX;
            const y = height - (energy / maxEnergy * height);
            
            if (i === 0) {
                energyCtx.moveTo(x, y);
            } else {
                energyCtx.lineTo(x, y);
            }
        });
        
        energyCtx.stroke();
    }
    
    // Draw Classification history
    function drawClassification() {
        const width = classificationCanvas.width;
        const height = classificationCanvas.height;
        
        classificationCtx.clearRect(0, 0, width, height);
        
        if (classificationHistory.length === 0) return;
        
        const stepX = width / classificationHistory.length;
        
        classificationHistory.forEach((classification, i) => {
            const x = i * stepX;
            const barWidth = stepX + 1; // Slight overlap to avoid gaps
            
            if (classification === 1) {
                // Voiced - Blue
                classificationCtx.fillStyle = '#3498db';
            } else if (classification === -1) {
                // Unvoiced - Red
                classificationCtx.fillStyle = '#e74c3c';
            } else {
                // Silence - Gray
                classificationCtx.fillStyle = '#95a5a6';
            }
            
            classificationCtx.fillRect(x, 0, barWidth, height);
        });
    }
});