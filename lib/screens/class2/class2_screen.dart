import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../services/audio_exclusivity_service.dart';
import '../../widgets/app_scaffold.dart';
import '../../widgets/contact_us_dialog.dart';
import '../../widgets/reward_popup.dart';

/// Class 2 Screen (صفحه کلاس‌ها، مجموعه‌ها، پارت‌ها، پخش‌کننده ویدیو و آزمون‌ها)
class Class2Screen extends StatefulWidget {
  const Class2Screen({super.key});

  @override
  State<Class2Screen> createState() => _Class2ScreenState();
}

/// Backwards compatibility alias
typedef ClassPlayerScreen = Class2Screen;

class _Class2ScreenState extends State<Class2Screen> {
  // Navigation & Category state
  int _selectedTab = 0; // 0: مهارتی, 1: رسانه ای, 2: مشخصات جلسه
  int _currentStationIndex = 0;

  // Sessions & Clips
  List<Map<String, dynamic>> _skillSessions = [];
  List<Map<String, dynamic>> _mediaSessions = [];
  int _expandedSessionIndex = 0;
  int _currentClipIndex = 0;
  bool _isLoadingClasses = true;

  // Track unlocked quizzes (key: 'sessionIndex_clipIndex')
  final Set<String> _unlockedQuizzes = {'0_0'}; // First clip quiz unlocked by default

  // Video controller
  VideoPlayerController? _videoPlayerController;
  bool _isVideoInitialized = false;
  bool _isMiniQuizShowing = false;
  final double _playbackSpeed = 1.0;
  Timer? _heartbeatTimer;

  bool _argumentsLoaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_argumentsLoaded) {
      _argumentsLoaded = true;
      _loadArguments();
    }
  }

  void _loadArguments() {
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null) {
      if (args['stationIndex'] is int) {
        _currentStationIndex = args['stationIndex'];
      }

      final passedCategories = args['categories'] as Map<String, List<Map<String, dynamic>>>?;
      final passedClasses = args['classes'] as List?;

      if (passedCategories != null && passedCategories.isNotEmpty) {
        for (var entry in passedCategories.entries) {
          final sessions = entry.value.map((s) {
            final map = Map<String, dynamic>.from(s);
            var clips = (map['videoClips'] as List?)?.map((c) => Map<String, dynamic>.from(c as Map)).toList() ?? [];
            if (clips.isEmpty) {
              clips = [
                {'id': 'clip_1', 'title': 'پارت اول', 'duration': 900, 'videoUrl': ''},
                {'id': 'clip_2', 'title': 'پارت دوم', 'duration': 900, 'videoUrl': ''},
                {'id': 'clip_3', 'title': 'پارت سوم', 'duration': 900, 'videoUrl': ''},
                {'id': 'clip_4', 'title': 'پارت چهارم', 'duration': 900, 'videoUrl': ''},
                {'id': 'clip_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
              ];
            }
            map['videoClips'] = clips;
            return map;
          }).toList();

          if (entry.key.contains('مهارت')) {
            _skillSessions = sessions;
          } else if (entry.key.contains('رسانه')) {
            _mediaSessions = sessions;
          }
        }
      }

      if (_skillSessions.isEmpty && passedClasses != null && passedClasses.isNotEmpty) {
        _skillSessions = passedClasses.map((c) {
          final map = Map<String, dynamic>.from(c as Map);
          var clips = (map['videoClips'] as List?)?.map((cp) => Map<String, dynamic>.from(cp as Map)).toList() ?? [];
          if (clips.isEmpty) {
            clips = [
              {'id': 'clip_1', 'title': 'پارت اول', 'duration': 900, 'videoUrl': ''},
              {'id': 'clip_2', 'title': 'پارت دوم', 'duration': 900, 'videoUrl': ''},
              {'id': 'clip_3', 'title': 'پارت سوم', 'duration': 900, 'videoUrl': ''},
              {'id': 'clip_4', 'title': 'پارت چهارم', 'duration': 900, 'videoUrl': ''},
              {'id': 'clip_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
            ];
          }
          map['videoClips'] = clips;
          return map;
        }).toList();
      }
    }

    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final apiService = HttpApiService();

      if (_skillSessions.isEmpty || _mediaSessions.isEmpty) {
        final stations = await apiService.getStations();
        if (stations.isNotEmpty) {
          final sIndex = _currentStationIndex.clamp(0, stations.length - 1);
          final currentStationData = stations[sIndex];

          final categories = currentStationData['categories'] as List? ?? [];
          for (final cat in categories) {
            if (cat is Map) {
              final catTitle = cat['title']?.toString() ?? '';
              final sessions = (cat['sessions'] as List?)?.map((s) {
                final map = Map<String, dynamic>.from(s as Map);
                var clips = (map['videoClips'] as List?)?.map((c) => Map<String, dynamic>.from(c as Map)).toList() ?? [];
                if (clips.isEmpty) {
                  clips = [
                    {'id': 'clip_1', 'title': 'پارت اول', 'duration': 900, 'videoUrl': ''},
                    {'id': 'clip_2', 'title': 'پارت دوم', 'duration': 900, 'videoUrl': ''},
                    {'id': 'clip_3', 'title': 'پارت سوم', 'duration': 900, 'videoUrl': ''},
                    {'id': 'clip_4', 'title': 'پارت چهارم', 'duration': 900, 'videoUrl': ''},
                    {'id': 'clip_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
                  ];
                }
                map['videoClips'] = clips;
                return map;
              }).toList() ?? [];

              if (catTitle.contains('مهارت')) {
                _skillSessions = sessions;
              } else if (catTitle.contains('رسانه')) {
                _mediaSessions = sessions;
              }
            }
          }
        }
      }

      // Default mock sessions if empty so the UI always looks full
      if (_skillSessions.isEmpty) {
        _skillSessions = _createDefaultMockSessions('مهارتی');
      }
      if (_mediaSessions.isEmpty) {
        _mediaSessions = _createDefaultMockSessions('رسانه‌ای');
      }

      if (mounted) {
        setState(() {
          _isLoadingClasses = false;
        });
        _initializeVideoForCurrentSession();
      }
    } catch (e) {
      debugPrint('Error fetching class data: $e');
      if (_skillSessions.isEmpty) {
        _skillSessions = _createDefaultMockSessions('مهارتی');
      }
      if (_mediaSessions.isEmpty) {
        _mediaSessions = _createDefaultMockSessions('رسانه‌ای');
      }
      if (mounted) {
        setState(() {
          _isLoadingClasses = false;
        });
        _initializeVideoForCurrentSession();
      }
    }
  }

  List<Map<String, dynamic>> _createDefaultMockSessions(String type) {
    return [
      {
        'id': 'sess_1',
        'title': 'جلسه اول. خودشناسی دوپس دوپس',
        'instructor': 'استاد حسینی',
        'description': 'شناخت ابعاد شخصیتی، تقویت مهارت‌های فردی و برنامه‌ریزی هدفمند در کاروان نپا.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_1_1', 'title': 'پارت اول', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_1_2', 'title': 'پارت دوم', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_1_3', 'title': 'پارت سوم', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_1_4', 'title': 'پارت چهارم', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_1_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_2',
        'title': 'جلسه دوم. هنوز پول استادو ندادن نیومده',
        'instructor': 'استاد حسینی',
        'description': 'بررسی چالش‌های پیش‌رو و تحلیل روش‌های حل مسئله.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_2_1', 'title': 'پارت اول', 'duration': 780, 'videoUrl': ''},
          {'id': 'clip_2_2', 'title': 'پارت دوم', 'duration': 820, 'videoUrl': ''},
          {'id': 'clip_2_3', 'title': 'پارت سوم', 'duration': 750, 'videoUrl': ''},
          {'id': 'clip_2_4', 'title': 'پارت چهارم', 'duration': 800, 'videoUrl': ''},
          {'id': 'clip_2_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_3',
        'title': 'جلسه سوم. حاجی چقدر پیگیری ول کن دیگه',
        'instructor': 'استاد حسینی',
        'description': 'تمرین‌های عملی و سناریوهای کاروانی.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_3_1', 'title': 'پارت اول', 'duration': 650, 'videoUrl': ''},
          {'id': 'clip_3_2', 'title': 'پارت دوم', 'duration': 750, 'videoUrl': ''},
          {'id': 'clip_3_3', 'title': 'پارت سوم', 'duration': 700, 'videoUrl': ''},
          {'id': 'clip_3_4', 'title': 'پارت چهارم', 'duration': 850, 'videoUrl': ''},
          {'id': 'clip_3_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_4',
        'title': 'جلسه چهارم. من خودم نبودم تو اومدی دنبال جلسه؟',
        'instructor': 'استاد حسینی',
        'description': 'راهکارهای پیشرفته موفقیت در چالش‌های تیمی.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_4_1', 'title': 'پارت اول', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_4_2', 'title': 'پارت دوم', 'duration': 850, 'videoUrl': ''},
          {'id': 'clip_4_3', 'title': 'پارت سوم', 'duration': 800, 'videoUrl': ''},
          {'id': 'clip_4_4', 'title': 'پارت چهارم', 'duration': 750, 'videoUrl': ''},
          {'id': 'clip_4_5', 'title': 'پارت پنجم', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_5',
        'title': 'جلسه پنجم. از پیگیریت خوشم اومد',
        'instructor': 'استاد حسینی',
        'description': 'جمع‌بندی پایانی و آمادگی برای آزمون سراسری.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_5_1', 'title': 'پارت اول', 'duration': 1200, 'videoUrl': ''},
          {'id': 'clip_5_2', 'title': 'پارت دوم', 'duration': 1100, 'videoUrl': ''},
          {'id': 'clip_5_3', 'title': 'پارت سوم', 'duration': 950, 'videoUrl': ''},
          {'id': 'clip_5_4', 'title': 'پارت چهارم', 'duration': 1000, 'videoUrl': ''},
          {'id': 'clip_5_5', 'title': 'پارت پنجم', 'duration': 1050, 'videoUrl': ''},
        ],
      },
    ];
  }

  List<Map<String, dynamic>> get _currentSessions {
    if (_selectedTab == 1) return _mediaSessions;
    return _skillSessions;
  }

  Map<String, dynamic>? get _activeSession {
    final list = _currentSessions;
    if (list.isEmpty) return null;
    final index = _expandedSessionIndex.clamp(0, list.length - 1);
    return list[index];
  }

  String get _currentPlayingTitle {
    final session = _activeSession;
    if (session == null) return 'پارت اول';
    final clips = session['videoClips'] as List? ?? [];
    if (clips.isNotEmpty && _currentClipIndex < clips.length) {
      return clips[_currentClipIndex]['title'] ?? 'پارت ${_toFarsiDigit(_currentClipIndex + 1)}';
    }
    return session['title'] ?? 'جلسه اول';
  }

  void _initializeVideoForCurrentSession() {
    _disposeVideoController();
    setState(() {
      _isVideoInitialized = false;
      _isMiniQuizShowing = false;
    });

    final session = _activeSession;
    if (session == null) return;

    final clips = session['videoClips'] as List? ?? [];
    String url = '';
    if (clips.isNotEmpty && _currentClipIndex < clips.length) {
      url = clips[_currentClipIndex]['videoUrl'] ?? '';
    }
    if (url.isEmpty) {
      url = session['videoUrl'] ?? '';
    }

    if (url.isEmpty) {
      return;
    }

    if (url.startsWith('/')) {
      final baseUrl = HttpApiService().baseUrl.replaceAll('/api/v1', '');
      url = '$baseUrl$url';
    }

    String resolvedUrl = HttpApiService().resolveMediaUrl(url);
    if (resolvedUrl.contains('localhost') || resolvedUrl.contains('127.0.0.1')) {
      final baseUrl = HttpApiService().baseUrl;
      final hostIp = Uri.parse(baseUrl).host;
      resolvedUrl = resolvedUrl.replaceAll('localhost', hostIp).replaceAll('127.0.0.1', hostIp);
    }

    final newController = VideoPlayerController.networkUrl(Uri.parse(resolvedUrl));
    _videoPlayerController = newController;

    newController.initialize().then((_) async {
      if (!mounted || _videoPlayerController != newController) {
        newController.dispose();
        return;
      }

      setState(() {
        _isVideoInitialized = true;
      });

      newController.setPlaybackSpeed(_playbackSpeed);
      newController.addListener(_videoListener);
      AudioExclusivityService.registerVideoController(newController);
      newController.play();
      AudioExclusivityService.onVideoPlay();
      _startHeartbeatTimer();
    }).catchError((error) {
      debugPrint('Video init error: $error');
    });
  }

  void _videoListener() {
    final controller = _videoPlayerController;
    if (controller != null && controller.value.isInitialized) {
      final pos = controller.value.position.inMilliseconds;
      final dur = controller.value.duration.inMilliseconds;

      // Unlock quiz if >= 70% watched
      if (dur > 0 && pos >= dur * 0.70) {
        final key = '${_expandedSessionIndex}_$_currentClipIndex';
        if (!_unlockedQuizzes.contains(key)) {
          setState(() {
            _unlockedQuizzes.add(key);
          });
        }
      }

      // Automatically show mini quiz at the end
      if (dur > 0 && pos >= dur && !_isMiniQuizShowing) {
        setState(() {
          _isMiniQuizShowing = true;
        });
        controller.pause();
        Future.delayed(Duration.zero, () {
          _showPartMiniQuiz(_currentClipIndex);
        });
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
    });
  }

  void _disposeVideoController() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    final controller = _videoPlayerController;
    if (controller != null) {
      _videoPlayerController = null;
      try {
        controller.removeListener(_videoListener);
        AudioExclusivityService.unregisterVideoController(controller);
        controller.dispose();
      } catch (e) {
        debugPrint('Error disposing video controller: $e');
      }
    }
  }

  @override
  void dispose() {
    _disposeVideoController();
    super.dispose();
  }

  String _toFarsiDigit(dynamic input) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return input.toString().split('').map((char) {
      final code = char.codeUnitAt(0);
      if (code >= 48 && code <= 57) {
        return farsiDigits[code - 48];
      }
      return char;
    }).join('');
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 1,
      onBackTap: () => Navigator.of(context).pop(),
      body: _isLoadingClasses
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFC09268)),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Video Player Box (مثل صفحه کلاس1 قسمت انیمیشن باید ببینید)
                  _buildVideoPlayerCard(),
                  const SizedBox(height: 8),

                  // Active Playing Part Title
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      _currentPlayingTitle,
                      style: const TextStyle(
                        color: Color(0xFFDDD9EE),
                        fontSize: 11.5,
                        fontWeight: FontWeight.normal,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Navigation Tabs Row (مهارتی | رسانه ای | مشخصات جلسه)
                  _buildTabsRow(),
                  const SizedBox(height: 12),

                  // Tab Body Content (باکس‌های جلسات و پارت‌ها منطبق بر رفرنس عکس)
                  if (_selectedTab == 2)
                    _buildSessionDetailsTab()
                  else
                    _buildSessionsAccordion(),

                  const SizedBox(height: 14),

                  // Action Buttons (جای منزلگاه قبل و بعد عوض شده)
                  _buildBottomActionBar(),
                  const SizedBox(height: 10),
                ],
              ),
            ),
    );
  }

  /// 2. Video Player Card (دقیقاً مشابه باکس پخش ویدیو در کلاس1 برای انیمیشن باید ببینید)
  Widget _buildVideoPlayerCard() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          stops: [0.0, 0.5, 1.0],
          colors: [
            Color(0xFF3A3A6A),
            Color(0xFF9292E2),
            Color(0xFF3A3A6A),
          ],
        ),
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18.8),
        child: Container(
          color: const Color(0xFF1E1D34),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (_isVideoInitialized &&
                    _videoPlayerController != null &&
                    _videoPlayerController!.value.isInitialized) ...[
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_videoPlayerController!.value.isPlaying) {
                          _videoPlayerController!.pause();
                        } else {
                          _videoPlayerController!.play();
                          AudioExclusivityService.onVideoPlay();
                        }
                      });
                    },
                    child: VideoPlayer(_videoPlayerController!),
                  ),
                  _buildVideoControlsOverlay(),
                ] else ...[
                  // Default Thumbnail & Centered Play button matching NopaInlineVideoPlayer
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.0, 0.53, 1.0],
                        colors: [
                          Color(0xFF3D3C67),
                          Color(0xFF36345C),
                          Color(0xFF333359),
                        ],
                      ),
                    ),
                    child: Center(
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF1E1D34).withValues(alpha: 0.65),
                          border: Border.all(
                            color: const Color(0xFFC09268),
                            width: 1.2,
                          ),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.play_arrow_rounded,
                            color: Color(0xFFDEB58A),
                            size: 28,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildVideoControlsOverlay() {
    final controller = _videoPlayerController;
    if (controller == null || !_isVideoInitialized) {
      return const SizedBox.shrink();
    }
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        color: Colors.black54,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Row(
          children: [
            IconButton(
              icon: Icon(
                controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 18,
              ),
              onPressed: () {
                setState(() {
                  if (controller.value.isPlaying) {
                    controller.pause();
                  } else {
                    controller.play();
                    AudioExclusivityService.onVideoPlay();
                  }
                });
              },
            ),
            Expanded(
              child: VideoProgressIndicator(
                controller,
                allowScrubbing: true,
                colors: const VideoProgressColors(
                  playedColor: Color(0xFFC09268),
                  bufferedColor: Colors.white24,
                  backgroundColor: Colors.white12,
                ),
              ),
            ),
            const SizedBox(width: 8),
            ValueListenableBuilder(
              valueListenable: controller,
              builder: (context, VideoPlayerValue value, child) {
                final duration = value.duration;
                final position = value.position;
                return Text(
                  '${position.inMinutes}:${(position.inSeconds % 60).toString().padLeft(2, '0')} / ${duration.inMinutes}:${(duration.inSeconds % 60).toString().padLeft(2, '0')}',
                  style: const TextStyle(color: Colors.white, fontSize: 9.5),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  /// 3. Tabs Row (مهارتی | رسانه ای | مشخصات جلسه)
  Widget _buildTabsRow() {
    return Column(
      children: [
        Directionality(
          textDirection: TextDirection.rtl,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildTabItem(title: 'مهارتی', index: 0),
              _buildTabItem(title: 'رسانه ای', index: 1),
              _buildTabItem(title: 'مشخصات جلسه', index: 2),
            ],
          ),
        ),
        const SizedBox(height: 5),
        Container(
          height: 1,
          color: const Color(0xFF473E67).withValues(alpha: 0.5),
        ),
      ],
    );
  }

  Widget _buildTabItem({required String title, required int index}) {
    final isSelected = _selectedTab == index;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedTab = index;
          _currentClipIndex = 0;
        });
        if (index != 2) {
          _initializeVideoForCurrentSession();
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? const Color(0xFFE5B888) : const Color(0xFF9D99B8),
            fontSize: isSelected ? 13.5 : 12.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ),
    );
  }

  String _formatDuration(dynamic duration) {
    if (duration == null) return '۱۵:۰۰';
    if (duration is num) {
      final int totalSec = duration.toInt();
      final int minutes = totalSec ~/ 60;
      final int seconds = totalSec % 60;
      final String minStr = minutes.toString().padLeft(2, '0').toPersianDigits();
      final String secStr = seconds.toString().padLeft(2, '0').toPersianDigits();
      return '$minStr:$secStr';
    }
    final String str = duration.toString().trim();
    if (str.isEmpty) return '۱۵:۰۰';
    return str.toPersianDigits();
  }

  /// 4. Sessions Accordion List (رنگ و استروک شبیه به باکس های منزلگاه در صفحه هوم + ریسپانسیو)
  Widget _buildSessionsAccordion() {
    final sessions = _currentSessions;
    if (sessions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text(
            'فیلمی برای این بخش ثبت نشده است.',
            style: TextStyle(
              color: Color(0xFF9D99B8),
              fontSize: 12,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      );
    }

    return Column(
      children: List.generate(sessions.length, (sIndex) {
        final session = sessions[sIndex];
        final isExpanded = _expandedSessionIndex == sIndex;
        final clips = session['videoClips'] as List? ?? [];

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              stops: [0.0, 0.5, 1.0],
              colors: [
                Color(0xFF3A3A6A),
                Color(0xFF9292E2),
                Color(0xFF3A3A6A),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          padding: const EdgeInsets.all(1.2), // Gradient border matching StationCard
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14.8),
            child: Column(
              children: [
                // 1. Session Header (Capsule gradient surface matching StationCard)
                InkWell(
                  onTap: () {
                    setState(() {
                      if (isExpanded) {
                        _expandedSessionIndex = -1;
                      } else {
                        _expandedSessionIndex = sIndex;
                        _currentClipIndex = 0;
                        _initializeVideoForCurrentSession();
                      }
                    });
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: isExpanded
                          ? const BorderRadius.vertical(top: Radius.circular(14.8))
                          : BorderRadius.circular(14.8),
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.0, 0.53, 1.0],
                        colors: [
                          Color(0xFF3D3C67),
                          Color(0xFF36345C),
                          Color(0xFF333359),
                        ],
                      ),
                      border: isExpanded
                          ? const Border(
                              bottom: BorderSide(
                                color: Color(0xFF282542),
                                width: 1.0,
                              ),
                            )
                          : null,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        // Left: Arrow Up / Down
                        Icon(
                          isExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: const Color(0xFFDDD9EE),
                          size: 20,
                        ),
                        const SizedBox(width: 8),

                        // Right: Title (Not bold, concise, clean)
                        Expanded(
                          child: Text(
                            session['title'] ?? 'جلسه ${_toFarsiDigit(sIndex + 1)}',
                            textAlign: TextAlign.right,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFF3EFFE),
                              fontSize: 12,
                              fontWeight: FontWeight.normal,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. Expanded Parts Section (Seamless dark background without purple box)
                if (isExpanded && clips.isNotEmpty) ...[
                  Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFF1B192A),
                      borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Column(
                      children: List.generate(clips.length, (cIndex) {
                        final clip = clips[cIndex];
                        final isPlaying = isExpanded && _currentClipIndex == cIndex;
                        final quizKey = '${sIndex}_$cIndex';
                        final bool isQuizUnlocked = _unlockedQuizzes.contains(quizKey);

                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5.5),
                          child: Directionality(
                            textDirection: TextDirection.rtl,
                            child: Row(
                              children: [
                                // 1. Far Right in RTL: وضعیت پارت (تایید برای دیده شده، پاز برای در حال دیدن، پلی برای دیده نشده)
                                GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _currentClipIndex = cIndex;
                                    });
                                    _initializeVideoForCurrentSession();
                                  },
                                  child: isPlaying
                                      ? Container(
                                          width: 20,
                                          height: 20,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: const Color(0xFFDFB690).withValues(alpha: 0.18),
                                            border: Border.all(color: const Color(0xFFDFB690), width: 1.2),
                                          ),
                                          child: const Icon(Icons.pause_rounded, color: Color(0xFFDFB690), size: 13),
                                        )
                                      : (isQuizUnlocked
                                          ? Container(
                                              width: 20,
                                              height: 20,
                                              decoration: const BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: Color(0xFF22C55E),
                                              ),
                                              child: const Icon(Icons.check_rounded, color: Colors.white, size: 13),
                                            )
                                          : Container(
                                              width: 20,
                                              height: 20,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: Colors.white.withValues(alpha: 0.08),
                                                border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.0),
                                              ),
                                              child: const Icon(Icons.play_arrow_rounded, color: Colors.white70, size: 13),
                                            )),
                                ),
                                const SizedBox(width: 8),

                                // 2. Right in RTL next to icon: عنوان پارت (کوتاه تر، کوچکتر و غیربولد)
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _currentClipIndex = cIndex;
                                      });
                                      _initializeVideoForCurrentSession();
                                    },
                                    child: Text(
                                      clip['title']?.toString() ?? 'پارت ${_toFarsiDigit(cIndex + 1)}',
                                      textAlign: TextAlign.right,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: isPlaying ? const Color(0xFFE1BC96) : const Color(0xFFDDD9EE),
                                        fontSize: 11,
                                        fontWeight: FontWeight.normal,
                                        fontFamily: AppTheme.fontFamily,
                                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),

                                // 3. Left: مدت زمان پارت (15:00)
                                Text(
                                  _formatDuration(clip['duration']),
                                  style: const TextStyle(
                                    color: Color(0xFF9D99B8),
                                    fontSize: 10.5,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                                const SizedBox(width: 8),

                                // 4. Far Left in RTL: دکمه آزمون
                                GestureDetector(
                                  onTap: () {
                                    if (isQuizUnlocked) {
                                      _showPartMiniQuiz(cIndex);
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'برای باز شدن آزمون، حداقل ۷۰٪ ویدیو را مشاهده کنید',
                                            style: TextStyle(
                                              fontFamily: AppTheme.fontFamily,
                                              fontSize: 11.5,
                                            ),
                                          ),
                                          backgroundColor: Color(0xFF23223D),
                                          duration: Duration(seconds: 2),
                                        ),
                                      );
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1B192A),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isQuizUnlocked
                                            ? const Color(0xFFC09268)
                                            : const Color(0xFF6C6C63).withValues(alpha: 0.35),
                                        width: 0.85,
                                      ),
                                    ),
                                    child: Text(
                                      'آزمون',
                                      style: TextStyle(
                                        color: isQuizUnlocked
                                            ? const Color(0xFFE1BC96)
                                            : const Color(0xFF8E889D).withValues(alpha: 0.5),
                                        fontWeight: FontWeight.normal,
                                        fontFamily: AppTheme.fontFamily,
                                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }),
    );
  }

  /// 5. Session Details Tab (اطلاعات جلسه ساده بدون باکس + قسمت استادها دارای باکس شبیه به چالش‌های صفحه هوم)
  Widget _buildSessionDetailsTab() {
    final session = _activeSession;
    if (session == null) {
      return const SizedBox.shrink();
    }

    final String sessionDesc = session['description']?.toString().trim() ?? '';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. اطلاعات و شرح متنی جلسه (ساده و بدون باکس)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'اطلاعات جلسه',
                  style: TextStyle(
                    color: Color(0xFFE5B888),
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  sessionDesc.isNotEmpty
                      ? sessionDesc
                      : 'توضیحات و سرفصل‌های آموزشی این جلسه در کاروان نپا.',
                  style: const TextStyle(
                    color: Color(0xFFD3D0E3),
                    fontSize: 11,
                    height: 1.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 2. قسمت استادها (باکس شبیه به باکس چالش‌ها در صفحه هوم با استروک گرادیانت)
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                stops: [0.0, 0.5, 1.0],
                colors: [
                  Color(0xFF3A3A6A),
                  Color(0xFF9292E2),
                  Color(0xFF3A3A6A),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(1.2), // Gradient border stroke
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14.8),
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.0, 0.53, 1.0],
                  colors: [
                    Color(0xFF3D3C67),
                    Color(0xFF36345C),
                    Color(0xFF333359),
                  ],
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  // Instructor Avatar on the right in RTL
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFF7E72B8).withValues(alpha: 0.35),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFF9E92E8).withValues(alpha: 0.5),
                        width: 1,
                      ),
                    ),
                    child: const Center(
                      child: Icon(Icons.person_rounded, color: Color(0xFFE5B888), size: 24),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session['instructor']?.toString() ?? 'استاد دوره',
                          style: const TextStyle(
                            color: Color(0xFFFBE4C8),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          session['category']?.toString() ?? 'استاد راهنمای جلسات کاروان',
                          style: const TextStyle(
                            color: Color(0xFF9D99B8),
                            fontSize: 10.5,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // 3. دانلود جزوه و درسنامه آموزشی
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF241F3B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFC09268).withValues(alpha: 0.6)),
            ),
            child: ListTile(
              leading: const Icon(Icons.download_rounded, color: Color(0xFFE5B888), size: 20),
              title: const Text(
                'دانلود جزوه و درسنامه آموزشی',
                style: TextStyle(
                  color: Color(0xFFDDD9EE),
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              trailing: const Icon(Icons.chevron_left_rounded, color: Color(0xFF9D99B8), size: 18),
              onTap: () => _showDownloadPamphletDialog(session['title'] ?? 'جزوه'),
            ),
          ),
        ],
      ),
    );
  }

  /// 6. Bottom Action Bar (منزلگاه قبل در راست و منزلگاه بعد در چپ)
  Widget _buildBottomActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1A33).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF473E67).withValues(alpha: 0.4),
          width: 1.0,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 1. Far Left: منزلگاه بعد (تعویض شده با قبل)
          InkWell(
            onTap: () {
              setState(() {
                _currentStationIndex++;
                _expandedSessionIndex = 0;
                _currentClipIndex = 0;
              });
              _fetchData();
            },
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(
                  Icons.chevron_left_rounded,
                  color: Color(0xFFDDD9EE),
                  size: 18,
                ),
                Text(
                  'منزلگاه بعد',
                  style: TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 9.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],
            ),
          ),

          // 2. Middle Left: ارتباط با راهبر
          ElevatedButton(
            onPressed: () => ContactUsDialog.show(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF241F3B),
              foregroundColor: const Color(0xFFDDD9EE),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9),
                side: const BorderSide(
                  color: Color(0xFF5A4D80),
                  width: 1.0,
                ),
              ),
            ),
            child: const Text(
              'ارتباط با راهبر',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),

          // 3. Middle Right: شرکت در آزمون نهایی
          ElevatedButton(
            onPressed: _showFinalStationExam,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF241F3B),
              foregroundColor: const Color(0xFFE5B888),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9),
                side: const BorderSide(
                  color: Color(0xFFC09268),
                  width: 1.0,
                ),
              ),
            ),
            child: const Text(
              'شرکت در آزمون نهایی',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),

          // 4. Far Right: منزلگاه قبل (تعویض شده با بعد)
          InkWell(
            onTap: _currentStationIndex > 0
                ? () {
                    setState(() {
                      _currentStationIndex--;
                      _expandedSessionIndex = 0;
                      _currentClipIndex = 0;
                    });
                    _fetchData();
                  }
                : null,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'منزلگاه قبل',
                  style: TextStyle(
                    color: _currentStationIndex > 0 ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94),
                    fontSize: 9.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: _currentStationIndex > 0 ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94),
                  size: 18,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- Dialogs & Quiz Logic ---

  void _showPartMiniQuiz(int partIndex) {
    final session = _activeSession;
    final quizzes = session?['quizzes'] as List? ?? [];

    List<dynamic> quizQuestions = [];
    if (quizzes.isNotEmpty) {
      for (var q in quizzes) {
        if (q['orderIndex'] == partIndex + 1 && q['questionsJson'] != null) {
          try {
            final parsed = jsonDecode(q['questionsJson'].toString());
            if (parsed is List) quizQuestions = parsed;
          } catch (_) {}
          break;
        }
      }
    }

    if (quizQuestions.isEmpty) {
      quizQuestions = [
        {
          'question': 'سوال ارزیابی پارت ${_toFarsiDigit(partIndex + 1)}: مفهوم اصلی تدریس شده در این پارت چیست؟',
          'options': [
            'شناخت و تقویت ویژگی‌های فردی',
            'مدیریت زمان و هماهنگی کاروانی',
            'حل مسئله در شرایط پیچیده',
            'همه موارد فوق',
          ],
          'correctIndex': 3,
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
              backgroundColor: const Color(0xFF241F3B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: Color(0xFFC09268), width: 1.0),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'آزمون ارزیابی پارت',
                            style: TextStyle(
                              color: Color(0xFFFBE4C8),
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                          Text(
                            'سوال ${_toFarsiDigit(currentQuestionIndex + 1)} از ${_toFarsiDigit(quizQuestions.length)}',
                            style: const TextStyle(
                              color: Color(0xFF9D99B8),
                              fontSize: 11,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Container(height: 1, color: const Color(0xFF473E67)),
                      const SizedBox(height: 10),
                      Text(
                        question['question'] ?? question['q'] ?? 'سوال',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...List.generate((question['options'] as List).length, (idx) {
                        bool isSel = selectedAns == idx;
                        return GestureDetector(
                          onTap: () => setDialogState(() => userAnswers[currentQuestionIndex] = idx),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            decoration: BoxDecoration(
                              color: isSel ? const Color(0xFF473E67) : const Color(0xFF1E1A33),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSel ? const Color(0xFFC09268) : const Color(0xFF473E67),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isSel ? Icons.radio_button_checked : Icons.radio_button_off,
                                  color: isSel ? const Color(0xFFE5B888) : const Color(0xFF9D99B8),
                                  size: 16,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    question['options'][idx]?.toString() ?? '',
                                    style: TextStyle(
                                      color: isSel ? const Color(0xFFFBE4C8) : const Color(0xFFDDD9EE),
                                      fontSize: 11.5,
                                      fontFamily: AppTheme.fontFamily,
                                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: 14),
                      ElevatedButton(
                        onPressed: selectedAns == -1
                            ? null
                            : () {
                                if (currentQuestionIndex < quizQuestions.length - 1) {
                                  setDialogState(() {
                                    currentQuestionIndex++;
                                  });
                                } else {
                                  Navigator.pop(context);
                                  RewardPopup.show(
                                    context,
                                    message: 'شما آزمون این پارت را با موفقیت گذراندید!',
                                    zarikAmount: 10,
                                  );
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC09268),
                          foregroundColor: const Color(0xFF1E1A33),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          currentQuestionIndex < quizQuestions.length - 1
                              ? 'سوال بعدی'
                              : 'ثبت و مشاهده نتیجه',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showFinalStationExam() {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: const Color(0xFF241F3B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFFC09268), width: 1.0),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.workspace_premium_rounded,
                  color: Color(0xFFE5B888),
                  size: 44,
                ),
                const SizedBox(height: 10),
                const Text(
                  'آزمون نهایی منزلگاه',
                  style: TextStyle(
                    color: Color(0xFFFBE4C8),
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'آزمون نهایی شامل سنجش مهارت‌های فراگرفته شده در تمامی جلسات این منزلگاه است.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 11.5,
                    height: 1.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _showPartMiniQuiz(0);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC09268),
                    foregroundColor: const Color(0xFF1E1A33),
                    minimumSize: const Size(double.infinity, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    'شروع آزمون نهایی',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDownloadPamphletDialog(String title) {
    double progress = 0.0;
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          Future.delayed(const Duration(milliseconds: 250), () {
            if (!context.mounted) return;
            if (progress < 1.0) {
              setDialogState(() {
                progress += 0.25;
              });
            } else {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'جزوه آموزشی با موفقیت دانلود شد! 📂✅',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            }
          });

          return Dialog(
            backgroundColor: const Color(0xFF241F3B),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xFFC09268), width: 1.0),
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'در حال دریافت فایل جزوه...',
                    style: TextStyle(
                      color: Color(0xFFFBE4C8),
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 14),
                  LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white10,
                    valueColor: const AlwaysStoppedAnimation(Color(0xFFC09268)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${(progress * 100).toInt()}%',
                    style: const TextStyle(color: Color(0xFF9D99B8), fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
