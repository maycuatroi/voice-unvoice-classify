import numpy as np
import matplotlib.pyplot as plt
import os

class AudioVisualizer:
    """Class for visualizing audio classification results"""
    
    def __init__(self, output_dir='output'):
        """Initialize with output directory."""
        self.output_dir = output_dir
        # Create main output directory
        os.makedirs(self.output_dir, exist_ok=True)
        # Define subdirectories for frame-level features
        self.feature_dirs = {
            'zcr': os.path.join(self.output_dir, 'zcr'),
            'energy': os.path.join(self.output_dir, 'energy'),
            'pitch': os.path.join(self.output_dir, 'pitch')
        }
        # Create all subdirectories
        for dir_path in self.feature_dirs.values():
            os.makedirs(dir_path, exist_ok=True)
    
    def plot_features(self, signal, sr, frames, labels, classifier):
        """Plot signal and features."""
        
        # Store reference to classifier for use in frame-level plots
        self.classifier = classifier
        
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
        # Add ZCR threshold line
        ax2.axhline(y=classifier.zcr_threshold, color='r', linestyle='--', label=f'ZCR Threshold = {classifier.zcr_threshold}')
        ax2.legend()
        ax2.set_title('Zero Crossing Rate')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('ZCR')
        
        # Plot short-time energy
        ax3.plot(frame_time, energies)
        # Add energy threshold line
        ax3.axhline(y=classifier.energy_threshold, color='r', linestyle='--', label=f'Energy Threshold = {classifier.energy_threshold}')
        ax3.legend()
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

    def plot_frame_features(self, frame, features, frame_index):
        """Plot features for a single frame.
        
        Args:
            frame: Audio frame data
            features: Dictionary of extracted features
            frame_index: Index of the current frame
        """
        # Plot each feature
        self._plot_feature('zcr', frame, features["zcr"], frame_index, 
                           y_data=frame, add_zero_line=True)
        
        self._plot_feature('energy', frame, features["energy"], frame_index, 
                           y_data=frame**2)
        
        self._plot_feature('pitch', frame, features["pitch"], frame_index, 
                           y_data=frame)
    
    def _plot_feature(self, feature_type, frame, value, frame_index, y_data=None, add_zero_line=False):
        """Generic method to plot a frame feature.
        
        Args:
            feature_type: Type of feature ('zcr', 'energy', 'pitch')
            frame: Audio frame data
            value: Feature value
            frame_index: Frame index
            y_data: Data to plot (defaults to frame)
            add_zero_line: Whether to add a horizontal line at y=0
        """
        if y_data is None:
            y_data = frame
            
        plt.figure(figsize=(10, 4))
        plt.plot(np.arange(len(frame)), y_data)
        
        if add_zero_line:
            plt.axhline(y=0, color='r', linestyle='-')
        
        # Add threshold lines for relevant features
        if feature_type == 'zcr' and hasattr(self, 'classifier'):
            plt.axhline(y=self.classifier.zcr_threshold, color='g', linestyle='--', 
                       label=f'ZCR Threshold = {self.classifier.zcr_threshold}')
            plt.legend()
        elif feature_type == 'energy' and hasattr(self, 'classifier'):
            plt.axhline(y=self.classifier.energy_threshold, color='g', linestyle='--', 
                       label=f'Energy Threshold = {self.classifier.energy_threshold}')
            plt.legend()
            
        plt.title(f'{feature_type.title()}: {value:.4f}')
        plt.xlabel('Sample')
        plt.ylabel('Amplitude')
        plt.tight_layout()
        
        # Save to the appropriate directory
        output_path = os.path.join(self.feature_dirs[feature_type], f'{frame_index}.png')
        plt.savefig(output_path)
        plt.close()

    def plot_zcr_classification_comparison(self, frames, labels, classifier):
        """Plot ZCR values and classification results side by side with threshold.
        
        Args:
            frames: Extracted audio frames
            labels: Classification labels (2=voiced, 1=unvoiced, 0=silent)
            classifier: VoiceClassifier instance
        """
        # Extract ZCR values for each frame
        zcrs = np.zeros(len(frames))
        sr = 16000  # Default sample rate, not critical for this visualization
        
        for i, frame in enumerate(frames):
            features = classifier.extract_features_from_frame(frame, sr)
            zcrs[i] = features["zcr"]
        
        # Create the plot
        fig, ax = plt.subplots(figsize=(14, 6))
        
        # Frame time for x-axis
        frame_time = np.arange(len(frames)) * 0.01  # Assuming 10ms frame stride
        
        # Plot ZCR values
        ax.plot(frame_time, zcrs, label='ZCR')
        
        # Add threshold line
        ax.axhline(y=classifier.zcr_threshold, color='r', linestyle='--', 
                 label=f'ZCR Threshold = {classifier.zcr_threshold}')
        
        # Create a twin y-axis for the classification
        ax2 = ax.twinx()
        ax2.plot(frame_time, labels, 'g-', alpha=0.5, label='Classification')
        ax2.set_ylim(-0.1, 2.1)
        ax2.set_ylabel('Classification (2=voiced, 1=unvoiced, 0=silent)')
        
        # Add legends
        ax.legend(loc='upper left')
        ax2.legend(loc='upper right')
        
        # Set labels and title
        ax.set_xlabel('Time (s)')
        ax.set_ylabel('Zero Crossing Rate')
        ax.set_title('ZCR vs Classification with Threshold')
        
        plt.tight_layout()
        output_path = os.path.join(self.output_dir, 'zcr_classification_comparison.png')
        plt.savefig(output_path)
        plt.close()
        
        return output_path 
        
    def plot_autocorrelation(self, autocorr, min_lag, max_lag, peak_idx, peak_value, threshold=0.3, title=None):
        """Plot autocorrelation function with pitch detection.
        
        Args:
            autocorr: Autocorrelation array
            min_lag: Minimum lag for pitch detection
            max_lag: Maximum lag for pitch detection
            peak_idx: Index of detected peak
            peak_value: Value at peak
            threshold: Voicing decision threshold
            title: Optional title for the plot
        """
        plt.figure(figsize=(12, 6))
        
        # Plot full autocorrelation
        plt.plot(autocorr, label='Autocorrelation')
        
        # Highlight search range
        plt.axvspan(min_lag, max_lag, alpha=0.2, color='green', label='Valid pitch range')
        
        # Mark the peak
        plt.plot(peak_idx, peak_value, 'ro', markersize=8, label=f'Peak at lag {peak_idx}')
        
        # Add threshold line
        plt.axhline(y=threshold, color='r', linestyle='--', label=f'Voicing threshold = {threshold}')
        
        # Add labels and legend
        plt.xlabel('Lag (samples)')
        plt.ylabel('Autocorrelation')
        plt.title(title or 'Autocorrelation Function for Pitch Detection')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        # Set y-axis limits to focus on the important part
        plt.ylim(-0.5, 1.1)
        
        # Extract frame index from title if available
        frame_idx = 'unknown'
        if title and 'Frame ' in title:
            try:
                frame_idx = title.split('Frame ')[1].split(':')[0]
            except:
                pass
        
        # Save to pitch directory with frame index
        output_path = os.path.join(self.feature_dirs['pitch'], f'autocorr_{frame_idx}.png')
        plt.savefig(output_path)
        
        # Don't close the figure yet, in case text needs to be added
        return output_path
    
    def add_text_to_current_plot(self, text, x=0.02, y=0.02):
        """Add text to the current matplotlib plot.
        
        Args:
            text: Text to add
            x, y: Position (in figure coordinates, 0-1)
        """
        # Add text box with classification info
        plt.figtext(x, y, text, bbox=dict(facecolor='white', alpha=0.8), 
                  fontsize=9, verticalalignment='bottom')
        
        # Extract frame index from figure title if available
        frame_idx = 'unknown'
        if plt.gca().get_title() and 'Frame ' in plt.gca().get_title():
            try:
                frame_idx = plt.gca().get_title().split('Frame ')[1].split(':')[0]
            except:
                pass
        
        # Now save and close the figure
        plt.tight_layout()
        output_path = os.path.join(self.feature_dirs['pitch'], f'autocorr_with_info_{frame_idx}.png')
        plt.savefig(output_path)
        plt.close()
        
        return output_path 
    
    def plot_pitch_detection(self, frame, sr, classifier, frame_index=None):
        """Visualize the pitch detection process for a frame.
        
        Args:
            frame: The audio frame to analyze
            sr: Sample rate
            classifier: VoiceClassifier instance
            frame_index: Optional frame index for plot title
        """
        # Calculate autocorrelation
        auto_corr = classifier.autocorrelation(frame)
        
        # Get pitch parameters
        frame_length_ms = 25
        min_pitch = 50  # Hz
        max_pitch = 500 # Hz
        
        min_lag = int(sr / max_pitch)
        max_lag = int(sr / min_pitch)
        
        if max_lag >= len(auto_corr):
            max_lag = len(auto_corr) - 1
        
        # Find the peak in the autocorrelation
        peak_idx = np.argmax(auto_corr[min_lag:max_lag]) + min_lag
        peak_value = auto_corr[peak_idx]
        
        # Determine if voiced
        is_voiced = peak_value > 0.3
        pitch = sr / peak_idx if is_voiced else 0
        
        # Create figure with two subplots
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
        
        # Plot input frame waveform
        ax1.plot(np.arange(len(frame)), frame)
        ax1.set_title(f"Frame {frame_index} Waveform")
        ax1.set_xlabel("Sample")
        ax1.set_ylabel("Amplitude")
        ax1.grid(True, alpha=0.3)
        
        # Plot autocorrelation in second subplot
        ax2.plot(auto_corr, label='Autocorrelation')
        
        # Highlight search range
        ax2.axvspan(min_lag, max_lag, alpha=0.2, color='green', label='Valid pitch range')
        
        # Mark the peak
        ax2.plot(peak_idx, peak_value, 'ro', markersize=8, label=f'Peak at lag {peak_idx}')
        
        # Add threshold line
        ax2.axhline(y=0.3, color='r', linestyle='--', label=f'Voicing threshold = 0.3')
        
        # Add labels and legend for autocorrelation plot
        ax2.set_xlabel('Lag (samples)')
        ax2.set_ylabel('Autocorrelation')
        ax2.set_ylim(-0.5, 1.1)
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        # Create main title for the figure
        plt_title = f"Frame {frame_index}: " if frame_index is not None else ""
        plt_title += f"Pitch Detection - {'Voiced' if is_voiced else 'Unvoiced'}"
        
        if is_voiced:
            plt_title += f" (Pitch: {pitch:.1f}Hz)"
            
        fig.suptitle(plt_title, fontsize=14)
        
        # Calculate additional features
        zcr = classifier.zero_crossing_rate(frame)
        energy = classifier.short_time_energy(frame)
        
        # Prepare classification info text
        info_text = f"ZCR: {zcr:.4f} (Threshold: {classifier.zcr_threshold})\n"
        info_text += f"Energy: {energy:.6f} (Threshold: {classifier.energy_threshold})\n"
        info_text += f"Peak Value: {peak_value:.4f} (Threshold: 0.3)\n"
        
        # Show classification logic
        is_voiced_by_classifier = (
            zcr < classifier.zcr_threshold and 
            energy > classifier.energy_threshold and 
            is_voiced
        )
        
        if energy < classifier.silence_threshold:
            classification = "Silent (0)"
        elif is_voiced_by_classifier:
            classification = "Voiced (2)"
        else:
            classification = "Unvoiced (1)"
        
        info_text += f"Classification: {classification}"
        
        # Add the text to the figure
        plt.figtext(0.02, 0.02, info_text, bbox=dict(facecolor='white', alpha=0.8), 
                  fontsize=9, verticalalignment='bottom')
        
        # Adjust layout and save figure
        plt.tight_layout()
        plt.subplots_adjust(top=0.9)  # Make room for the suptitle
        
        # Extract frame index for the filename
        frame_idx = frame_index if frame_index is not None else 'unknown'
        
        # Save the figure
        output_path = os.path.join(self.feature_dirs['pitch'], f'frame_and_autocorr_{frame_idx}.png')
        plt.savefig(output_path)
        plt.close()
        
        return output_path