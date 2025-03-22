import argparse
import os
from src.voice_classifier import VoiceClassifier
from src.audio_visualizer import AudioVisualizer
from src.audio_file_handler import AudioFileHandler
from src.voice_downloader import VoiceDownloader

def main():
    """Main entry point for the application."""
    parser = argparse.ArgumentParser(description="Voice/Unvoiced Classification Tool")
    parser.add_argument("-f", "--file", type=str, help="Path to audio file (MP3, WAV) to analyze")
    parser.add_argument("-o", "--output", type=str, default="output", help="Directory to save output files")
    args = parser.parse_args()
    
    print("Voice/Unvoiced/Silent Classification Tool")
    print("---------------------------------")
    
    # Initialize the classes
    classifier = VoiceClassifier()
    visualizer = AudioVisualizer(output_dir=args.output)
    file_handler = AudioFileHandler(output_dir=args.output)
    
    if args.file:
        if os.path.exists(args.file):
            print(f"Processing audio file: {args.file}")
            features, labels = file_handler.process_audio_file(args.file, classifier, visualizer)
            print(f"Processing complete. Results saved to '{args.output}' directory")
        else:
            print(f"Error: File {args.file} not found")
    else:
        # word = input("Enter a word to download and analyze: ") or "Hello Today is a good day take a deep breath"
        word = "Hello Today is a good day take a deep breath"
        voice_downloader = VoiceDownloader()
        file_name = voice_downloader.download_voice(word)
        assert file_name is not None, f"Failed to download {word}"
        assert os.path.exists(file_name), f"File {file_name} not found"
        features, labels = file_handler.process_audio_file(file_name, classifier, visualizer)
        print(f"Processing complete. Results saved to '{args.output}' directory")


if __name__ == "__main__":
    main() 