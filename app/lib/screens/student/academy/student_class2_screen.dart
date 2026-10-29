import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/utils/mentor_contact.dart';
import 'package:nopa_app/widgets/reward_popup.dart';

/// Class 2 Screen (صفحه کلاس‌ها، مجموعه‌ها، پارت‌ها، پخش‌کننده ویدیو و آزمون‌ها)
class StudentClass2Screen extends StatefulWidget {
  const StudentClass2Screen({super.key});

  @override
  State<StudentClass2Screen> createState() => _Class2ScreenState();
}

/// Backwards compatibility alias
typedef ClassPlayerScreen = Class2Screen;

class _Class2ScreenState extends State<StudentClass2Screen> {
  // Navigation & Category state
  int _selectedTab = 0; // 0: مهارتی, 1: رسانه ای, 2: مشخصات جلسه
  int _currentStationIndex = 0;

  // Sessions & Clips
  List<Map<String, dynamic>> _skillSessions = [];
  List<Map<String, dynamic>> _mediaSessions = [];
  int _expandedSessionIndex = 0;
  int _currentClipIndex = 0;
  bool _isLoadingClasses = true;

  String _stationId = '';

  // Clips watched past the threshold (key: '<sessionId>|<clipId>', see _passedKey)
  final Set<String> _unlockedQuizzes = {};

  // Quizzes the student has passed (key: '<sessionId>|<clipId>', see _passedKey)
  final Set<String> _passedQuizzes = {};

  /// Fraction of a video that must be watched before its quiz unlocks.
  static const double _quizUnlockThreshold = 0.90;

  // Video controller
  int _videoSessionToken = 0;
  bool _isMiniQuizShowing = false;

  bool _argumentsLoaded = false;
  String? _targetSessionTitle;
  String? _targetInstructor;

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

      if (args['initialTab'] is int) {
        _selectedTab = args['initialTab'];
      } else if (args['tab'] is int) {
        _selectedTab = args['tab'];
      } else if (args['type'] == 'media' || args['type'] == 'mediaClass') {
        _selectedTab = 1;
      } else if (args['type'] == 'skill' || args['type'] == 'skillClass') {
        _selectedTab = 0;
      }

      if (args['initialIndex'] is int) {
        _expandedSessionIndex = args['initialIndex'];
      }

      _targetSessionTitle = args['sessionTitle'] as String? ?? args['title'] as String?;
      _targetInstructor = args['instructor'] as String?;

      final passedCategories = args['categories'] as Map<String, List<Map<String, dynamic>>>?;
      final passedClasses = args['classes'] as List?;

      if (passedCategories != null && passedCategories.isNotEmpty) {
        for (var entry in passedCategories.entries) {
          final sessions = entry.value.map((s) {
            final map = Map<String, dynamic>.from(s);
            var clips = (map['videoClips'] as List?)?.map((c) => Map<String, dynamic>.from(c as Map)).toList() ?? [];
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
          map['videoClips'] = clips;
          return map;
        }).toList();
      }
    }

    _fetchData();
    _loadPassedQuizzes();
  }

  Future<void> _fetchData() async {
    try {
      final apiService = HttpApiService();

      if (_skillSessions.isEmpty || _mediaSessions.isEmpty) {
        final stations = await apiService.getStations();
        if (stations.isNotEmpty) {
          final sIndex = _currentStationIndex.clamp(0, stations.length - 1);
          final currentStationData = stations[sIndex];
          _stationId = currentStationData['id']?.toString() ?? '';

          final categories = currentStationData['categories'] as List? ?? [];
          for (final cat in categories) {
            if (cat is Map) {
              final catTitle = cat['title']?.toString() ?? '';
              final sessions = (cat['sessions'] as List?)?.map((s) {
                final map = Map<String, dynamic>.from(s as Map);
                var clips = (map['videoClips'] as List?)?.map((c) => Map<String, dynamic>.from(c as Map)).toList() ?? [];
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

      // If a specific session was requested, select and expand it
      if (_targetSessionTitle != null && _targetSessionTitle!.trim().isNotEmpty) {
        final cleanTarget = _targetSessionTitle!.replaceAll(RegExp(r'[\s\.\:\-_()0-9\u06F0-\u06F9]'), '');
        int foundInSkill = -1;
        int foundInMedia = -1;

        for (int i = 0; i < _skillSessions.length; i++) {
          final t = (_skillSessions[i]['title']?.toString() ?? '').replaceAll(RegExp(r'[\s\.\:\-_()0-9\u06F0-\u06F9]'), '');
          if (t.isNotEmpty && cleanTarget.isNotEmpty && (t.contains(cleanTarget) || cleanTarget.contains(t))) {
            foundInSkill = i;
            break;
          }
        }

        for (int i = 0; i < _mediaSessions.length; i++) {
          final t = (_mediaSessions[i]['title']?.toString() ?? '').replaceAll(RegExp(r'[\s\.\:\-_()0-9\u06F0-\u06F9]'), '');
          if (t.isNotEmpty && cleanTarget.isNotEmpty && (t.contains(cleanTarget) || cleanTarget.contains(t))) {
            foundInMedia = i;
            break;
          }
        }

        if (foundInSkill != -1 && (_selectedTab == 0 || foundInMedia == -1)) {
          _selectedTab = 0;
          _expandedSessionIndex = foundInSkill;
        } else if (foundInMedia != -1) {
          _selectedTab = 1;
          _expandedSessionIndex = foundInMedia;
        } else {
          // Fallback: update active tab's first session title to match requested session
          final targetList = _selectedTab == 1 ? _mediaSessions : _skillSessions;
          if (targetList.isNotEmpty) {
            targetList[0]['title'] = _targetSessionTitle;
            if (_targetInstructor != null) {
              targetList[0]['instructor'] = _targetInstructor;
            }
            _expandedSessionIndex = 0;
          }
        }
      }

      if (mounted) {
        setState(() {
          _isLoadingClasses = false;
        });
        _initializeVideoForCurrentSession();
      }
    } catch (e) {
      debugPrint('Error fetching class data: $e');
      if (mounted) {
        setState(() {
          _isLoadingClasses = false;
        });
        _initializeVideoForCurrentSession();
      }
    }
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
    setState(() {
      _videoSessionToken++;
      _isMiniQuizShowing = false;
    });
  }

  String get _currentVideoUrl {
    final session = _activeSession;
    if (session == null) return '';
    if (_isSessionLocked(_currentSessions, _expandedSessionIndex)) return '';
    final clips = session['videoClips'] as List? ?? [];
    String url = '';
    if (clips.isNotEmpty && _currentClipIndex < clips.length) {
      url = clips[_currentClipIndex]['videoUrl'] ?? '';
    }
    if (url.isEmpty) {
      url = session['videoUrl'] ?? '';
    }
    return url.trim();
  }

  void _onVideoProgress(Duration position, Duration duration) {
    final pos = position.inMilliseconds;
    final dur = duration.inMilliseconds;
    if (dur > 0 && pos >= dur * _quizUnlockThreshold) {
      final session = _activeSession;
      if (session == null) return;
      // Keyed by session + clip id so the skill and media tabs never share a tick
      final key = _passedKey(session, _currentClipIndex);
      if (!_unlockedQuizzes.contains(key)) {
        setState(() {
          _unlockedQuizzes.add(key);
        });
        _recordClipWatched(session, _currentClipIndex);
      }
    }
  }

  /// Saves the watched clip to the database under its own track (skill / media).
  void _recordClipWatched(Map<String, dynamic> session, int clipIndex) {
    final clips = session['videoClips'] as List? ?? [];
    if (clipIndex >= clips.length) return;
    final clipId = clips[clipIndex]['id']?.toString();
    if (clipId == null || clipId.isEmpty) return;
    final bool isMedia = _mediaSessions.any((s) => s['id'] == session['id']);
    HttpApiService().markClipWatched(
      clipId,
      trackType: isMedia ? 'media' : 'skill',
      stationId: _stationId,
      sessionId: session['id']?.toString(),
    );
  }

  String _passedKey(Map<String, dynamic> session, int clipIndex) {
    final clips = session['videoClips'] as List? ?? [];
    final clipId = (clipIndex < clips.length ? clips[clipIndex]['id'] : null) ?? clipIndex;
    return '${session['id']}|$clipId';
  }

  /// A lesson (after the first) is open only once every part quiz of the
  /// previous lesson has been passed.
  bool _isSessionLocked(List<Map<String, dynamic>> sessions, int sIndex) {
    if (sIndex <= 0 || sIndex >= sessions.length) return false;
    final prev = sessions[sIndex - 1];
    final prevClips = prev['videoClips'] as List? ?? [];
    for (int i = 0; i < prevClips.length; i++) {
      if (!_passedQuizzes.contains(_passedKey(prev, i))) return true;
    }
    return false;
  }

  Future<void> _loadPassedQuizzes() async {
    try {
      final progress = await HttpApiService().getUserProgress();
      if (!mounted) return;
      setState(() {
        for (final p in progress) {
          if (p is! Map) continue;
          final key = '${p['sessionId']}|${p['clipId']}';
          if (p['quizPassed'] == true) _passedQuizzes.add(key);
          if (p['isWatched'] == true) _unlockedQuizzes.add(key);
        }
      });
    } catch (e) {
      debugPrint('Load quiz progress error: $e');
    }
  }

  void _onVideoEnded() {
    if (_isMiniQuizShowing) return;
    setState(() {
      _isMiniQuizShowing = true;
    });
    Future.delayed(Duration.zero, () {
      if (mounted) _showPartMiniQuiz(_currentClipIndex);
    });
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
    final url = _currentVideoUrl;
    return NopaInlineVideoPlayer(
      key: ValueKey('class2_video_${_videoSessionToken}_$url'),
      videoUrl: url,
      title: _currentPlayingTitle,
      autoPlay: url.isNotEmpty,
      onProgress: _onVideoProgress,
      onEnded: _onVideoEnded,
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
        final isLocked = _isSessionLocked(sessions, sIndex);
        final isExpanded = _expandedSessionIndex == sIndex && !isLocked;
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
                    if (isLocked) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'برای باز شدن این درس، آزمون‌های درس قبل را بگذرانید',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 11.5,
                            ),
                          ),
                          backgroundColor: Color(0xFF23223D),
                          duration: Duration(seconds: 2),
                        ),
                      );
                      return;
                    }
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
                          isLocked
                              ? Icons.lock_rounded
                              : (isExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded),
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
                        final bool isQuizUnlocked = _unlockedQuizzes.contains(_passedKey(session, cIndex)) ||
                            _passedQuizzes.contains(_passedKey(session, cIndex));

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
                                            'برای باز شدن آزمون، حداقل ۹۰٪ ویدیو را مشاهده کنید',
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
            onPressed: () => contactMentor(
              context,
              Provider.of<AppRepository>(context, listen: false).currentUser,
            ),
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

    String? currentQuizId;
    List<dynamic> quizQuestions = [];
    if (quizzes.isNotEmpty) {
      for (var q in quizzes) {
        if (q['orderIndex'] == partIndex + 1) {
          currentQuizId = q['id']?.toString();
          if (q['questionsJson'] != null) {
            try {
              final parsed = jsonDecode(q['questionsJson'].toString());
              if (parsed is List) quizQuestions = parsed;
            } catch (_) {}
          }
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
    String? feedbackMessage;
    bool isErrorFeedback = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final question = quizQuestions[currentQuestionIndex];
            final selectedAns = userAnswers[currentQuestionIndex];

            // Tapping outside / back asks whether to save the partial result.
            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, _) async {
                if (didPop) return;
                final choice = await _confirmQuizExit(context);
                if (choice == null || !context.mounted) return;
                if (choice == 'save') {
                  await _savePartialQuiz(session, partIndex, currentQuizId, userAnswers);
                }
                if (context.mounted) Navigator.of(context).pop();
              },
              child: Dialog(
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
                      const SizedBox(height: 12),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        transitionBuilder: (Widget child, Animation<double> animation) {
                          return FadeTransition(opacity: animation, child: child);
                        },
                        child: Column(
                          key: ValueKey<int>(currentQuestionIndex),
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
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
                                onTap: () => setDialogState(() {
                                  userAnswers[currentQuestionIndex] = idx;
                                  feedbackMessage = null;
                                }),
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
                          ],
                        ),
                      ),
                      if (feedbackMessage != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isErrorFeedback ? Colors.redAccent.withValues(alpha: 0.15) : const Color(0xFF10B981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isErrorFeedback ? Colors.redAccent.withValues(alpha: 0.4) : const Color(0xFF10B981).withValues(alpha: 0.4),
                            ),
                          ),
                          child: Text(
                            feedbackMessage!,
                            style: TextStyle(
                              color: isErrorFeedback ? const Color(0xFFFF8A80) : const Color(0xFF6EE7B7),
                              fontSize: 11,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          if (currentQuestionIndex > 0)
                            Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: OutlinedButton(
                                onPressed: () {
                                  setDialogState(() {
                                    currentQuestionIndex--;
                                    feedbackMessage = null;
                                  });
                                },
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF6B68A8)),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: const Text(
                                  'قبلی',
                                  style: TextStyle(color: Color(0xFFDDD9EE), fontSize: 11.5, fontFamily: AppTheme.fontFamily),
                                ),
                              ),
                            ),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: selectedAns == -1
                                  ? null
                                  : () async {
                                      if (currentQuestionIndex < quizQuestions.length - 1) {
                                        setDialogState(() {
                                          currentQuestionIndex++;
                                          feedbackMessage = null;
                                        });
                                      } else {
                                        // Evaluate all answers against correctIndex
                                        int correctCount = 0;
                                        for (int i = 0; i < quizQuestions.length; i++) {
                                          final q = quizQuestions[i];
                                          final cIdx = q['correctIndex'] is int
                                              ? q['correctIndex']
                                              : int.tryParse(q['correctIndex']?.toString() ?? '') ?? 0;
                                          if (userAnswers[i] == cIdx) {
                                            correctCount++;
                                          }
                                        }

                                        // The server is the source of truth for pass/fail.
                                        final sessionId = session?['id']?.toString() ?? '';
                                        int shownScore = correctCount;
                                        int rewardZarik = 10;
                                        bool passed;
                                        if (sessionId.isNotEmpty) {
                                          Map<String, dynamic>? result;
                                          try {
                                            result = await HttpApiService().submitClassSessionQuiz(sessionId, userAnswers, quizId: currentQuizId);
                                          } catch (e) {
                                            debugPrint('Submit quiz error: $e');
                                          }
                                          if (result == null) {
                                            if (context.mounted) {
                                              setDialogState(() {
                                                isErrorFeedback = true;
                                                feedbackMessage = 'ثبت آزمون با خطا مواجه شد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
                                              });
                                            }
                                            return;
                                          }
                                          passed = result['passed'] == true;
                                          if (result['score'] is num) shownScore = (result['score'] as num).toInt();
                                          if (result['rewardZarik'] is num) rewardZarik = (result['rewardZarik'] as num).toInt();
                                        } else {
                                          passed = correctCount == quizQuestions.length ||
                                              (quizQuestions.length > 1 && correctCount >= (quizQuestions.length * 0.6).ceil());
                                        }

                                        if (passed) {
                                          if (session != null && mounted) {
                                            setState(() {
                                              _passedQuizzes.add(_passedKey(session, partIndex));
                                            });
                                          }

                                          if (context.mounted) {
                                            Navigator.pop(context);
                                            RewardPopup.show(
                                              context,
                                              message: 'تبریک! آزمون این پارت را با نمره ${_toFarsiDigit(shownScore)} از ${_toFarsiDigit(quizQuestions.length)} گذراندید!',
                                              zarikAmount: rewardZarik,
                                            );
                                          }
                                        } else {
                                          setDialogState(() {
                                            isErrorFeedback = true;
                                            feedbackMessage = 'نمره قبولی کسب نشد (${_toFarsiDigit(shownScore)} از ${_toFarsiDigit(quizQuestions.length)} درست بود). گزینه‌ها را مجدداً مرور فرمایید.';
                                          });
                                        }
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
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ));
          },
        );
      },
    ).then((_) {
      // Let the next video end (e.g. after a re-watch) open the quiz again
      if (mounted) setState(() => _isMiniQuizShowing = false);
    });
  }

  /// Returns 'save', 'discard', or null when the student stays in the quiz.
  Future<String?> _confirmQuizExit(BuildContext ctx) {
    TextStyle style(Color c, {bool bold = false}) => TextStyle(
          color: c,
          fontSize: 12,
          fontWeight: bold ? FontWeight.bold : FontWeight.normal,
          fontFamily: AppTheme.fontFamily,
          fontFamilyFallback: AppTheme.fontFamilyFallback,
        );
    return showDialog<String>(
      context: ctx,
      builder: (c) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF241F3B),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFC09268)),
          ),
          title: Text('خروج از آزمون', style: style(const Color(0xFFFBE4C8), bold: true)),
          content: Text(
            'آیا می‌خواهید نتیجه آزمون ذخیره شود؟',
            style: style(const Color(0xFFDDD9EE)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c),
              child: Text('ادامه آزمون', style: style(const Color(0xFF9D99B8))),
            ),
            TextButton(
              onPressed: () => Navigator.pop(c, 'discard'),
              child: Text('ذخیره نشود', style: style(const Color(0xFFFF8A80))),
            ),
            TextButton(
              onPressed: () => Navigator.pop(c, 'save'),
              child: Text('ذخیره شود', style: style(const Color(0xFFE5B888), bold: true)),
            ),
          ],
        ),
      ),
    );
  }

  /// Submits whatever has been answered so far (unanswered stay -1).
  Future<void> _savePartialQuiz(
    Map<String, dynamic>? session,
    int partIndex,
    String? quizId,
    List<int> answers,
  ) async {
    final sessionId = session?['id']?.toString() ?? '';
    if (sessionId.isEmpty || answers.every((a) => a == -1)) return;
    try {
      final result = await HttpApiService().submitClassSessionQuiz(sessionId, answers, quizId: quizId);
      if (result != null && result['passed'] == true && session != null && mounted) {
        setState(() => _passedQuizzes.add(_passedKey(session, partIndex)));
      }
    } catch (e) {
      debugPrint('Save partial quiz error: $e');
    }
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


typedef Class2Screen = StudentClass2Screen;
