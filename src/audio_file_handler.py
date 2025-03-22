import os
import numpy as np
import librosa
import soundfile as sf

class AudioFileHandler:
    """Class for handling audio file operations"""
    
    def __init__(self, output_dir='output'):
        """Initialize with output directory."""
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
    
    def load_audio(self, file_path, sr=16000):
        """Load audio file and normalize.
        
        Supports various audio formats including MP3, WAV, etc. via librosa.
        """
        y, sr = librosa.load(file_path, sr=sr)
        return y, sr
    
    def save_classified_segments(self, signal, frames, labels, sr):
        """Save voiced, unvoiced, and silent segments to separate MP3 files.
        
        Args:
            signal: Original audio signal
            frames: Extracted frames
            labels: Classification labels (2=voiced, 1=unvoiced, 0=silent)
            sr: Sample rate
        """
        frame_length = len(frames[0])
        frame_stride = int(sr * 10 / 1000)  # Assuming 10ms frame stride
        
        # Initialize arrays for each type
        voiced_signal = np.array([])
        unvoiced_signal = np.array([])
        silent_signal = np.array([])
        
        # Reconstruct signal segments for each class
        for i, label in enumerate(labels):
            # Get the corresponding segment from the original signal
            start = i * frame_stride
            end = min(start + frame_length, len(signal))
            segment = signal[start:end]
            
            # Add segment to the appropriate class signal
            if label == 2:  # Voiced
                voiced_signal = np.append(voiced_signal, segment)
            elif label == 1:  # Unvoiced
                unvoiced_signal = np.append(unvoiced_signal, segment)
            else:  # Silent
                silent_signal = np.append(silent_signal, segment)
        
        # File paths in the output directory
        voice_path = os.path.join(self.output_dir, 'voice.mp3')
        unvoice_path = os.path.join(self.output_dir, 'unvoice.mp3')
        silent_path = os.path.join(self.output_dir, 'silent.mp3')
        
        # Save each class signal to a separate MP3 file
        sf.write(voice_path, voiced_signal, sr)
        sf.write(unvoice_path, unvoiced_signal, sr)
        sf.write(silent_path, silent_signal, sr)
        
        print(f"Saved classified segments to:")
        print(f"  {voice_path} ({len(voiced_signal)/sr:.2f} seconds)")
        print(f"  {unvoice_path} ({len(unvoiced_signal)/sr:.2f} seconds)")
        print(f"  {silent_path} ({len(silent_signal)/sr:.2f} seconds)")
        
        return voice_path, unvoice_path, silent_path
    
    def process_audio_file(self, file_path, classifier, visualizer):
        """Process an audio file and classify voiced/unvoiced segments.
        
        Args:
            file_path: Path to audio file (MP3, WAV, etc.)
            classifier: VoiceClassifier instance
            visualizer: AudioVisualizer instance
            
        Returns:
            features: Extracted features
            labels: Classification labels (2=voiced, 1=unvoiced, 0=silent)
        """
        # Load audio
        signal, sr = self.load_audio(file_path)
        
        # Process with classifier
        frames, features, labels = classifier.process(signal, sr)
        
        # Visualize results
        plot_path = visualizer.plot_features(signal, sr, frames, labels, classifier)
        
        # Plot ZCR vs classification comparison
        zcr_plot_path = visualizer.plot_zcr_classification_comparison(frames, labels, classifier)
        
        # Save classified segments
        voice_path, unvoice_path, silent_path = self.save_classified_segments(signal, frames, labels, sr)
        
        # Visualize pitch detection for some example frames
        print("Generating pitch detection visualizations for example frames...")
        
        # Find indices of voiced and unvoiced frames for examples
        voiced_indices = np.where(labels == 2)[0]
        unvoiced_indices = np.where(labels == 1)[0]
        
        # Select a few example frames (if available)
        example_indices = []
        
        # Add some voiced examples
        if len(voiced_indices) > 0:
            # Take examples from beginning, middle, and end if possible
            if len(voiced_indices) >= 3:
                example_indices.append(voiced_indices[0])  # Beginning
                example_indices.append(voiced_indices[len(voiced_indices)//2])  # Middle
                example_indices.append(voiced_indices[-1])  # End
            else:
                example_indices.extend(voiced_indices)  # All available
                
        # Add some unvoiced examples
        if len(unvoiced_indices) > 0:
            # Take examples from beginning and end if possible
            if len(unvoiced_indices) >= 2:
                example_indices.append(unvoiced_indices[0])  # Beginning
                example_indices.append(unvoiced_indices[-1])  # End
            else:
                example_indices.extend(unvoiced_indices)  # All available
        
        # Limit to maximum of 5 examples
        example_indices = example_indices[:5]
        
        # Create pitch detection visualizations for selected examples
        for idx in example_indices:
            if idx < len(frames):
                # Get the frame
                frame = frames[idx]
                # Create pitch detection visualization using the visualizer
                visualizer.plot_pitch_detection(frame, sr, classifier, frame_index=idx)
                print(f"  Created pitch detection visualization for frame {idx} (class: {labels[idx]})")
        
        print(f"Processed {file_path}")
        print(f"Sample rate: {sr} Hz")
        print(f"Duration: {len(signal)/sr:.2f} seconds")
        print(f"Results saved to '{plot_path}'")
        print(f"ZCR vs Classification plot saved to '{zcr_plot_path}'")
        
        # Print statistics about classification
        total_frames = len(labels)
        voiced_frames = np.sum(labels == 2)
        unvoiced_frames = np.sum(labels == 1)
        silent_frames = np.sum(labels == 0)
        
        print(f"Classification results:")
        print(f"  Voiced frames: {voiced_frames} ({voiced_frames/total_frames*100:.1f}%)")
        print(f"  Unvoiced frames: {unvoiced_frames} ({unvoiced_frames/total_frames*100:.1f}%)")
        print(f"  Silent frames: {silent_frames} ({silent_frames/total_frames*100:.1f}%)")
        
        return features, labels 