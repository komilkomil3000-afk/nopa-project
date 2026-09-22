import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart';

class AudioExclusivityService {
  static VideoPlayerController? _activeVideoController;
  static AudioPlayer? _activeAudioPlayer;
  static StreamSubscription<PlayerState>? _audioSubscription;

  static void registerVideoController(VideoPlayerController controller) {
    try {
      if (_activeVideoController != null && _activeVideoController != controller) {
        if (_activeVideoController!.value.isInitialized && _activeVideoController!.value.isPlaying) {
          _activeVideoController!.pause();
        }
      }
      _activeVideoController = controller;
    } catch (e) {
      debugPrint('AudioExclusivityService registerVideoController error: $e');
    }
  }

  static void unregisterVideoController(VideoPlayerController controller) {
    if (_activeVideoController == controller) {
      _activeVideoController = null;
    }
  }

  static void onVideoPlay() {
    try {
      if (_activeAudioPlayer != null) {
        _activeAudioPlayer!.pause();
        debugPrint(
            'AudioExclusivityService: Paused active audio player because video started playing');
      }
    } catch (e) {
      debugPrint('AudioExclusivityService onVideoPlay error: $e');
    }
  }

  static void registerAudioPlayer(AudioPlayer player) {
    try {
      _activeAudioPlayer = player;
      _audioSubscription?.cancel();
      _audioSubscription = player.onPlayerStateChanged.listen(
        (state) {
          if (state == PlayerState.playing) {
            onAudioPlay();
          }
        },
        onError: (err) {
          debugPrint('AudioExclusivityService player state error: $err');
        },
      );
    } catch (e) {
      debugPrint('AudioExclusivityService registerAudioPlayer error: $e');
    }
  }

  static void unregisterAudioPlayer(AudioPlayer player) {
    try {
      if (_activeAudioPlayer == player) {
        _audioSubscription?.cancel();
        _audioSubscription = null;
        _activeAudioPlayer = null;
      }
    } catch (e) {
      debugPrint('AudioExclusivityService unregisterAudioPlayer error: $e');
    }
  }

  static void onAudioPlay() {
    try {
      if (_activeVideoController != null &&
          _activeVideoController!.value.isInitialized &&
          _activeVideoController!.value.isPlaying) {
        _activeVideoController!.pause();
        debugPrint(
            'AudioExclusivityService: Paused active video controller because audio started playing');
      }
    } catch (e) {
      debugPrint('AudioExclusivityService onAudioPlay error: $e');
    }
  }
}

