from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import re
from typing import Dict, Optional

def extract_video_id(url: str) -> Optional[str]:
    """Extrait l'ID YouTube de l'URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/embed\/([^&\n?#]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_video_metadata(url: str) -> Dict:
    """Récupère métadonnées vidéo sans télécharger"""
    video_id = extract_video_id(url)

    if not video_id:
        return {"success": False, "error": "invalid_url"}

    try:
        import yt_dlp

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'skip_download': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            duration_seconds = info.get('duration', 0)
            duration_minutes = round(duration_seconds / 60, 1)

            return {
                "success": True,
                "video_id": video_id,
                "title": info.get('title', 'Sans titre'),
                "duration_seconds": duration_seconds,
                "duration_minutes": duration_minutes,
                "thumbnail": info.get('thumbnail'),
                "channel": info.get('uploader', 'Inconnu'),
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_original_transcript(url: str) -> Dict:
    """Récupère transcript langue originale prioritaire"""
    video_id = extract_video_id(url)

    if not video_id:
        return {"success": False, "error": "invalid_url"}

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Priorité 1 : Manuels langue originale
        try:
            manual = transcript_list.find_manually_created_transcript([
                'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'
            ])
            data = manual.fetch()
            text = " ".join([entry['text'] for entry in data])

            return {
                "success": True,
                "transcript": text,
                "language": manual.language_code,
                "is_manual": True,
                "word_count": len(text.split())
            }
        except:
            pass

        # Priorité 2 : Auto-générés langue originale
        try:
            auto = transcript_list.find_generated_transcript([
                'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'
            ])
            data = auto.fetch()
            text = " ".join([entry['text'] for entry in data])

            return {
                "success": True,
                "transcript": text,
                "language": auto.language_code,
                "is_manual": False,
                "word_count": len(text.split())
            }
        except:
            pass

        return {
            "success": False,
            "error": "no_subtitles",
            "message": "Cette vidéo n'a pas de sous-titres disponibles"
        }

    except TranscriptsDisabled:
        return {
            "success": False,
            "error": "subtitles_disabled",
            "message": "Les sous-titres sont désactivés"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}