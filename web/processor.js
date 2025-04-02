// Import the ScriptProcessorHandler
import { ScriptProcessorHandler } from './script-processor.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const pauseButton = document.getElementById('pauseButton');
    const exportButton = document.getElementById('exportButton');
    const statusElement = document.getElementById('status');
    const loadingElement = document.getElementById('loading');
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
    
    // Update displayed values and audio processor when sliders change
    zcrThresholdInput.addEventListener('input', () => {
        const value = parseInt(zcrThresholdInput.value);
        zcrThresholdValue.textContent = value;
        updateProcessorParameters();
    });
    
    energyThresholdInput.addEventListener('input', () => {
        const value = parseFloat(energyThresholdInput.value);
        energyThresholdValue.textContent = value.toFixed(3);
        updateProcessorParameters();
    });
    
    historyLengthInput.addEventListener('input', () => {
        historyLengthValue.textContent = historyLengthInput.value;
    });
    
    // Function to update parameters in the active processor
    function updateProcessorParameters() {
        const zcrThreshold = parseInt(zcrThresholdInput.value);
        const energyThreshold = parseFloat(energyThresholdInput.value);
        
        // Only update if we have an active processor
        if (!audioContext) return;
        
        // Update AudioWorklet parameters if it's active
        if (processorNode instanceof AudioWorkletNode) {
            processorNode.port.postMessage({
                type: 'updateParameters',
                data: {
                    zcrThreshold: zcrThreshold,
                    energyThreshold: energyThreshold
                }
            });
        } 
        // Update ScriptProcessorHandler parameters if it's active
        else if (scriptProcessorHandler) {
            scriptProcessorHandler.updateParameters({
                zcrThreshold: zcrThreshold,
                energyThreshold: energyThreshold
            });
        }
    }
    
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
    let scriptProcessorHandler; // Reference to the ScriptProcessorHandler
    
    // Visualization control
    let isPaused = false;
    
    // Data history
    let waveformHistory = [];
    let zcrHistory = [];
    let energyHistory = [];
    let classificationHistory = [];
    
    // Current values
    let currentZcr = 0;
    let currentEnergy = 0;
    let currentClassification = 0; // 0: silence, 1: voiced, -1: unvoiced
    
    // Toggle pause visualization
    pauseButton.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseButton.textContent = isPaused ? 'Resume Display' : 'Pause Display';
        pauseButton.setAttribute('aria-label', isPaused ? 'Resume visualization' : 'Pause visualization');
    });
    
    // Export data
    exportButton.addEventListener('click', exportData);
    
    function exportData() {
        // Prepare data object
        const data = {
            timestamp: new Date().toISOString(),
            parameters: {
                bufferSize: parseInt(bufferSizeSelect.value),
                zcrThreshold: parseFloat(zcrThresholdInput.value),
                energyThreshold: parseFloat(energyThresholdInput.value),
                sampleRate: audioContext ? audioContext.sampleRate : 0
            },
            samples: []
        };
        
        // Collect data for all frames
        const frames = zcrHistory.length;
        for (let i = 0; i < frames; i++) {
            data.samples.push({
                zcr: zcrHistory[i],
                energy: energyHistory[i],
                classification: classificationHistory[i]
            });
        }
        
        // Convert to JSON and create download link
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `speech-analysis-${new Date().toISOString().slice(0,19).replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // Function to handle feature updates from either processor type
    function handleFeatures(features) {
        const { waveformData, zcr, energy, classification } = features;
        
        // Add to histories
        waveformHistory.push(waveformData);
        zcrHistory.push(zcr);
        energyHistory.push(energy);
        classificationHistory.push(classification);
        
        // Update current values
        currentZcr = zcr;
        currentEnergy = energy;
        currentClassification = classification;
        
        // Limit history length
        const historyLength = parseFloat(historyLengthInput.value);
        const maxHistoryFrames = Math.ceil(historyLength * audioContext.sampleRate / waveformData.length);
        
        if (waveformHistory.length > maxHistoryFrames) {
            waveformHistory.shift();
            zcrHistory.shift();
            energyHistory.shift();
            classificationHistory.shift();
        }
    }
    
    // Start real-time analysis
    startButton.addEventListener('click', async () => {
        try {
            // Show loading indicator
            loadingElement.classList.add('active');
            startButton.disabled = true;
            statusElement.textContent = 'Requesting microphone access...';
            
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
            const zcrThreshold = parseInt(zcrThresholdInput.value);
            const energyThreshold = parseFloat(energyThresholdInput.value);
            
            statusElement.textContent = 'Initializing audio processing...';
            
            // Use AudioWorkletNode if supported, otherwise fall back to ScriptProcessorNode
            if (window.AudioWorkletNode && audioContext.audioWorklet) {
                try {
                    // Load and register the processor worklet
                    await audioContext.audioWorklet.addModule('speech-processor.js');
                    
                    // Create the worklet node with initial parameters
                    processorNode = new AudioWorkletNode(audioContext, 'speech-processor', {
                        processorOptions: {
                            bufferSize: bufferSize,
                            zcrThreshold: zcrThreshold,
                            energyThreshold: energyThreshold
                        }
                    });
                    
                    // Set up event handling from the worklet
                    processorNode.port.onmessage = (event) => {
                        if (event.data.type === 'features') {
                            handleFeatures(event.data);
                        } else if (event.data.type === 'parameterUpdate') {
                            console.log('Parameter update confirmed:', event.data.data);
                        }
                    };
                    
                    console.log('Using AudioWorkletNode for processing');
                } catch (workletError) {
                    console.warn('AudioWorklet not fully supported, falling back to ScriptProcessor', workletError);
                    // Fall back to ScriptProcessorNode
                    useScriptProcessor();
                }
            } else {
                // Fall back to ScriptProcessorNode
                useScriptProcessor();
            }
            
            // Connect the nodes
            microphone.connect(analyserNode);
            if (processorNode) {
                analyserNode.connect(processorNode);
                
                // Only connect to destination for ScriptProcessorNode
                if (processorNode instanceof ScriptProcessorNode) {
                    processorNode.connect(audioContext.destination);
                }
            }
            
            // Start visualization
            requestAnimationFrame(updateVisualization);
            
            // Hide loading indicator and update UI
            loadingElement.classList.remove('active');
            stopButton.disabled = false;
            pauseButton.disabled = false;
            exportButton.disabled = false;
            statusElement.textContent = 'Analyzing speech in real-time...';
            
            // Clear histories
            waveformHistory = [];
            zcrHistory = [];
            energyHistory = [];
            classificationHistory = [];
            
        } catch (error) {
            loadingElement.classList.remove('active');
            startButton.disabled = false;
            statusElement.textContent = 'Error: ' + error.message;
            console.error('Error accessing microphone:', error);
        }
    });
    
    // Helper function to create ScriptProcessorNode as fallback
    function useScriptProcessor() {
        // Get parameter values
        const bufferSize = parseInt(bufferSizeSelect.value);
        const zcrThreshold = parseFloat(zcrThresholdInput.value);
        const energyThreshold = parseFloat(energyThresholdInput.value);
        
        // Create ScriptProcessorHandler instance
        scriptProcessorHandler = new ScriptProcessorHandler(audioContext, {
            bufferSize: bufferSize,
            zcrThreshold: zcrThreshold,
            energyThreshold: energyThreshold,
            onFeaturesCalculated: handleFeatures,
            onError: (error) => {
                console.error('ScriptProcessor error:', error);
                statusElement.textContent = 'Error processing audio: ' + error.message;
            }
        });
        
        // Initialize and get the processor node
        processorNode = scriptProcessorHandler.initialize();
        
        console.log('Using ScriptProcessorNode for processing');
    }
    
    // Stop analysis
    stopButton.addEventListener('click', () => {
        // Clean up ScriptProcessorHandler if it exists
        if (scriptProcessorHandler) {
            scriptProcessorHandler.dispose();
            scriptProcessorHandler = null;
        } else if (processorNode) {
            processorNode.disconnect();
        }
        
        processorNode = null;
        
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
        pauseButton.disabled = true;
        statusElement.textContent = 'Analysis stopped';
        
        // Keep export button enabled if there's data to export
        exportButton.disabled = zcrHistory.length === 0;
    });
    
    // Update visualization
    function updateVisualization() {
        if (!audioContext) {
            requestAnimationFrame(updateVisualization);
            return;
        }
        
        // Only update visuals if not paused
        if (!isPaused) {
            // Draw waveform
            drawWaveform();
            
            // Draw ZCR
            drawZCR();
            
            // Draw energy
            drawEnergy();
            
            // Draw classification
            drawClassification();
        }
        
        // Always update current value displays even when paused
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
    
    // Add dark mode CSS support
    function setupDarkMode() {
        const style = document.createElement('style');
        style.textContent = `
            body.dark-mode {
                background-color: #1e272e;
                color: #dfe6e9;
            }
            body.dark-mode h1 {
                color: #74b9ff;
            }
            body.dark-mode .chart-container {
                background-color: #2d3436;
                border-color: #636e72;
            }
            body.dark-mode canvas {
                background-color: #2d3436;
                border-color: #636e72;
            }
            body.dark-mode .parameters {
                background-color: #2d3436;
            }
            body.dark-mode .theme-toggle {
                color: #dfe6e9;
            }
            body.dark-mode button:not(:disabled) {
                background-color: #0984e3;
            }
            body.dark-mode button:hover:not(:disabled) {
                background-color: #74b9ff;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupDarkMode();
});