import unittest

from hydra_voice.commands import evaluate_transcription, map_phrase


class VoiceCommandTests(unittest.TestCase):
    def transcription(self, text, avg_logprob=-0.2, no_speech_prob=0.1):
        return {
            "text": text,
            "segments": [{"avg_logprob": avg_logprob, "no_speech_prob": no_speech_prob}],
        }

    def test_only_explicit_phrases_map_to_actions(self):
        self.assertEqual(map_phrase("Move left!"), "MOVE_LEFT")
        self.assertEqual(map_phrase("more right"), "MOVE_RIGHT")
        self.assertEqual(map_phrase("move the arm left"), None)

    def test_low_confidence_and_unsupported_phrases_are_rejected(self):
        low_confidence = evaluate_transcription(self.transcription("move left", avg_logprob=-1.2))
        unsupported = evaluate_transcription(self.transcription("please wave"))
        no_speech = evaluate_transcription(self.transcription("stop", no_speech_prob=0.9))
        self.assertFalse(low_confidence["accepted"])
        self.assertFalse(unsupported["accepted"])
        self.assertFalse(no_speech["accepted"])

    def test_approved_clear_phrase_returns_protocol_action(self):
        result = evaluate_transcription(self.transcription("Drink water"))
        self.assertTrue(result["accepted"])
        self.assertEqual(result["action"], "DRINK_WATER")


if __name__ == "__main__":
    unittest.main()
