# Voice Unvoiced Classification

A Python tool for classifying audio signals into voiced, unvoiced, and silent segments.

## Features

- Load and process audio files (MP3, WAV, etc.)
- Classify audio frames as voiced, unvoiced, or silent
- Extract acoustic features (zero-crossing rate, energy, pitch)
- Generate visualizations of the classification
- Save classified segments to separate audio files

## Code Structure

- `main.py` - Main entry point for the application
- `src/voice_classifier.py` - Core classification algorithm 
- `src/audio_visualizer.py` - Visualization functionality
- `src/audio_file_handler.py` - Audio file operations
- `src/voice_downloader.py` - Text-to-speech downloader

## Signal Processing Pipeline

### 1. Audio Loading
```python
# Using the AudioFileHandler class
file_handler = AudioFileHandler()
signal, sr = file_handler.load_audio(file_path, sr=16000)
```
- Loads audio file using librosa
- Resamples to specified sample rate (default: 16kHz)
- Returns normalized signal array and sample rate (sr)

### 2. Frame Extraction
```python
# Using the VoiceClassifier class
classifier = VoiceClassifier()
frames = classifier.extract_frames(signal, sr, frame_length=25, frame_stride=10)
```
- Segments the audio signal into overlapping frames
- `frame_length`: Length of each frame in milliseconds (default: 25ms)
- `frame_stride`: Step size between frames in milliseconds (default: 10ms)
- Returns a 2D array of frames

### 3. Feature Extraction
```python
# Using the VoiceClassifier class
features, labels = classifier.extract_features(frames, sr)
```
For each frame, calculates:
- **Zero Crossing Rate (ZCR)**: Frequency of signal sign-changes
- **Short-Time Energy**: Sum of squared amplitudes
- **Pitch**: Estimated using autocorrelation

### 4. Classification
```python
# Using the VoiceClassifier class
features = classifier.extract_features_from_frame(frame, sr)
label = classifier.classify_frame(features)
```
Classifies each frame based on acoustic features:
- **Voiced (2)**: Low ZCR, high energy, clear pitch
- **Unvoiced (1)**: High ZCR, moderate energy, no clear pitch
- **Silent (0)**: Very low energy

### 5. Visualization and Export
```python
# Using the AudioVisualizer class
visualizer = AudioVisualizer(output_dir='results')
plot_path = visualizer.plot_features(signal, sr, frames, labels, classifier)

# Using the AudioFileHandler class
file_handler = AudioFileHandler(output_dir='results')
voice_path, unvoice_path, silent_path = file_handler.save_classified_segments(signal, frames, labels, sr)
```
- Generates plots of signal waveform, features, and classification
- Saves voiced, unvoiced, and silent segments as separate audio files

### 6. All-in-one Processing
```python
# Initialize the components
classifier = VoiceClassifier()
visualizer = AudioVisualizer(output_dir='results')
file_handler = AudioFileHandler(output_dir='results')

# Process an audio file
features, labels = file_handler.process_audio_file('audio.mp3', classifier, visualizer)
```

## Quick Start

```bash
# Process an existing audio file
python main.py --file your_audio.mp3 --output results

# Generate and analyze speech from text
python main.py
# Then follow the prompts to enter text
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Requirements

- Python 3.6+
- librosa
- numpy
- scipy
- matplotlib
- scikit-learn
- soundfile
- gTTS (for text-to-speech conversion)

## License

[MIT License](LICENSE) 