import re
from statistics import mean


PHRASE_TO_ACTION = {
    "move left": "MOVE_LEFT",
    "more left": "MOVE_LEFT",
    "move right": "MOVE_RIGHT",
    "more right": "MOVE_RIGHT",
    "move up": "MOVE_UP",
    "move down": "MOVE_DOWN",
    "start": "START",
    "drink water": "DRINK_WATER",
    "stop": "STOP",
}


def normalize_phrase(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text.lower())).strip()


def map_phrase(text: str) -> str | None:
    """Return an explicitly approved action ID, with no fuzzy matching."""
    return PHRASE_TO_ACTION.get(normalize_phrase(text))


def evaluate_transcription(result: dict, min_avg_logprob: float = -0.8, max_no_speech_prob: float = 0.6) -> dict:
    text = str(result.get("text", "")).strip()
    segments = result.get("segments") or []
    if not text or not segments:
        return {"accepted": False, "action": None, "text": text, "reason": "No clear speech was detected", "avgLogprob": None}

    logprobs = [segment.get("avg_logprob") for segment in segments]
    no_speech = [segment.get("no_speech_prob") for segment in segments]
    if any(not isinstance(value, (int, float)) for value in logprobs + no_speech):
        return {"accepted": False, "action": None, "text": text, "reason": "Recognition confidence data was unavailable", "avgLogprob": None}

    avg_logprob = mean(logprobs)
    max_no_speech = max(no_speech)
    if avg_logprob < min_avg_logprob or max_no_speech > max_no_speech_prob:
        return {
            "accepted": False,
            "action": None,
            "text": text,
            "reason": "Speech confidence was below the configured threshold",
            "avgLogprob": avg_logprob,
        }

    action = map_phrase(text)
    if action is None:
        return {
            "accepted": False,
            "action": None,
            "text": text,
            "reason": "Phrase is not in the approved command list",
            "avgLogprob": avg_logprob,
        }

    return {"accepted": True, "action": action, "text": text, "reason": None, "avgLogprob": avg_logprob}
