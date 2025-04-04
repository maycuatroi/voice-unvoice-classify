// Import the ScriptProcessorHandler
import { ScriptProcessorHandler } from './script-processor.js';
import { Visualizer } from './visualizer.js';
import { DataProvider } from './data-provider.js';

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
    const fftCanvas = document.getElementById('fftCanvas');
    
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
    
    // Initialize the DataProvider
    const dataProvider = new DataProvider();
    
    // Initialize the Visualizer
    const visualizer = new Visualizer({
        waveformCanvas,
        zcrCanvas,
        energyCanvas,
        classificationCanvas,
        fftCanvas,
        currentZcrElement,
        currentEnergyElement,
        currentClassificationElement,
        zcrThresholdInput,
        energyThresholdInput
    });
    
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
        const value = parseFloat(historyLengthInput.value);
        historyLengthValue.textContent = value;
        dataProvider.updateHistoryLength(value);
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
    
    // Audio processing variables
    let audioContext;
    let analyserNode;
    let microphone;
    let processorNode;
    let stream;
    let scriptProcessorHandler; // Reference to the ScriptProcessorHandler
    
    // Toggle pause visualization
    pauseButton.addEventListener('click', () => {
        const isPaused = visualizer.togglePause();
        pauseButton.textContent = isPaused ? 'Resume Display' : 'Pause Display';
        pauseButton.setAttribute('aria-label', isPaused ? 'Resume visualization' : 'Pause visualization');
    });
    
    // Export data
    exportButton.addEventListener('click', exportData);
    
    function exportData() {
        // Get data from provider
        const data = dataProvider.getExportData({
            bufferSize: parseInt(bufferSizeSelect.value),
            zcrThreshold: parseFloat(zcrThresholdInput.value),
            energyThreshold: parseFloat(energyThresholdInput.value)
        });
        
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
        dataProvider.handleFeatures(features);
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
            
            // Initialize data provider
            dataProvider.initialize(audioContext);
            
            // Get microphone stream
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create microphone source
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Create analyser node for visualization
            analyserNode = audioContext.createAnalyser();
            // Setup for FFT analysis
            const fftSize = 2048; // Already set in your code
            analyserNode.fftSize = fftSize;
            analyserNode.smoothingTimeConstant = 0.85; // Add slight smoothing for better visualization
            const frequencyBinCount = analyserNode.frequencyBinCount; // Should be 1024 (half of fftSize)
            const fftDataArray = new Float32Array(frequencyBinCount);

            // Create a function to get FFT data periodically
            function updateFFTData() {
                // Only process FFT data if analyser node exists and data provider is active
                if (analyserNode && dataProvider.isActive && dataProvider.audioContext) {
                    try {
                        // Get frequency data from analyser
                        analyserNode.getFloatFrequencyData(fftDataArray);
                        
                        // Normalize from dB to a 0.0-1.0 range for easier visualization
                        // FFT data is typically in dB scale (-100 to 0)
                        const normalizedFFT = new Float32Array(frequencyBinCount);
                        for (let i = 0; i < frequencyBinCount; i++) {
                            // Convert from dB (-100 to 0) to 0.0-1.0 range
                            normalizedFFT[i] = (fftDataArray[i] + 100) / 100;
                        }
                        
                        // Pass to the data provider
                        dataProvider.handleFeatures({
                            fftData: normalizedFFT
                        });
                    } catch (error) {
                        console.warn("Error updating FFT data:", error);
                    }
                }
                
                // Schedule next update
                if (analyserNode) {
                    requestAnimationFrame(updateFFTData);
                }
            }

            // Start FFT updates
            updateFFTData();
            
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
            visualizer.start(dataProvider);
            
            // Hide loading indicator and update UI
            loadingElement.classList.remove('active');
            stopButton.disabled = false;
            pauseButton.disabled = false;
            exportButton.disabled = false;
            statusElement.textContent = 'Analyzing speech in real-time...';
            
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
        // Stop visualizer
        visualizer.stop();
        
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
        const { waveformHistory } = dataProvider.getData();
        exportButton.disabled = !waveformHistory || waveformHistory.length === 0;
    });
    
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
            /* Adjustments for FFT visualization in dark mode */
            body.dark-mode .legend-color {
                border: 1px solid rgba(255,255,255,0.3);
            }
        `;
        document.head.appendChild(style);
    }
    
    setupDarkMode();
}); 