import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart';

class AudioExclusivityService {
  static VideoPlayerController? _activeVideoController;
  static AudioPlayer? _activeAudioPlayer;

  static void registerVideoController(VideoPlayerController controller) {
    _activeVideoController = controller;
  }

  static void unregisterVideoController(VideoPlayerController controller) {
    if (_activeVideoController == controller) {
      _activeVideoController = null;
    }
  }

  static void onVideoPlay() {
    if (_activeAudioPlayer != null) {
      _activeAudioPlayer!.pause();
      debugPrint('AudioExclusivityService: Paused active audio player because video started playing');
    }
  }

  static void registerAudioPlayer(AudioPlayer player) {
    _activeAudioPlayer = player;
    
    // Listen to audio player state changes
    player.onPlayerStateChanged.listen((state) {
      if (state == PlayerState.playing) {
        onAudioPlay();
      }
    });
  }

  static void onAudioPlay() {
    if (_activeVideoController != null && _activeVideoController!.value.isPlaying) {
      _activeVideoController!.pause();
      debugPrint('AudioExclusivityService: Paused active video controller because audio started playing');
    }
  }
}
