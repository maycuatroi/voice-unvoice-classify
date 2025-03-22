import numpy as np
import matplotlib.pyplot as plt
import os

class AudioVisualizer:
    """Class for visualizing audio classification results"""
    
    def __init__(self, output_dir='output'):
        """Initialize with output directory."""
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
    
    def plot_features(self, signal, sr, frames, labels, classifier):
        """Plot signal and features."""
        
        time = np.arange(len(signal)) / sr
        frame_time = np.arange(len(frames)) * (0.01) # Assuming 10ms frame stride
        
        fig, (ax1, ax2, ax3, ax4) = plt.subplots(4, 1, figsize=(12, 10))
        
        # Plot waveform
        ax1.plot(time, signal)
        ax1.set_title('Waveform')
        ax1.set_xlabel('Time (s)')
        ax1.set_ylabel('Amplitude')
        
        # Extract features for each frame
        zcrs = np.zeros(len(frames))
        energies = np.zeros(len(frames))
        
        for i, frame in enumerate(frames):
            features = classifier.extract_features_from_frame(frame, sr)
            zcrs[i] = features["zcr"]
            energies[i] = features["energy"]
        
        # Plot zero crossing rate
        ax2.plot(frame_time, zcrs)
        ax2.set_title('Zero Crossing Rate')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('ZCR')
        
        # Plot short-time energy
        ax3.plot(frame_time, energies)
        ax3.set_title('Short-Time Energy')
        ax3.set_xlabel('Time (s)')
        ax3.set_ylabel('Energy')
        
        # Plot classification
        ax4.plot(frame_time, labels)
        ax4.set_title('Classification (2=voiced, 1=unvoiced, 0=silent)')
        ax4.set_xlabel('Time (s)')
        ax4.set_ylabel('Class')
        ax4.set_ylim(-0.1, 2.1)
        
        plt.tight_layout()
        output_path = os.path.join(self.output_dir, 'voice_classification_results.png')
        plt.savefig(output_path)
        plt.close()
        
        return output_path 