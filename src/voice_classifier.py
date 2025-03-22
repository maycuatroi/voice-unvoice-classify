import numpy as np

class VoiceClassifier:
    """Core class for voice/unvoiced classification algorithm"""
    
    def __init__(self, zcr_threshold=0.1, energy_threshold=0.0001, silence_threshold=0.00001):
        """Initialize the classifier with thresholds."""
        self.zcr_threshold = zcr_threshold
        self.energy_threshold = energy_threshold
        self.silence_threshold = silence_threshold
    
    def extract_frames(self, signal, sr, frame_length=25, frame_stride=10):
        """Extract frames from audio signal.
        
        Args:
            signal: Audio signal
            sr: Sample rate
            frame_length: Frame length in ms
            frame_stride: Frame stride in ms
        
        Returns:
            frames: Numpy array of frames
        """
        frame_length = int(sr * frame_length / 1000)
        frame_stride = int(sr * frame_stride / 1000)
        
        signal_length = len(signal)
        frame_count = int(np.ceil((signal_length - frame_length) / frame_stride)) + 1
        
        frames = np.zeros((frame_count, frame_length))
        
        for i in range(frame_count):
            start = i * frame_stride
            end = min(start + frame_length, signal_length)
            frames[i, :end-start] = signal[start:end]
            
        return frames
    
    def zero_crossing_rate(self, frame):
        """Calculate zero crossing rate of a frame."""
        return np.sum(np.abs(np.diff(np.sign(frame)))) / (2 * len(frame))
    
    def short_time_energy(self, frame):
        """Calculate short-time energy of a frame."""
        return np.sum(frame**2) / len(frame)
    
    def autocorrelation(self, frame):
        """Calculate autocorrelation of a frame."""
        corr = np.correlate(frame, frame, mode='full')
        corr = corr[len(corr)//2:]
        return corr / np.max(corr)
    
    def get_pitch(self, autocorr, sr, frame_length=25):
        """Estimate pitch from autocorrelation.
        
        Returns:
            pitch: Estimated pitch in Hz
            is_voiced: Boolean indicating if frame is voiced
        """
        frame_length_samples = int(sr * frame_length / 1000)
        
        # Minimum and maximum pitch values in Hz
        min_pitch = 50  # Hz
        max_pitch = 500 # Hz
        
        min_lag = int(sr / max_pitch)
        max_lag = int(sr / min_pitch)
        
        if max_lag >= len(autocorr):
            max_lag = len(autocorr) - 1
        
        # Find the peak in the autocorrelation within the specified range
        peak_idx = np.argmax(autocorr[min_lag:max_lag]) + min_lag
        peak_value = autocorr[peak_idx]
        
        # Determine if the frame is voiced based on the peak value
        is_voiced = peak_value > 0.3  # This threshold can be adjusted
        
        # Calculate pitch
        if is_voiced:
            pitch = sr / peak_idx
        else:
            pitch = 0
        
        return pitch, is_voiced
    
    def extract_features_from_frame(self, frame, sr):
        """Extract acoustic features from a single frame.
        
        Returns:
            Dictionary containing features: zcr, energy, auto_corr, pitch, is_voiced_pitch
        """
        # Calculate features
        zcr = self.zero_crossing_rate(frame)
        energy = self.short_time_energy(frame)
        auto_corr = self.autocorrelation(frame)
        pitch, is_voiced_pitch = self.get_pitch(auto_corr, sr)
        
        return {
            "zcr": zcr,
            "energy": energy,
            "auto_corr": auto_corr,
            "pitch": pitch,
            "is_voiced_pitch": is_voiced_pitch
        }
    
    def classify_frame(self, features):
        """Classify a frame as voiced, unvoiced, or silent using features.
        
        Args:
            features: Dictionary containing extracted features
            
        Returns:
            2 for voiced, 1 for unvoiced, 0 for silent
        """
        # Check for silence first (very low energy)
        if features["energy"] < self.silence_threshold:
            return 0  # Silent
        
        # Decision based on multiple features
        if features["zcr"] < self.zcr_threshold and features["energy"] > self.energy_threshold and features["is_voiced_pitch"]:
            return 2  # Voiced
        else:
            return 1  # Unvoiced
    
    def extract_features(self, frames, sr):
        """Extract all features from frames."""
        n_frames = len(frames)
        
        # Feature arrays
        zcrs = np.zeros(n_frames)
        energies = np.zeros(n_frames)
        pitches = np.zeros(n_frames)
        labels = np.zeros(n_frames)
        
        for i, frame in enumerate(frames):
            # Use the new extract_features_from_frame function
            features = self.extract_features_from_frame(frame, sr)
            
            # Store features in arrays
            zcrs[i] = features["zcr"]
            energies[i] = features["energy"]
            pitches[i] = features["pitch"]
            
            # Classify the frame using the extracted features
            labels[i] = self.classify_frame(features)
        
        # Combine features
        features = np.column_stack((zcrs, energies, pitches))
        
        return features, labels
    
    def process(self, signal, sr):
        """Process audio signal and classify frames.
        
        Args:
            signal: Audio signal
            sr: Sample rate
            
        Returns:
            frames: Extracted frames
            features: Extracted features
            labels: Classification labels
        """
        # Extract frames
        frames = self.extract_frames(signal, sr)
        
        # Extract features and classify
        features, labels = self.extract_features(frames, sr)
        
        return frames, features, labels 