import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../utils/global_state.dart';
import '../services/app_state_repository.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../widgets/reward_popup.dart';
import 'dart:async';
import 'dart:convert';
import 'package:url_launcher/url_launcher.dart';
import '../services/audio_exclusivity_service.dart';
import '../widgets/safe_avatar.dart';

class ClassPlayerScreen extends StatefulWidget {
  const ClassPlayerScreen({super.key});

  @override
  State<ClassPlayerScreen> createState() => _ClassPlayerScreenState();
}

class _ClassPlayerScreenState extends State<ClassPlayerScreen> {
  int _currentClassIndex = 0;
  int _currentClipIndex = 0;
  List<Map<String, dynamic>> _classes = [];
  bool _isLoadingClasses = true;
  List<dynamic> _userProgress = [];

  late VideoPlayerController _videoPlayerController;
  bool _isVideoInitialized = false;
  bool _hasVideoError = false;
  bool _isQuizUnlocked = false;
  bool _isMiniQuizShowing = false;
  double _playbackSpeed = 1.0;
  Timer? _heartbeatTimer;

  // ignore: unused_field
  List<Map<String, dynamic>> _bookmarks = [];
  // ignore: unused_field
  bool _isLoadingBookmarks = false;

  bool _argumentsLoaded = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_argumentsLoaded) {
      _argumentsLoaded = true;
      _loadClassPlayerArguments();
    }
  }

  void _loadClassPlayerArguments() {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null) {
      final passedClasses = args['classes'] as List?;
      final initialIndex = args['initialIndex'] as int? ?? 0;

      if (passedClasses != null && passedClasses.isNotEmpty) {
        HttpApiService().getUserProgress().then((progress) {
          if (mounted) {
            setState(() {
              _classes = passedClasses
                  .map((c) => c as Map<String, dynamic>)
                  .toList();
              _currentClassIndex = initialIndex;
              _isLoadingClasses = false;
              _userProgress = progress;
            });
            _initializeVideo();
          }
        });
        return;
      }
    }

    _fetchClasses();
  }

  Future<void> _fetchClasses() async {
    final apiService = HttpApiService();
    final classes = await apiService.getClasses();
    final progress = await apiService.getUserProgress();
    if (mounted) {
      setState(() {
        _classes = classes;
        _userProgress = progress;
        _isLoadingClasses = false;
      });
      if (_classes.isNotEmpty) {
        _initializeVideo();
      }
    }
  }

  bool _isLocked = false;

  void _initializeVideo() {
    setState(() {
      _isVideoInitialized = false;
      _hasVideoError = false;
      _isQuizUnlocked = false;
      _isMiniQuizShowing = false;
      _isLocked = false;
      _currentClipIndex = 0;
    });

    if (_classes.isEmpty) return;

    final currentClass = _classes[_currentClassIndex];
    _fetchBookmarks(currentClass['id']);
    final int costZarik =
        (currentClass['unlockCostZarik'] as num?)?.toInt() ?? 0;

    // Check if locked
    // Mock user model to check hasPrePaidClasses
    // We assume getMe() provides user info.
    _checkLockStatus(costZarik);
  }

  Future<void> _checkLockStatus(int costZarik) async {
    // Disabled sequential class locking per requirements (independent track progression)
    _proceedWithVideo();
  }

  Future<void> _fetchBookmarks(String sessionId) async {
    setState(() {
      _isLoadingBookmarks = true;
    });
    final bms = await HttpApiService().getBookmarks(sessionId);
    if (mounted) {
      setState(() {
        _bookmarks = bms;
        _isLoadingBookmarks = false;
      });
    }
  }

  // ignore: unused_element
  void _addBookmark() {
    if (!_videoPlayerController.value.isInitialized) return;

    final currentPos = _videoPlayerController.value.position.inSeconds;
    final noteController = TextEditingController();

    _videoPlayerController.pause();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1435),
        title: const Text(
          'افزودن نشانک',
          style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
        ),
        content: TextField(
          controller: noteController,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'یادداشت خود را بنویسید...',
            hintStyle: TextStyle(color: Colors.white54),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _videoPlayerController.play();
            },
            child: const Text(
              'انصراف',
              style: TextStyle(color: Colors.white70),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              final note = noteController.text.trim();
              if (note.isNotEmpty) {
                final currentClass = _classes[_currentClassIndex];
                await HttpApiService().addBookmark(
                  currentClass['id'],
                  currentPos,
                  note,
                );
                _fetchBookmarks(currentClass['id']);
              }
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              _videoPlayerController.play();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD946EF),
            ),
            child: const Text('ذخیره', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _proceedWithVideo() {
    if (!mounted) return;
    setState(() {
      _isMiniQuizShowing = false;
    });
    final currentClass = _classes[_currentClassIndex];
    final List clips = currentClass['videoClips'] ?? [];

    String url = '';
    if (clips.isNotEmpty && _currentClipIndex < clips.length) {
      url = clips[_currentClipIndex]['videoUrl'] ?? '';
    } else {
      url = currentClass['videoUrl'] ?? '';
    }

    if (url.startsWith('/')) {
      final baseUrl = HttpApiService().baseUrl.replaceAll('/api/v1', '');
      url = '$baseUrl$url';
    }

    if (url.isEmpty) {
      if (mounted) setState(() => _hasVideoError = true);
      return;
    }

    String resolvedUrl = HttpApiService().resolveMediaUrl(url);
    if (resolvedUrl.contains('localhost') ||
        resolvedUrl.contains('127.0.0.1')) {
      final baseUrl = HttpApiService().baseUrl;
      final hostIp = Uri.parse(baseUrl).host;
      resolvedUrl = resolvedUrl
          .replaceAll('localhost', hostIp)
          .replaceAll('127.0.0.1', hostIp);
    }

    _videoPlayerController =
        VideoPlayerController.networkUrl(Uri.parse(resolvedUrl))
          ..initialize()
              .then((_) async {
                if (!mounted) return;

                final progress = await HttpApiService().getWatchProgress(
                  currentClass['id'],
                );
                int resumePos = 0;
                bool isUnlocked = false;
                if (progress != null) {
                  resumePos =
                      (progress['resumePosition'] as num?)?.toInt() ?? 0;
                  isUnlocked =
                      (progress['watchedPercentage'] as num? ?? 0.0) >= 60.0;
                }

                setState(() {
                  _isVideoInitialized = true;
                  _isQuizUnlocked = isUnlocked;
                });

                if (resumePos > 0) {
                  await _videoPlayerController.seekTo(
                    Duration(seconds: resumePos),
                  );
                }

                _videoPlayerController.setPlaybackSpeed(_playbackSpeed);
                _videoPlayerController.addListener(_videoListener);
                AudioExclusivityService.registerVideoController(
                  _videoPlayerController,
                );

                _videoPlayerController.play();
                AudioExclusivityService.onVideoPlay();
                _startHeartbeatTimer();
              })
              .catchError((error) {
                debugPrint('Video init error: $error');
                if (mounted) {
                  setState(() {
                    _hasVideoError = true;
                  });
                }
              });
  }

  void _videoListener() {
    if (_videoPlayerController.value.isInitialized) {
      final pos = _videoPlayerController.value.position.inMilliseconds;
      final dur = _videoPlayerController.value.duration.inMilliseconds;

      final currentClass = _classes[_currentClassIndex];
      final List clips = currentClass['videoClips'] ?? [];

      // Trigger mini quiz if ended
      if (dur > 0 && pos >= dur && !_isMiniQuizShowing) {
        setState(() {
          _isMiniQuizShowing = true;
        });
        _videoPlayerController.pause();

        // Show the quiz and wait for it to close
        Future.delayed(Duration.zero, () {
          _showPartMiniQuiz(_currentClipIndex);
        });
        return;
      }

      if (dur > 0 && pos >= dur * 0.6 && !_isQuizUnlocked) {
        setState(() {
          _isQuizUnlocked = true;
        });
        if (clips.isNotEmpty && _currentClipIndex < clips.length) {
            final currentClip = clips[_currentClipIndex];
            final currentClipId = currentClip['id'];
            final categoryTitle = currentClass['category']?['title']?.toString() ?? '';
            final trackType = categoryTitle.contains('مهارتی') ? 'skill' : 'media';
            HttpApiService().markClipWatched(currentClipId, trackType: trackType, stationId: currentClass['categoryId'] ?? 'unknown', sessionId: currentClass['id']);
            
            final progIndex = _userProgress.indexWhere((p) => p['clipId'] == currentClipId);
            if (progIndex != -1) {
               _userProgress[progIndex]['isWatched'] = true;
            } else {
               _userProgress.add({
                 'clipId': currentClipId,
                 'isWatched': true,
                 'quizPassed': false,
                 'trackType': trackType
               });
            }
        }
        if (clips.isEmpty || _currentClipIndex == clips.length - 1) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'آزمون کلاس فعال شد!',
                style: TextStyle(fontFamily: 'Vazirmatn'),
              ),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    }
  }

  void _startHeartbeatTimer() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_isVideoInitialized && _videoPlayerController.value.isPlaying) {
        final currentClass = _classes[_currentClassIndex];
        final pos = _videoPlayerController.value.position.inSeconds;
        final dur = _videoPlayerController.value.duration.inSeconds;
        if (dur > 0) {
          final res = await HttpApiService().sendWatchHeartbeat(
            currentClass['id'],
            pos,
            dur,
          );
          if (res != null && mounted) {
            final double watchedPercent =
                (res['watchedPercentage'] as num?)?.toDouble() ?? 0.0;
            setState(() {
              _isQuizUnlocked = watchedPercent >= 70.0;
            });
          }
        }
      }
    });
  }

  void _stopHeartbeatTimer() {
    _heartbeatTimer?.cancel();
  }

  @override
  void dispose() {
    _stopHeartbeatTimer();
    _videoPlayerController.removeListener(_videoListener);
    AudioExclusivityService.unregisterVideoController(_videoPlayerController);
    _videoPlayerController.dispose();
    super.dispose();
  }

  void _copyLink(String link) {
    Clipboard.setData(ClipboardData(text: link));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'لینک پخش کپی شد',
          style: TextStyle(fontFamily: 'Vazirmatn'),
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.purple,
      ),
    );
  }

  Widget _buildVideoControlsOverlay() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        color: Colors.black54,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: Icon(
                _videoPlayerController.value.isPlaying
                    ? Icons.pause
                    : Icons.play_arrow,
                color: Colors.white,
                size: 20,
              ),
              onPressed: () {
                setState(() {
                  if (_videoPlayerController.value.isPlaying) {
                    _videoPlayerController.pause();
                  } else {
                    _videoPlayerController.play();
                    AudioExclusivityService.onVideoPlay();
                  }
                });
              },
            ),
            Expanded(
              child: VideoProgressIndicator(
                _videoPlayerController,
                allowScrubbing: false,
                colors: const VideoProgressColors(
                  playedColor: Color(0xFFD946EF),
                  bufferedColor: Colors.white24,
                  backgroundColor: Colors.white12,
                ),
              ),
            ),
            const SizedBox(width: 8),
            ValueListenableBuilder(
              valueListenable: _videoPlayerController,
              builder: (context, VideoPlayerValue value, child) {
                final duration = value.duration;
                final position = value.position;
                return Text(
                  '${position.inMinutes}:${(position.inSeconds % 60).toString().padLeft(2, '0')} / ${duration.inMinutes}:${(duration.inSeconds % 60).toString().padLeft(2, '0')}',
                  style: const TextStyle(color: Colors.white, fontSize: 10),
                );
              },
            ),
            const SizedBox(width: 8),
            PopupMenuButton<double>(
              initialValue: _playbackSpeed,
              tooltip: 'سرعت پخش',
              icon: Text(
                '${_playbackSpeed}x',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
              onSelected: (double speed) {
                setState(() {
                  _playbackSpeed = speed;
                  _videoPlayerController.setPlaybackSpeed(speed);
                });
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 0.75, child: Text('0.75x')),
                const PopupMenuItem(value: 1.0, child: Text('1.0x')),
                const PopupMenuItem(value: 1.25, child: Text('1.25x')),
                const PopupMenuItem(value: 1.5, child: Text('1.5x')),
                const PopupMenuItem(value: 2.0, child: Text('2.0x')),
              ],
            ),
            const SizedBox(width: 8),
            PopupMenuButton<String>(
              initialValue: 'auto',
              tooltip: 'کیفیت ویدیو',
              icon: const Icon(Icons.settings, color: Colors.white, size: 20),
              onSelected: (String quality) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'کیفیت $quality انتخاب شد',
                      style: const TextStyle(fontFamily: 'Vazirmatn'),
                    ),
                    duration: const Duration(seconds: 2),
                    backgroundColor: const Color(0xFFD946EF),
                  ),
                );
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'auto', child: Text('خودکار', style: TextStyle(fontFamily: 'Vazirmatn'))),
                const PopupMenuItem(value: '1080p', child: Text('1080p')),
                const PopupMenuItem(value: '720p', child: Text('720p')),
                const PopupMenuItem(value: '480p', child: Text('480p')),
                const PopupMenuItem(value: '360p', child: Text('360p')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingClasses) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F081D),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFFD946EF)),
        ),
      );
    }

    if (_classes.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F081D),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: const Center(
          child: Text(
            'هیچ کلاسی یافت نشد.',
            style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
          ),
        ),
      );
    }

    final currentClass = _classes[_currentClassIndex];

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              color: Colors.white10,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close, color: Colors.white, size: 20),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          currentClass['title'] ?? 'بدون عنوان',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
            fontFamily: 'Vazirmatn',
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  color: Colors.black,
                  child: _isLocked
                      ? _buildLockedScreen(currentClass)
                      : (_hasVideoError
                            ? Container(
                                color: const Color(0xFF1E1435),
                                child: Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.error_outline,
                                        color: Colors.redAccent,
                                        size: 48,
                                      ),
                                      const SizedBox(height: 12),
                                      const Text(
                                        'ویدیو در دسترس نیست',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                      if (kDebugMode)
                                        TextButton(
                                          onPressed: () {
                                            setState(
                                              () => _isQuizUnlocked = true,
                                            );
                                            ScaffoldMessenger.of(
                                              context,
                                            ).showSnackBar(
                                              const SnackBar(
                                                content: Text(
                                                  'آزمون باز شد (حالت دیباگ)',
                                                ),
                                              ),
                                            );
                                          },
                                          child: const Text(
                                            'باز کردن آزمون (دیباگ)',
                                            style: TextStyle(
                                              color: Colors.white70,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              )
                            : (_isVideoInitialized
                                  ? Stack(
                                      alignment: Alignment.bottomCenter,
                                      children: [
                                        GestureDetector(
                                          onTap: () {
                                            setState(() {
                                              if (_videoPlayerController
                                                  .value
                                                  .isPlaying) {
                                                _videoPlayerController.pause();
                                              } else {
                                                _videoPlayerController.play();
                                              }
                                            });
                                          },
                                          child: VideoPlayer(
                                            _videoPlayerController,
                                          ),
                                        ),
                                        _buildVideoControlsOverlay(),
                                      ],
                                    )
                                  : const Center(
                                      child: CircularProgressIndicator(
                                        color: Color(0xFFD946EF),
                                      ),
                                    ))),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Builder(
              builder: (context) {
                final clips = currentClass['videoClips'] as List? ?? [];
                if (clips.isEmpty) return const SizedBox.shrink();
                
                final bool isNextUnlocked = () {
                   if (clips.isEmpty || _currentClipIndex >= clips.length - 1) return false;
                   final currentClipId = clips[_currentClipIndex]['id'];
                   final prog = _userProgress.firstWhere(
                     (p) => p['clipId'] == currentClipId,
                     orElse: () => null,
                   );
                   if (prog == null) return false;
                   return (prog['isWatched'] == true && prog['quizPassed'] == true);
                }();
                final bool isPrevAvailable = _currentClipIndex > 0;

                return Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        ElevatedButton.icon(
                          onPressed: isPrevAvailable
                              ? () {
                                  setState(() {
                                    _currentClipIndex--;
                                  });
                                  _videoPlayerController.removeListener(_videoListener);
                                  _videoPlayerController.dispose();
                                  _proceedWithVideo();
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1E1435),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: Colors.transparent,
                            disabledForegroundColor: Colors.white10,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          icon: const Icon(Icons.arrow_back, size: 16),
                          label: const Text(
                            'پارت قبلی',
                            style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11),
                          ),
                        ),
                        Directionality(
                          textDirection: TextDirection.rtl,
                          child: ElevatedButton.icon(
                            onPressed: isNextUnlocked
                                ? () {
                                    setState(() {
                                      _currentClipIndex++;
                                    });
                                    _videoPlayerController.removeListener(_videoListener);
                                    _videoPlayerController.dispose();
                                    _proceedWithVideo();
                                  }
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1E1435),
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: Colors.transparent,
                              disabledForegroundColor: Colors.white10,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            icon: const Icon(Icons.arrow_forward, size: 16),
                            label: const Text(
                              'پارت بعدی',
                              style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                    color: const Color(0xFF1E1435),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.04),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'لیست پخش',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      const SizedBox(height: 12),
                      Column(
                        children: List.generate(clips.length, (index) {
                          final clip = clips[index];
                          final isPlaying = _currentClipIndex == index;
                          final bool isLocked = () {
                            if (index == 0) return false;
                            final prevClipId = clips[index - 1]['id'];
                            final prog = _userProgress.firstWhere(
                              (p) => p['clipId'] == prevClipId,
                              orElse: () => null,
                            );
                            if (prog == null) return true;
                            return !(prog['isWatched'] == true && prog['quizPassed'] == true);
                          }();
                          final bool isCompleted = () {
                            final prog = _userProgress.firstWhere(
                              (p) => p['clipId'] == clip['id'],
                              orElse: () => null,
                            );
                            if (prog == null) return false;
                            return (prog['isWatched'] == true && prog['quizPassed'] == true);
                          }();

                          return GestureDetector(
                            onTap: () {
                              if (isLocked) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'لطفاً ابتدا پارت قبلی و آزمون آن را تکمیل کنید',
                                      style: TextStyle(fontFamily: 'Vazirmatn'),
                                    ),
                                    backgroundColor: Colors.orange,
                                  ),
                                );
                                return;
                              }
                              if (_currentClipIndex != index) {
                                setState(() {
                                  _currentClipIndex = index;
                                });
                                _videoPlayerController.removeListener(_videoListener);
                                _videoPlayerController.dispose();
                                _proceedWithVideo();
                              }
                            },
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                color: isLocked
                                    ? Colors.grey.withValues(alpha: 0.2)
                                    : (isPlaying
                                          ? const Color(0xFF8B5CF6).withValues(alpha: 0.3)
                                          : const Color(0xFF2A1C4C)),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isPlaying ? const Color(0xFF8B5CF6) : Colors.transparent,
                                ),
                              ),
                              child: Row(
                                children: [
                                  ElevatedButton(
                                    onPressed: isLocked
                                        ? null
                                        : () {
                                            _showPartMiniQuiz(index);
                                          },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: isCompleted ? Colors.green : const Color(0xFFD946EF),
                                      disabledBackgroundColor: Colors.grey.withValues(alpha: 0.3),
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      minimumSize: const Size(0, 32),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                    child: const Text(
                                      'آزمون پارت',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontFamily: 'Vazirmatn',
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    clip['duration'] != null ? '${clip['duration'] ~/ 60}:${(clip['duration'] % 60).toString().padLeft(2, '0')}' : '۲۰:۰۰',
                                    style: const TextStyle(
                                      color: Colors.white54,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    clip['title'] ?? 'پارت ${index + 1}',
                                    style: TextStyle(
                                      color: isLocked
                                          ? Colors.white54
                                          : Colors.white,
                                      fontSize: 13,
                                      fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(
                                    isLocked
                                        ? Icons.lock
                                        : (isCompleted ? Icons.check_circle : Icons.play_circle_fill),
                                    color: isLocked
                                        ? Colors.white30
                                        : (isCompleted ? Colors.green : const Color(0xFF8B5CF6)),
                                    size: 20,
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
            // Broadcast Link copy box
            GestureDetector(
              onTap: () {
                String link = currentClass['videoUrl'] ?? '';
                if (link.startsWith('/')) {
                  link =
                      HttpApiService().baseUrl.replaceAll('/api/v1', '') + link;
                }
                _copyLink(link);
              },
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
                  ),
                  color: const Color(0xFF1E1435),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link, color: Color(0xFF8B5CF6), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'کپی لینک استریم کلاس',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'کپی',
                      style: TextStyle(
                        color: Color(0xFFD946EF),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),


            // Teacher details card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1435),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
              ),
              child: Row(
                children: [
                  // Leftmost: small "more" button
                  TextButton(
                    onPressed: () => _showTeacherDetailsDialog(currentClass),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      backgroundColor: const Color(
                        0xFF8B5CF6,
                      ).withValues(alpha: 0.15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Text(
                      'بیشتر ⬅️',
                      style: TextStyle(
                        color: Color(0xFFEC4899),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ),
                  const Spacer(),
                  // Middle: Teacher details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          currentClass['instructor'] ??
                              currentClass['instructorName'] ??
                              currentClass['teacher'] ??
                              'استاد دوره',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          currentClass['description'] ??
                              currentClass['bio'] ??
                              '',
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 11,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Rightmost: Avatar
                  SafeAvatar(
                    radius: 26,
                    imageUrl: HttpApiService().resolveMediaUrl('/uploads/avatars/default.png'),
                    name: 'استاد',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Chapters Header
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: const [
                Text(
                  'سرفصل‌های آموزشی',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                SizedBox(width: 8),
                Text('📚', style: TextStyle(fontSize: 16)),
              ],
            ),
            const SizedBox(height: 12),

            // Chapter Rows
            Builder(
              builder: (context) {
                final String desc =
                    currentClass['description'] ?? currentClass['bio'] ?? '';
                final List<String> chapters = desc
                    .split('-')
                    .where((c) => c.trim().isNotEmpty)
                    .toList();
                if (chapters.isEmpty) {
                  return _buildChapterItem('۱. سرفصل‌ها ثبت نشده است');
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: chapters
                      .map(
                        (c) => Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: _buildChapterItem(c.trim()),
                        ),
                      )
                      .toList(),
                );
              },
            ),

            const SizedBox(height: 24),

            // Action Buttons
            _buildActionLargeButton(
              title: _isQuizUnlocked
                  ? 'شرکت در آزمون کتبی کلاس'
                  : 'شرکت در آزمون (نیازمند مشاهده ۶۰٪ ویدیو)',
              emoji: _isQuizUnlocked ? '📝' : '🔒',
              gradient: _isQuizUnlocked
                  ? const LinearGradient(
                      colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                    )
                  : const LinearGradient(
                      colors: [Colors.grey, Colors.blueGrey],
                    ),
              onTap: () {
                if (_isQuizUnlocked) {
                  _showClassExamDialog(
                    currentClass['instructor'] ??
                        currentClass['teacher'] ??
                        'استاد دوره',
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'لطفا حداقل ۶۰ درصد از ویدیو را مشاهده کنید',
                      ),
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 10),
            _buildActionLargeButton(
              title: 'کمک از راهبر',
              emoji: '💬',
              borderColor: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
              onTap: () async {
                final Uri url = Uri.parse('https://eitaa.com/komeil_abbas');
                try {
                  await launchUrl(url, mode: LaunchMode.externalApplication);
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('نمی‌توان پیوند ایتا را باز کرد. لطفاً ایتا را نصب کنید.')),
                    );
                  }
                }
              },
            ),
            const SizedBox(height: 10),
            _buildActionLargeButton(
              title: 'دانلود فایل جزوه آموزشی (PDF)',
              emoji: '📥',
              borderColor: const Color(0xFF10B981).withValues(alpha: 0.5),
              textColor: const Color(0xFF10B981),
              onTap: () => _showDownloadPamphletDialog(currentClass['title']),
            ),
            const SizedBox(height: 10),
            Builder(
              builder: (context) {
                bool isStationCompleted = true;
                for (var c in _classes) {
                  if (GlobalState.completedClasses[c['id']] != true) {
                    isStationCompleted = false;
                    break;
                  }
                }

                return _buildActionLargeButton(
                  title: isStationCompleted
                      ? 'شرکت در آزمون پایانی دوره'
                      : 'شرکت در آزمون نهایی (نیازمند تکمیل تمام کلاس‌ها)',
                  emoji: isStationCompleted ? '🎓' : '🔒',
                  borderColor: isStationCompleted
                      ? const Color(0xFFFFD54F).withValues(alpha: 0.5)
                      : Colors.grey,
                  textColor: isStationCompleted
                      ? const Color(0xFFFFD54F)
                      : Colors.grey,
                  onTap: () {
                    if (isStationCompleted) {
                      _handleFinalExamTap();
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'تمام کلاس‌های منزلگاه و پارت‌های آن‌ها باید تکمیل شوند',
                            style: TextStyle(fontFamily: 'Vazirmatn'),
                          ),
                          backgroundColor: Colors.orange,
                        ),
                      );
                    }
                  },
                );
              },
            ),

            const SizedBox(height: 35),

            // Next / Prev class arrows
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Next Class (Left arrow)
                ElevatedButton.icon(
                  onPressed: _currentClassIndex < _classes.length - 1
                      ? () {
                          setState(() {
                            _currentClassIndex++;
                            _videoPlayerController.dispose();
                            _initializeVideo();
                          });
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E1435),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.transparent,
                    disabledForegroundColor: Colors.white10,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text(
                    'کلاس بعدی',
                    style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11),
                  ),
                ),

                // Previous Class (Right arrow)
                ElevatedButton.icon(
                  onPressed: _currentClassIndex > 0
                      ? () {
                          setState(() {
                            _currentClassIndex--;
                            _videoPlayerController.dispose();
                            _initializeVideo();
                          });
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E1435),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.transparent,
                    disabledForegroundColor: Colors.white10,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: const Text(
                    'کلاس قبلی',
                    style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildChapterItem(String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.02)),
      ),
      child: Text(
        text,
        textAlign: TextAlign.right,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 13,
          fontFamily: 'Vazirmatn',
        ),
      ),
    );
  }

  Widget _buildActionLargeButton({
    required String title,
    required String emoji,
    LinearGradient? gradient,
    Color? borderColor,
    Color textColor = Colors.white,
    required VoidCallback onTap,
  }) {
    return Container(
      width: double.infinity,
      height: 54,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        border: borderColor != null
            ? Border.all(color: borderColor, width: 1.5)
            : null,
        color: gradient == null ? const Color(0xFF140D25) : null,
      ),
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: textColor,
                fontSize: 14,
                fontWeight: FontWeight.bold,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTeacherDetailsDialog(Map<String, dynamic> currentClass) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: const Color(0xFF1E1435),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Text(
                    'سوابق و شناسنامه علمی استاد',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
              const Divider(color: Colors.white12),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        currentClass['teacher'] ?? 'نامشخص',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currentClass['bio'] ?? '',
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 12,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  SafeAvatar(
                    radius: 28,
                    imageUrl: HttpApiService().resolveMediaUrl('/uploads/avatars/default.png'),
                    name: 'استاد',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'رزومه علمی و افتخارات:',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Vazirmatn',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '• دکتری سواد رسانه‌ای و علوم تربیتی دانشگاه تهران\n• راهبر ارشد تربیتی سرزمین نپا و کاروان‌های نخبگان\n• تالیف بیش از ۵ جلد کتاب در حوزه مهارت‌های نوین دانش‌آموزی',
                textDirection: TextDirection.rtl,
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  height: 1.6,
                  fontFamily: 'Vazirmatn',
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _showPartMiniQuiz(int partIndex) {
    final currentClass = _classes[_currentClassIndex];
    final clips = currentClass['videoClips'] as List? ?? [];

    final quizzes = currentClass['quizzes'] as List? ?? [];
    Map<String, dynamic>? partQuiz;
    for (var q in quizzes) {
      if (q['orderIndex'] == partIndex + 1) {
        partQuiz = q as Map<String, dynamic>;
        break;
      }
    }

    List<dynamic> quizQuestions = [];
    if (partQuiz != null && partQuiz['questionsJson'] != null) {
      try {
        final parsed = jsonDecode(partQuiz['questionsJson'].toString());
        if (parsed is List) {
          quizQuestions = parsed.map((item) {
            return {
              'q': item['question'],
              'options': item['options'],
              'correct': item['correctIndex'],
            };
          }).toList();
        }
      } catch (e) {
        debugPrint('Error parsing questionsJson: $e');
      }
    }

    if (quizQuestions.isEmpty) {
      quizQuestions = [
        {
          'q': 'سوال ارزیابی پارت ${partIndex + 1} - بخش اول',
          'options': [
            'گزینه اول (صحیح)',
            'گزینه دوم',
            'گزینه سوم',
            'گزینه چهارم',
          ],
          'correct': 0,
        }
      ];
    }

    int currentQuestionIndex = 0;
    final List<int> userAnswers = List.filled(quizQuestions.length, -1);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final question = quizQuestions[currentQuestionIndex];
            final selectedAns = userAnswers[currentQuestionIndex];

            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'سوال ${currentQuestionIndex + 1} از ${quizQuestions.length}',
                          style: const TextStyle(
                            color: Color(0xFFEC4899),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const Text(
                          'ارزیابی پارت ویدیو',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12),
                    const SizedBox(height: 12),
                    Text(
                      question['q'] ?? 'سوال',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...List.generate((question['options'] as List).length, (
                      idx,
                    ) {
                      bool isSel = selectedAns == idx;
                      return GestureDetector(
                        onTap: () => setDialogState(
                          () => userAnswers[currentQuestionIndex] = idx,
                        ),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: isSel
                                ? const Color(
                                    0xFF8B5CF6,
                                  ).withValues(alpha: 0.15)
                                : const Color(0xFF160E2A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSel
                                  ? const Color(0xFF8B5CF6)
                                  : Colors.white10,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Text(
                                  question['options'][idx]?.toString() ?? '',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Icon(
                                isSel
                                    ? Icons.radio_button_checked
                                    : Icons.radio_button_off,
                                color: isSel
                                    ? const Color(0xFF8B5CF6)
                                    : Colors.white30,
                                size: 18,
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 44,
                      child: ElevatedButton(
                        onPressed: selectedAns == -1
                            ? null
                            : () async {
                                if (currentQuestionIndex <
                                    quizQuestions.length - 1) {
                                  setDialogState(() {
                                    currentQuestionIndex++;
                                  });
                                } else {
                                  Navigator.pop(context); // close quiz dialog

                                  if (mounted) {
                                    setState(() {
                                      _isMiniQuizShowing = false;
                                    });
                                  }

                                  String classId = currentClass['id'] ?? 'unknown';
                                  String? quizId = partQuiz?['id'];
                                  
                                  showDialog(
                                    context: context,
                                    barrierDismissible: false,
                                    builder: (context) => const Center(
                                      child: CircularProgressIndicator(color: Color(0xFFD946EF)),
                                    ),
                                  );
                                  
                                  final res = await HttpApiService()
                                      .submitClassSessionQuiz(classId, userAnswers, quizId: quizId);
                                      
                                  if (!context.mounted) return;
                                  Navigator.pop(context); // close loading

                                  if (res != null) {
                                    final passed = res['passed'] as bool? ?? false;
                                    final rewardZarik = res['rewardZarik'] as int? ?? 0;
                                    
                                    if (passed) {
                                      if (rewardZarik > 0) {
                                        GlobalState.zarik += rewardZarik;
                                        final repository = Provider.of<AppRepository>(context, listen: false);
                                        repository.currentUser = UserModel(
                                          id: repository.currentUser.id,
                                          name: repository.currentUser.name,
                                          phoneNumber: repository.currentUser.phoneNumber,
                                          role: repository.currentUser.role,
                                          zarik: repository.currentUser.zarik + rewardZarik,
                                          nakh: repository.currentUser.nakh,
                                          beyragh: repository.currentUser.beyragh,
                                          farsh: repository.currentUser.farsh,
                                          hasEvaluatedMentorThisSeason: repository.currentUser.hasEvaluatedMentorThisSeason,
                                          userCode: repository.currentUser.userCode,
                                        );
                                      }

                                      // Unlock next clip
                                      setState(() {
                                        if (clips.isNotEmpty && partIndex < clips.length) {
                                          final currentClipId = clips[partIndex]['id'];
                                          final progIndex = _userProgress.indexWhere((p) => p['clipId'] == currentClipId);
                                          if (progIndex != -1) {
                                            _userProgress[progIndex]['quizPassed'] = true;
                                          }
                                        }

                                        if (partIndex == clips.length - 1) {
                                          GlobalState.completedClasses[classId] = true;
                                        }
                                      });

                                      RewardPopup.show(
                                        context,
                                        message: 'شما آزمون این پارت را با موفقیت گذراندید!',
                                        zarikAmount: rewardZarik,
                                      );

                                      if (partIndex < clips.length - 1) {
                                        Future.delayed(
                                          const Duration(seconds: 2),
                                          () {
                                            if (mounted) {
                                              setState(() {
                                                _currentClipIndex = partIndex + 1;
                                              });
                                              _videoPlayerController.removeListener(_videoListener);
                                              _videoPlayerController.dispose();
                                              _proceedWithVideo();
                                            }
                                          },
                                        );
                                      }
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('شما در این آزمون مردود شدید. دوباره تلاش کنید.', style: TextStyle(fontFamily: 'Vazirmatn')),
                                          backgroundColor: Colors.red,
                                        ),
                                      );
                                    }
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B5CF6),
                        ),
                        child: Text(
                          currentQuestionIndex < quizQuestions.length - 1
                              ? 'مرحله بعدی ➡️'
                              : 'ثبت و مشاهده نتیجه 🏁',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showClassExamDialog(String teacherName) {
    final currentClass = _classes[_currentClassIndex];
    final quizzes = currentClass['quizzes'];
    final quiz = (quizzes != null && (quizzes as List).isNotEmpty)
        ? quizzes[0]
        : currentClass['quiz'];
    final String quizType = (quiz != null && quiz['type'] != null)
        ? quiz['type']
        : 'MULTIPLE_CHOICE';

    List<dynamic> quizQuestions = [];
    if (quiz != null && quiz['questionsJson'] != null) {
      try {
        quizQuestions = (quiz['questionsJson'] is String)
            ? jsonDecode(quiz['questionsJson'])
            : quiz['questionsJson'];
      } catch (e) {
        debugPrint('Error parsing questionsJson: $e');
      }
    }

    // Fallback if no questions are configured
    if (quizQuestions.isEmpty) {
      quizQuestions = [
        {
          'q': 'کدام مورد جز ارکان اهداف پنج‌گانه SMART نیست؟',
          'options': [
            'دستیابی آسان بدون تلاش زیاد',
            'زمان‌دار بودن و مشخص بودن هدف',
            'قابل اندازه‌گیری بودن پیشرفت',
          ],
          'correct': 0,
        },
        {
          'q': 'منظور از حرف M در اهداف SMART چیست؟',
          'options': [
            'اندازه‌گیری پذیر (Measurable)',
            'مدیریت‌پذیر (Manageable)',
            'انگیزه‌بخش (Motivating)',
          ],
          'correct': 0,
        },
        {
          'q': 'کدام گزینه یک هدف زمان‌دار (Time-bound) را نشان می‌دهد؟',
          'options': [
            'من باید در آزمون‌های درسی‌ام نمرات عالی کسب کنم',
            'من تا انتهای بهمن ماه فصل اول ریاضی را تمام می‌کنم',
            'من تلاش زیادی برای افزایش معدل خواهم کرد',
          ],
          'correct': 1,
        },
        {
          'q': 'چرا اهداف باید واقع‌گرایانه (Realistic) باشند؟',
          'options': [
            'تا بتوانیم با حداقل تلاش به آن‌ها برسیم',
            'تا انگیزه خود را به خاطر سختی بیش از حد از دست ندهیم',
            'تا دیگران ما را بابت اهدافمان مسخره نکنند',
          ],
          'correct': 1,
        },
        {
          'q': 'اولین گام برای ترسیم نقشه مسیر موفقیت کاروان چیست؟',
          'options': [
            'تخصیص پاداش‌های زریک به اعضا',
            'مشخص کردن مقصد نهایی و خرد کردن اهداف به مراحل کوچک‌تر',
            'شروع حرکت بدون برنامه‌ریزی قبلی',
          ],
          'correct': 1,
        },
      ];
    }

    int currentQuestionIndex = 0;
    final List<dynamic> userAnswers = quizType == 'MULTIPLE_CHOICE'
        ? List.filled(quizQuestions.length, -1)
        : List.filled(1, '');
    final TextEditingController textAnswerController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final question = quizQuestions[currentQuestionIndex];
          final selectedAns = userAnswers[currentQuestionIndex];

          return Dialog(
            backgroundColor: const Color(0xFF1E1435),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'سوال ${currentQuestionIndex + 1} از ${quizQuestions.length}',
                        style: const TextStyle(
                          color: Color(0xFFEC4899),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      const Text(
                        'آزمون کلاس مهارتی نپا',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white12),
                  const SizedBox(height: 12),
                  if (quizType == 'MULTIPLE_CHOICE') ...[
                    Text(
                      question['q'] ?? question['title'] ?? 'سوال',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...List.generate(
                      (question['options'] as List?)?.length ?? 0,
                      (idx) {
                        bool isSel = selectedAns == idx;
                        return GestureDetector(
                          onTap: () => setDialogState(
                            () => userAnswers[currentQuestionIndex] = idx,
                          ),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: isSel
                                  ? const Color(
                                      0xFF8B5CF6,
                                    ).withValues(alpha: 0.15)
                                  : const Color(0xFF160E2A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSel
                                    ? const Color(0xFF8B5CF6)
                                    : Colors.white10,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Expanded(
                                  child: Text(
                                    question['options'][idx]?.toString() ??
                                        'گزینه',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Icon(
                                  isSel
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_off,
                                  color: isSel
                                      ? const Color(0xFF8B5CF6)
                                      : Colors.white30,
                                  size: 18,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ] else if (quizType == 'TEXT') ...[
                    Text(
                      quizQuestions.isNotEmpty &&
                              (quizQuestions[0]['q'] != null ||
                                  quizQuestions[0]['title'] != null)
                          ? (quizQuestions[0]['q'] ?? quizQuestions[0]['title'])
                          : 'لطفا پاسخ تشریحی خود را در کادر زیر وارد کنید:',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: textAnswerController,
                      maxLines: 5,
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontFamily: 'Vazirmatn',
                      ),
                      onChanged: (val) =>
                          setDialogState(() => userAnswers[0] = val),
                      decoration: InputDecoration(
                        hintText: 'پاسخ شما...',
                        hintStyle: const TextStyle(color: Colors.white30),
                        hintTextDirection: TextDirection.rtl,
                        filled: true,
                        fillColor: const Color(0xFF160E2A),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Colors.white10),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF8B5CF6),
                          ),
                        ),
                      ),
                    ),
                  ] else if (quizType == 'FILE') ...[
                    Text(
                      quizQuestions.isNotEmpty &&
                              (quizQuestions[0]['q'] != null ||
                                  quizQuestions[0]['title'] != null)
                          ? (quizQuestions[0]['q'] ?? quizQuestions[0]['title'])
                          : 'لطفا فایل پیوست خود را در یک سرویس آپلود کرده و لینک آن را اینجا وارد کنید (یا به راهبر خود پیام دهید):',
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: textAnswerController,
                      textDirection: TextDirection.ltr,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontFamily: 'Vazirmatn',
                      ),
                      onChanged: (val) =>
                          setDialogState(() => userAnswers[0] = val),
                      decoration: InputDecoration(
                        hintText: 'https://...',
                        hintStyle: const TextStyle(color: Colors.white30),
                        filled: true,
                        fillColor: const Color(0xFF160E2A),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Colors.white10),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF8B5CF6),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed:
                          (quizType == 'MULTIPLE_CHOICE' &&
                                  selectedAns == -1) ||
                              (quizType != 'MULTIPLE_CHOICE' &&
                                  textAnswerController.text.trim().isEmpty)
                          ? null
                          : () async {
                              if (currentQuestionIndex <
                                  quizQuestions.length - 1) {
                                setDialogState(() {
                                  currentQuestionIndex++;
                                });
                              } else {
                                // Final Question Completed!
                                showDialog(
                                  context: context,
                                  barrierDismissible: false,
                                  builder: (context) => const Center(
                                    child: CircularProgressIndicator(),
                                  ),
                                );

                                final res = await HttpApiService()
                                    .submitClassSessionQuiz(
                                      currentClass['id'],
                                      userAnswers,
                                    );
                                if (!context.mounted) return;
                                Navigator.pop(
                                  context,
                                ); // Close loading indicator
                                Navigator.pop(context); // Close quiz dialog

                                if (res != null) {
                                  final score = res['score'] as int? ?? 0;
                                  final total =
                                      res['total'] as int? ??
                                      quizQuestions.length;
                                  final passed =
                                      res['passed'] as bool? ?? false;
                                  final rewardZarik =
                                      res['rewardZarik'] as int? ?? 0;

                                  if (rewardZarik > 0) {
                                    final repository =
                                        Provider.of<AppRepository>(
                                          context,
                                          listen: false,
                                        );
                                    repository.currentUser = UserModel(
                                      id: repository.currentUser.id,
                                      name: repository.currentUser.name,
                                      phoneNumber:
                                          repository.currentUser.phoneNumber,
                                      role: repository.currentUser.role,
                                      zarik:
                                          repository.currentUser.zarik +
                                          rewardZarik,
                                      nakh: repository.currentUser.nakh,
                                      beyragh: repository.currentUser.beyragh,
                                      farsh: repository.currentUser.farsh,
                                      hasEvaluatedMentorThisSeason: repository
                                          .currentUser
                                          .hasEvaluatedMentorThisSeason,
                                      userCode: repository.currentUser.userCode,
                                    );
                                  }

                                  if (mounted) {
                                    if (quizType != 'MULTIPLE_CHOICE') {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'پاسخ شما با موفقیت ثبت شد و در انتظار بررسی راهبر است.',
                                            style: TextStyle(
                                              fontFamily: 'Vazirmatn',
                                            ),
                                          ),
                                          backgroundColor: Colors.green,
                                        ),
                                      );
                                    } else {
                                      RewardPopup.show(
                                        context,
                                        message: passed
                                            ? 'شما در آزمون کلاس قبول شدید! نمره: $score از $total'
                                            : 'شما در این آزمون قبول نشدید. نمره: $score از $total. لطفا پس از تماشای ویدیو مجددا تلاش کنید.',
                                        zarikAmount: rewardZarik,
                                      );
                                    }
                                  }
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'خطا در ثبت آزمون در سرور',
                                        style: TextStyle(
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                      ),
                      child: Text(
                        currentQuestionIndex < quizQuestions.length - 1
                            ? 'مرحله بعدی ➡️'
                            : 'ثبت و مشاهده نتیجه 🏁',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }



  void _showDownloadPamphletDialog(String title) {
    double progress = 0.0;
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          Future.delayed(const Duration(milliseconds: 300), () {
            if (!context.mounted) return;
            if (progress < 1.0) {
              setDialogState(() {
                progress += 0.2;
              });
            } else {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'جزوه آموزشی با موفقیت دانلود و در پوشه دریافت‌ها ذخیره شد! 📂✅',
                    style: TextStyle(fontFamily: 'Vazirmatn'),
                  ),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            }
          });

          return Dialog(
            backgroundColor: const Color(0xFF1E1435),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'در حال دریافت فایل جزوه...',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white10,
                    valueColor: const AlwaysStoppedAnimation(Color(0xFFEC4899)),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${(progress * 100).toInt()}%',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _handleFinalExamTap() {
    final repository = Provider.of<AppRepository>(context, listen: false);
    if (!repository.currentUser.hasEvaluatedMentorThisSeason) {
      _showMandatoryEvaluationDialog();
    } else {
      showDialog(
        context: context,
        builder: (context) => Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.workspace_premium,
                  color: Color(0xFFFFD54F),
                  size: 48,
                ),
                const SizedBox(height: 14),
                const Text(
                  'امتحان پایانی فصل بازگشایی شد',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'شما با موفقیت ارزیابی راهبر را تکمیل کردید و به تمام سوالات پاسخ دادید. اکنون می‌توانید در آزمون نهایی شرکت کنید.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    height: 1.5,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8B5CF6),
                    minimumSize: const Size(double.infinity, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'شروع آزمون نهایی',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
  }

  void _showMandatoryEvaluationDialog() {
    int communicationRating = 5;
    int timelinessRating = 5;
    int feedbackRating = 5;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SingleChildScrollView(
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ارزیابی اجباری پایان فصل راهبر',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'جهت بازگشایی امتحان پایانی، لطفا ارزیابی خود را از عملکرد راهبر در این فصل ثبت کنید:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const Divider(color: Colors.white12),
                        const SizedBox(height: 12),

                        // Communication rating
                        const Text(
                          'نحوه ارتباط و پاسخگویی:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        Row(
                          children: List.generate(5, (index) {
                            return IconButton(
                              icon: Icon(
                                index < communicationRating
                                    ? Icons.star
                                    : Icons.star_border,
                                color: const Color(0xFFFFD54F),
                                size: 24,
                              ),
                              onPressed: () => setDialogState(
                                () => communicationRating = index + 1,
                              ),
                            );
                          }),
                        ),

                        // Timeliness rating
                        const Text(
                          'آن تایم بودن و زمان‌شناسی:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        Row(
                          children: List.generate(5, (index) {
                            return IconButton(
                              icon: Icon(
                                index < timelinessRating
                                    ? Icons.star
                                    : Icons.star_border,
                                color: const Color(0xFFFFD54F),
                                size: 24,
                              ),
                              onPressed: () => setDialogState(
                                () => timelinessRating = index + 1,
                              ),
                            );
                          }),
                        ),

                        // Constructive feedback rating
                        const Text(
                          'سازنده بودن بازخوردهای اصلاحی:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        Row(
                          children: List.generate(5, (index) {
                            return IconButton(
                              icon: Icon(
                                index < feedbackRating
                                    ? Icons.star
                                    : Icons.star_border,
                                color: const Color(0xFFFFD54F),
                                size: 24,
                              ),
                              onPressed: () => setDialogState(
                                () => feedbackRating = index + 1,
                              ),
                            );
                          }),
                        ),

                        const SizedBox(height: 20),

                        ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context);
                            final repository = Provider.of<AppRepository>(
                              context,
                              listen: false,
                            );

                            // Set evaluated flag
                            repository.currentUser = UserModel(
                              id: repository.currentUser.id,
                              name: repository.currentUser.name,
                              phoneNumber: repository.currentUser.phoneNumber,
                              role: repository.currentUser.role,
                              zarik: repository.currentUser.zarik,
                              nakh: repository.currentUser.nakh,
                              beyragh: repository.currentUser.beyragh,
                              farsh: repository.currentUser.farsh,
                              hasEvaluatedMentorThisSeason: true,
                            );

                            // Log mentor rating (average of the three dimensions)
                            double finalAvg =
                                (communicationRating +
                                    timelinessRating +
                                    feedbackRating) /
                                3.0;
                            repository.rateMentor(
                              'alavi',
                              finalAvg,
                              'ارزیابی پایان فصل دانش‌آموز',
                            );

                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'ارزیابی ثبت شد! امتحان پایانی قفل‌گشایی شد 🔓🎓',
                                  style: TextStyle(fontFamily: 'Vazirmatn'),
                                ),
                                backgroundColor: Color(0xFF10B981),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            minimumSize: const Size(double.infinity, 44),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'ثبت ارزیابی و قفل‌گشایی امتحان',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLockedScreen(Map<String, dynamic> currentClass) {
    final int costZarik =
        (currentClass['unlockCostZarik'] as num?)?.toInt() ?? 0;
    return Container(
      color: const Color(0xFF160E2A),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock, color: Colors.white54, size: 48),
          const SizedBox(height: 12),
          const Text(
            'این کلاس قفل است',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'جهت بازگشایی به $costZarik زریک نیاز دارید',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.purple),
            onPressed: () async {
              final user = await HttpApiService().getMe();
              if (user != null && user.zarik >= costZarik) {
                final api = HttpApiService();
                await api.unlockClass(
                  currentClass['id'] ?? 'mock_id',
                  costZarik,
                );
                GlobalState.zarik -= costZarik;
                setState(() {
                  _isLocked = false;
                });
                _proceedWithVideo();
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'زریک کافی ندارید. لطفاً از بازارچه تهیه کنید.',
                      ),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            icon: const Icon(Icons.key, color: Colors.white, size: 18),
            label: Text('بازگشایی کلاس ($costZarik زریک)'),
          ),
        ],
      ),
    );
  }
}
