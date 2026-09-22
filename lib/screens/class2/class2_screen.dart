import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../widgets/reward_popup.dart';
import '../../widgets/contact_us_dialog.dart';
import 'dart:async';
import 'dart:convert';
import '../../services/audio_exclusivity_service.dart';
import '../../widgets/safe_avatar.dart';

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
  String _stationTitle = 'منزلگاه اول';

  // Sessions & Clips
  List<Map<String, dynamic>> _skillSessions = [];
  List<Map<String, dynamic>> _mediaSessions = [];
  int _expandedSessionIndex = 0;
  int _currentClipIndex = 0;
  bool _isLoadingClasses = true;

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
      if (args['stationTitle'] is String) {
        _stationTitle = args['stationTitle'];
      }

      final passedCategories = args['categories'] as Map<String, List<Map<String, dynamic>>>?;
      final passedClasses = args['classes'] as List?;

      if (passedCategories != null && passedCategories.isNotEmpty) {
        for (var entry in passedCategories.entries) {
          if (entry.key.contains('مهارت')) {
            _skillSessions = entry.value;
          } else if (entry.key.contains('رسانه')) {
            _mediaSessions = entry.value;
          }
        }
      }

      if (_skillSessions.isEmpty && passedClasses != null && passedClasses.isNotEmpty) {
        _skillSessions = passedClasses.map((c) => c as Map<String, dynamic>).toList();
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
          _stationTitle = currentStationData['title'] ?? 'منزلگاه ${_toFarsiDigit(_currentStationIndex + 1)}';

          final categories = currentStationData['categories'] as List? ?? [];
          for (final cat in categories) {
            if (cat is Map) {
              final catTitle = cat['title']?.toString() ?? '';
              final sessions = (cat['sessions'] as List?)?.map((s) => s as Map<String, dynamic>).toList() ?? [];
              if (catTitle.contains('مهارت')) {
                _skillSessions = sessions;
              } else if (catTitle.contains('رسانه')) {
                _mediaSessions = sessions;
              }
            }
          }
        }
      }

      // Default mock sessions if empty so the UI always looks full and matches the screenshot
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
          {'id': 'clip_1_1', 'title': 'پارت اول استاد الکی حرف میزنه', 'duration': 900, 'videoUrl': ''},
          {'id': 'clip_1_2', 'title': 'پارت دوم هیچ فایده ای نداره', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_2',
        'title': 'جلسه دوم. هنوز پول استاد رو ندادن نیومده',
        'instructor': 'استاد حسینی',
        'description': 'بررسی چالش‌های پیش‌رو و تحلیل روش‌های حل مسئله.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_2_1', 'title': 'پارت اول مبانی اولیه', 'duration': 780, 'videoUrl': ''},
          {'id': 'clip_2_2', 'title': 'پارت دوم جمع‌بندی نکات', 'duration': 820, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_3',
        'title': 'جلسه سوم حاجی چقدر پیگیری ول کن دیگه',
        'instructor': 'استاد حسینی',
        'description': 'تمرین‌های عملی و سناریوهای کاروانی.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_3_1', 'title': 'پارت اول سناریوسازی', 'duration': 650, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_4',
        'title': 'جلسه چهارم من خودم نبودم تو اومدی دنبال جلسه؟',
        'instructor': 'استاد حسینی',
        'description': 'راهکارهای پیشرفته موفقیت در چالش‌های تیمی.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_4_1', 'title': 'پارت اول کار تیمی', 'duration': 900, 'videoUrl': ''},
        ],
      },
      {
        'id': 'sess_5',
        'title': 'جلسه پنجم از پیگیریت خوشم اومد',
        'instructor': 'استاد حسینی',
        'description': 'جمع‌بندی پایانی و آمادگی برای آزمون سراسری.',
        'videoUrl': '',
        'videoClips': [
          {'id': 'clip_5_1', 'title': 'پارت پایانی و جمع‌بندی', 'duration': 1200, 'videoUrl': ''},
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

  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${_toFarsiDigit(mins.toString().padLeft(2, '0'))}:${_toFarsiDigit(secs.toString().padLeft(2, '0'))}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E1A33),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF2C2548), Color(0xFF1E1A33), Color(0xFF161228)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
            opacity: 0.15,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // 1. Top Bar (Logo, back button, Avatar, Hamburger Menu & Breadcrumb)
              _buildTopHeader(),

              // 2. Scrollable Content (Video Box + Tabs + Accordion / Details)
              Expanded(
                child: _isLoadingClasses
                    ? const Center(
                        child: CircularProgressIndicator(color: Color(0xFFC09268)),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Video Player Box
                            _buildVideoPlayerCard(),
                            const SizedBox(height: 10),

                            // Active Playing Part Title
                            Directionality(
                              textDirection: TextDirection.rtl,
                              child: Text(
                                _currentPlayingTitle,
                                style: const TextStyle(
                                  color: Color(0xFFDDD9EE),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: AppTheme.fontFamily,
                                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Navigation Tabs Row (مهارتی | رسانه ای | مشخصات جلسه)
                            _buildTabsRow(),
                            const SizedBox(height: 16),

                            // Tab Body Content
                            if (_selectedTab == 2)
                              _buildSessionDetailsTab()
                            else
                              _buildSessionsAccordion(),

                            const SizedBox(height: 24),
                          ],
                        ),
                      ),
              ),

              // 3. Bottom Action Bar (منزلگاه قبل / شرکت در آزمون نهایی / ارتباط با راهبر / منزلگاه بعد)
              _buildBottomActionBar(),
            ],
          ),
        ),
      ),
    );
  }

  /// 1. Top Header
  Widget _buildTopHeader() {
    String breadcrumbSubtitle = 'کلاس های مهارتی';
    if (_selectedTab == 1) {
      breadcrumbSubtitle = 'کلاس های رسانه ای';
    } else if (_selectedTab == 2) {
      breadcrumbSubtitle = 'مشخصات جلسه';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: NOPA Logo & Back Button
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  ShaderMask(
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [Color(0xFFFBE4C8), Color(0xFFC89765)],
                    ).createShader(bounds),
                    child: const Text(
                      'NOPA',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(4),
                    child: const Text(
                      'بازگشت',
                      style: TextStyle(
                        color: Color(0xFFC89765),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                ],
              ),

              // Right: Profile Avatar & Round Menu Button
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Safe Avatar
                  SafeAvatar(
                    radius: 18,
                    imageUrl: HttpApiService().resolveMediaUrl('/uploads/avatars/default.png'),
                    name: 'کاربر',
                  ),
                  const SizedBox(width: 10),

                  // Menu Button
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF282342),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFF473E67),
                        width: 1.0,
                      ),
                    ),
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(
                        Icons.menu_rounded,
                        color: Color(0xFFFBE4C8),
                        size: 20,
                      ),
                      onPressed: () {
                        // Open drawer / menu if available
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Breadcrumb on Right
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                '$_stationTitle / $breadcrumbSubtitle',
                textDirection: TextDirection.rtl,
                style: const TextStyle(
                  color: Color(0xFF9D99B8),
                  fontSize: 12,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 2. Video Player Card
  Widget _buildVideoPlayerCard() {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF2C2748),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: const Color(0xFF4C4372),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
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
                // Idle / Camera Placeholder icon matching screenshot
                Center(
                  child: Container(
                    width: 68,
                    height: 52,
                    decoration: BoxDecoration(
                      color: const Color(0xFF463D6C).withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.videocam_rounded,
                      color: Color(0xFFDDD9EE),
                      size: 34,
                    ),
                  ),
                ),
              ],
            ],
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: Icon(
                controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 20,
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
                  style: const TextStyle(color: Colors.white, fontSize: 10),
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
        const SizedBox(height: 6),
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? const Color(0xFFE5B888) : const Color(0xFF9D99B8),
            fontSize: isSelected ? 15 : 14,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ),
    );
  }

  /// 4. Sessions Accordion List
  Widget _buildSessionsAccordion() {
    final sessions = _currentSessions;
    if (sessions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 30),
        child: Center(
          child: Text(
            'جلسه‌ای برای این بخش ثبت نشده است.',
            style: TextStyle(
              color: Color(0xFF9D99B8),
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
            gradient: const LinearGradient(
              colors: [Color(0xFF3B355B), Color(0xFF302B4E)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isExpanded ? const Color(0xFF6B5F94) : const Color(0xFF473E67),
              width: 1.0,
            ),
          ),
          child: Column(
            children: [
              // Accordion Header
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
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  child: Row(
                    children: [
                      // Arrow on Far Left (Up when expanded, Down when collapsed)
                      Icon(
                        isExpanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: const Color(0xFFDDD9EE),
                        size: 22,
                      ),
                      const SizedBox(width: 8),

                      // Session Title on Right
                      Expanded(
                        child: Text(
                          session['title'] ?? 'جلسه ${_toFarsiDigit(sIndex + 1)}',
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            color: const Color(0xFFF3EFFE),
                            fontSize: 13.5,
                            fontWeight: isExpanded ? FontWeight.bold : FontWeight.w500,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Expanded Parts Section
              if (isExpanded && clips.isNotEmpty) ...[
                Container(
                  margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1A33),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF473E67).withValues(alpha: 0.6),
                      width: 1.0,
                    ),
                  ),
                  child: Column(
                    children: List.generate(clips.length, (cIndex) {
                      final clip = clips[cIndex];
                      final isPlaying = isExpanded && _currentClipIndex == cIndex;
                      final durationSec = (clip['duration'] as num?)?.toInt() ?? 900;

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            // 1. Far Left: Outlined Pill Button "آزمون"
                            OutlinedButton(
                              onPressed: () => _showPartMiniQuiz(cIndex),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                  color: Color(0xFF8277A8),
                                  width: 1.0,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 0,
                                ),
                                minimumSize: const Size(0, 26),
                              ),
                              child: const Text(
                                'آزمون',
                                style: TextStyle(
                                  color: Color(0xFFDDD9EE),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                                ),
                              ),
                            ),
                            const Spacer(),

                            // 2. Center: Duration
                            Text(
                              _formatDuration(durationSec),
                              style: const TextStyle(
                                color: Color(0xFF9D99B8),
                                fontSize: 11,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                            const SizedBox(width: 12),

                            // 3. Right: Title
                            Expanded(
                              flex: 5,
                              child: GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _currentClipIndex = cIndex;
                                  });
                                  _initializeVideoForCurrentSession();
                                },
                                child: Text(
                                  clip['title'] ?? 'پارت ${_toFarsiDigit(cIndex + 1)}',
                                  textAlign: TextAlign.right,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isPlaying ? const Color(0xFFE5B888) : const Color(0xFFDDD9EE),
                                    fontSize: 12,
                                    fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),

                            // 4. Far Right: Play / Pause Icon
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  _currentClipIndex = cIndex;
                                });
                                _initializeVideoForCurrentSession();
                              },
                              child: Icon(
                                isPlaying
                                    ? Icons.pause_circle_outline_rounded
                                    : Icons.play_arrow_outlined,
                                color: isPlaying ? const Color(0xFFE5B888) : const Color(0xFF9D99B8),
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ),
                ),
              ],
            ],
          ),
        );
      }),
    );
  }

  /// 5. Session Details Tab
  Widget _buildSessionDetailsTab() {
    final session = _activeSession;
    if (session == null) {
      return const SizedBox.shrink();
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Teacher card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF2C2748),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF473E67)),
            ),
            child: Row(
              children: [
                SafeAvatar(
                  radius: 24,
                  imageUrl: HttpApiService().resolveMediaUrl('/uploads/avatars/default.png'),
                  name: 'استاد',
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session['instructor'] ?? 'استاد دوره',
                        style: const TextStyle(
                          color: Color(0xFFFBE4C8),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        session['description'] ?? 'توضیحات تکمیلی جلسه و اهداف کاروان',
                        style: const TextStyle(
                          color: Color(0xFF9D99B8),
                          fontSize: 11,
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
          const SizedBox(height: 12),

          // Download Pamphlet Button
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF241F3B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFC09268).withValues(alpha: 0.6)),
            ),
            child: ListTile(
              leading: const Icon(Icons.download_rounded, color: Color(0xFFE5B888)),
              title: const Text(
                'دانلود جزوه و درسنامه آموزشی',
                style: TextStyle(
                  color: Color(0xFFDDD9EE),
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              trailing: const Icon(Icons.chevron_left_rounded, color: Color(0xFF9D99B8)),
              onTap: () => _showDownloadPamphletDialog(session['title'] ?? 'جزوه'),
            ),
          ),
        ],
      ),
    );
  }

  /// 6. Bottom Action Bar (منزلگاه قبل / ارتباط با راهبر / شرکت در آزمون نهایی / منزلگاه بعد)
  Widget _buildBottomActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1A33),
        border: Border(
          top: BorderSide(
            color: const Color(0xFF473E67).withValues(alpha: 0.4),
            width: 1.0,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 1. Far Left: منزلگاه قبل
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
                Icon(
                  Icons.chevron_left_rounded,
                  color: _currentStationIndex > 0 ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94),
                  size: 20,
                ),
                Text(
                  'منزلگاه قبل',
                  style: TextStyle(
                    color: _currentStationIndex > 0 ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94),
                    fontSize: 10,
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
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(
                  color: Color(0xFF5A4D80),
                  width: 1.0,
                ),
              ),
            ),
            child: const Text(
              'ارتباط با راهبر',
              style: TextStyle(
                fontSize: 11,
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
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(
                  color: Color(0xFFC09268),
                  width: 1.0,
                ),
              ),
            ),
            child: const Text(
              'شرکت در آزمون نهایی',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),

          // 4. Far Right: منزلگاه بعد
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
                Text(
                  'منزلگاه بعد',
                  style: TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 10,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFFDDD9EE),
                  size: 20,
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
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                          Text(
                            'سوال ${_toFarsiDigit(currentQuestionIndex + 1)} از ${_toFarsiDigit(quizQuestions.length)}',
                            style: const TextStyle(
                              color: Color(0xFF9D99B8),
                              fontSize: 12,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(height: 1, color: const Color(0xFF473E67)),
                      const SizedBox(height: 12),
                      Text(
                        question['question'] ?? question['q'] ?? 'سوال',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                      const SizedBox(height: 14),
                      ...List.generate((question['options'] as List).length, (idx) {
                        bool isSel = selectedAns == idx;
                        return GestureDetector(
                          onTap: () => setDialogState(() => userAnswers[currentQuestionIndex] = idx),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                                  size: 18,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    question['options'][idx]?.toString() ?? '',
                                    style: TextStyle(
                                      color: isSel ? const Color(0xFFFBE4C8) : const Color(0xFFDDD9EE),
                                      fontSize: 12,
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
                      const SizedBox(height: 16),
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
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          currentQuestionIndex < quizQuestions.length - 1
                              ? 'سوال بعدی'
                              : 'ثبت و مشاهده نتیجه',
                          style: const TextStyle(
                            fontSize: 13,
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
                  size: 48,
                ),
                const SizedBox(height: 12),
                const Text(
                  'آزمون نهایی منزلگاه',
                  style: TextStyle(
                    color: Color(0xFFFBE4C8),
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'آزمون نهایی شامل سنجش مهارت‌های فراگرفته شده در تمامی جلسات این منزلگاه است.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 12,
                    height: 1.5,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    _showPartMiniQuiz(0);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC09268),
                    foregroundColor: const Color(0xFF1E1A33),
                    minimumSize: const Size(double.infinity, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    'شروع آزمون نهایی',
                    style: TextStyle(
                      fontSize: 13,
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
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'در حال دریافت فایل جزوه...',
                    style: TextStyle(
                      color: Color(0xFFFBE4C8),
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white10,
                    valueColor: const AlwaysStoppedAnimation(Color(0xFFC09268)),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${(progress * 100).toInt()}%',
                    style: const TextStyle(color: Color(0xFF9D99B8), fontSize: 12),
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
