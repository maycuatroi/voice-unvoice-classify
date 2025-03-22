from gtts import gTTS


class VoiceDownloader:
    def __init__(self):
        pass

    def download_voice(self, word:str):
        print(f"Downloading {word} to {word}.mp3")
        tts = gTTS(text=word, lang='en')
        tts.save(f"{word}.mp3")
        return f"{word}.mp3"
    
    
if __name__ == "__main__":
    voice_downloader = VoiceDownloader()
    voice_downloader.download_voice("hello Today is a good day")
