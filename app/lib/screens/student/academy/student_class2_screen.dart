import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';
import '../../../widgets/nopa_dialog_container.dart';
import 'package:nopa_app/core/station_numbering.dart';
import 'package:nopa_app/core/schedule_utils.dart';
import 'package:nopa_app/core/station_categories.dart';
import 'package:nopa_app/models/user_model.dart';
import 'dart:async';
import 'package:nopa_app/widgets/app_toast.dart';
import 'dart:convert';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/utils/mentor_contact.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:url_launcher/url_launcher.dart';

/// Class 2 Screen (صفحه کلاس‌ها، مجموعه‌ها، پارت‌ها، پخش‌کننده ویدیو و آزمون‌ها)
class StudentClass2Screen extends StatefulWidget {
  const StudentClass2Screen({super.key});

  @override
  State<StudentClass2Screen> createState() => _Class2ScreenState();
}


class _Class2ScreenState extends State<StudentClass2Screen> {
  // Navigation & Category state
  // One tab per class category of the station (same number, names and order as the admin panel),
  // followed by the "مشخصات جلسه" tab.
  int _selectedTab = 0; // index into _categories
  bool _detailsTabSelected = false; // the "مشخصات جلسه" tab
  int _currentStationIndex = 0;

  // Sessions & Clips, grouped by category
  List<StationCategory> _categories = [];
  // Requested by the opening screen; resolved once the categories are known
  String? _targetSessionId;
  String? _targetCategoryId;
  int _expandedSessionIndex = 0;
  int _currentClipIndex = 0;
  bool _isLoadingClasses = true;

  List<Map<String, dynamic>> _stationsData = [];
  // The station exactly as the opening screen showed it (the mentor's report); null = take it from the server list
  Map<String, dynamic>? _stationDataArg;
  String _stationId = '';
  String _stationTitle = '';
  int _stationNumber = 0;
  int _stationCount = 0;
  final Set<String> _reportedDurations = {};

  // Clips watched past the threshold (key: '<sessionId>|<clipId>', see _passedKey)
  final Set<String> _unlockedQuizzes = {};

  // Quizzes the student has passed (key: '<sessionId>|<clipId>', see _passedKey)
  final Set<String> _passedQuizzes = {};

  // Quizzes the student has fully answered and submitted, right or wrong.
  // Answering (not passing) is what opens the next part.
  final Set<String> _answeredQuizzes = {};

  String get _answeredPrefsKey =>
      'answered_quizzes_${Provider.of<AppRepository>(context, listen: false).currentUser.id}';

  bool _isAnswered(Map<String, dynamic> session, int clipIndex) {
    final key = _passedKey(session, clipIndex);
    return _answeredQuizzes.contains(key) || _passedQuizzes.contains(key);
  }

  // The student's own answers per quiz, shown when the quiz is reviewed later.
  final Map<String, List<int>> _quizAnswers = {};

  String get _answersPrefsKey =>
      'quiz_answers_${Provider.of<AppRepository>(context, listen: false).currentUser.id}';

  void _markAnswered(Map<String, dynamic>? session, int clipIndex, List<int> answers) {
    if (session == null) return;
    final key = _passedKey(session, clipIndex);
    if (_answeredQuizzes.contains(key)) return;
    if (mounted) {
      setState(() {
        _answeredQuizzes.add(key);
        _quizAnswers[key] = List<int>.from(answers);
      });
    }
    SharedPreferences.getInstance().then((prefs) {
      prefs.setStringList(_answeredPrefsKey, _answeredQuizzes.toList());
      prefs.setString(_answersPrefsKey, jsonEncode(_quizAnswers));
    }).catchError((e) {
      debugPrint('Save answered quizzes error: $e');
    });
  }

  Future<void> _loadAnsweredQuizzes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getStringList(_answeredPrefsKey) ?? [];
      final rawAnswers = prefs.getString(_answersPrefsKey);
      final loaded = <String, List<int>>{};
      if (rawAnswers != null) {
        (jsonDecode(rawAnswers) as Map).forEach((k, v) {
          loaded[k.toString()] = (v as List).map((e) => (e as num).toInt()).toList();
        });
      }
      if (mounted) {
        setState(() {
          _answeredQuizzes.addAll(saved);
          _quizAnswers.addAll(loaded);
        });
      }
    } catch (e) {
      debugPrint('Load answered quizzes error: $e');
    }
    await _syncAnsweredQuizzesFromServer();
  }

  /// The server is the source of truth: quizzes answered on another device (or before a reinstall) show up here,
  /// and the merged result is kept locally for offline use.
  Future<void> _syncAnsweredQuizzesFromServer() async {
    try {
      final remote = await HttpApiService().getMyQuizAnswers();
      if (remote.isEmpty || !mounted) return;
      setState(() {
        for (final r in remote) {
          final clipId = r['clipId']?.toString();
          final key = '${r['sessionId']}|${(clipId != null && clipId.isNotEmpty) ? clipId : r['partIndex']}';
          _answeredQuizzes.add(key);
          final answers = r['answers'];
          if (answers is List && answers.isNotEmpty) {
            _quizAnswers[key] = answers.map((e) => (e as num).toInt()).toList();
          }
        }
      });
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_answeredPrefsKey, _answeredQuizzes.toList());
      await prefs.setString(_answersPrefsKey, jsonEncode(_quizAnswers));
    } catch (e) {
      debugPrint('Sync answered quizzes error: $e');
    }
  }

  /// A part (after the first) opens only after the previous part's quiz is answered.
  bool _isPartLocked(Map<String, dynamic> session, int clipIndex) =>
      (clipIndex > 0 && !_isAnswered(session, clipIndex - 1)) || _clipUnlockTime(session, clipIndex) != null;

  /// Mentors are not bound by the release schedule (the server does the same for stations).
  bool get _isMentorUser {
    final role = Provider.of<AppRepository>(context, listen: false).currentUser.role;
    return role.isMentorLike;
  }

  /// When a session that has not started yet opens; null when it is open (or has no schedule).
  DateTime? _sessionOpensAt(Map<String, dynamic> session) {
    if (_isMentorUser) return null;
    final start = ScheduleUtils.sessionStart(session);
    return ScheduleUtils.hasStarted(start) ? null : start;
  }

  /// When a part that is still waiting for its scheduled time opens; null when it is open.
  DateTime? _clipUnlockTime(Map<String, dynamic> session, int clipIndex) {
    if (_isMentorUser) return null;
    final clips = session['videoClips'] as List? ?? [];
    if (clipIndex < 0 || clipIndex >= clips.length || clips[clipIndex] is! Map) return null;
    final unlock = ScheduleUtils.clipUnlockInstant(Map<String, dynamic>.from(clips[clipIndex] as Map));
    return ScheduleUtils.hasStarted(unlock) ? null : unlock;
  }

  /// Fraction of a video that must be watched before its quiz unlocks.
  static const double _quizUnlockThreshold = 0.90;

  // Video controller
  int _videoSessionToken = 0;
  bool _isMiniQuizShowing = false;

  // After a part's quiz is answered, the next part starts by itself with a visible countdown.
  static const int _nextPartCountdownSeconds = 10;
  static const Duration _nextPartCountdownDelay = Duration(seconds: 3);
  final ValueNotifier<NextPartCountdown?> _nextPartCountdown = ValueNotifier(null);
  Timer? _nextPartTimer;

  void _cancelNextPartCountdown() {
    _nextPartTimer?.cancel();
    _nextPartTimer = null;
    _nextPartCountdown.value = null;
  }

  @override
  void dispose() {
    _nextPartTimer?.cancel();
    _nextPartCountdown.dispose();
    super.dispose();
  }

  /// Not shown when the lesson has no further part, or the next part is still locked (e.g. by schedule).
  void _startNextPartCountdown(Map<String, dynamic> session, int partIndex) {
    _cancelNextPartCountdown();
    if (_activeSession?['id'] != session['id'] || _currentClipIndex != partIndex) return;
    final clips = session['videoClips'] as List? ?? [];
    final int next = partIndex + 1;
    if (next >= clips.length || _isPartLocked(session, next)) return;
    final String name = clips[next]['title']?.toString() ?? 'پارت ${_toFarsiDigit(next + 1)}';

    _nextPartTimer = Timer(_nextPartCountdownDelay, () {
      if (!mounted) return;
      int left = _nextPartCountdownSeconds;
      _nextPartCountdown.value = NextPartCountdown(left, name);
      _nextPartTimer = Timer.periodic(const Duration(seconds: 1), (t) {
        // The student moved elsewhere meanwhile: drop the countdown
        if (!mounted || _activeSession?['id'] != session['id'] || _currentClipIndex != partIndex) {
          _cancelNextPartCountdown();
          return;
        }
        left--;
        if (left <= 0) {
          _cancelNextPartCountdown();
          setState(() {
            _currentClipIndex = next;
            _playRequested = true;
          });
          _initializeVideoForCurrentSession();
          return;
        }
        _nextPartCountdown.value = NextPartCountdown(left, name);
      });
    });
  }

  // The video starts only after the student taps a part; opening a lesson just shows it.
  bool _playRequested = false;

  // Used to open the last thing the student watched when the screen opens.
  final List<Map<String, dynamic>> _progressRecords = [];
  bool _progressLoaded = false;
  bool _sessionsLoaded = false;
  bool _lastSeenApplied = false;

  /// Opens the folder (lesson) and part the student watched last, without playing it.
  void _applyLastSeen() {
    if (_lastSeenApplied || !_progressLoaded || !_sessionsLoaded) return;
    _lastSeenApplied = true;
    if (_targetSessionTitle != null && _targetSessionTitle!.trim().isNotEmpty) return;
    if (_targetSessionId != null || _targetCategoryId != null) return;

    String latest = '';
    int? bestTab;
    int bestSession = -1;
    int bestClip = -1;
    for (final p in _progressRecords) {
      if (p['isWatched'] != true && p['quizPassed'] != true) continue;
      final updated = p['updatedAt']?.toString() ?? '';
      if (updated.compareTo(latest) < 0) continue;
      for (int tab = 0; tab < _categories.length; tab++) {
        final sessions = _categories[tab].sessions;
        for (int s = 0; s < sessions.length; s++) {
          if (sessions[s]['id']?.toString() != p['sessionId']?.toString()) continue;
          final clips = sessions[s]['videoClips'] as List? ?? [];
          for (int c = 0; c < clips.length; c++) {
            if (clips[c]['id']?.toString() == p['clipId']?.toString() &&
                !_isSessionLocked(sessions, s)) {
              latest = updated;
              bestTab = tab;
              bestSession = s;
              bestClip = c;
            }
          }
        }
      }
    }
    if (bestTab == null) return;
    setState(() {
      _selectedTab = bestTab!;
      _detailsTabSelected = false;
      _expandedSessionIndex = bestSession;
      _currentClipIndex = bestClip;
      _playRequested = false;
    });
    _initializeVideoForCurrentSession();
  }

  bool _argumentsLoaded = false;
  String? _targetSessionTitle;

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
      // Shown right away; replaced by the loaded station data
      if (args['stationTitle'] is String) _stationTitle = args['stationTitle'];
      if (args['stationNumber'] is int) _stationNumber = args['stationNumber'];

      // Which tab to open: a category id / session id is exact; an index or the old 'skill' / 'media' type
      // points at the first / second category
      final requestedTab = args['initialTab'] ?? args['tab'];
      if (requestedTab is int) {
        _selectedTab = requestedTab;
      } else {
        _selectedTab = StationCategories.indexForTrackType(args['type']?.toString()) ?? 0;
      }
      if (args['categoryIndex'] is int) _selectedTab = args['categoryIndex'];
      _targetCategoryId = args['categoryId']?.toString();
      _targetSessionId = args['sessionId']?.toString();

      if (args['initialIndex'] is int) {
        _expandedSessionIndex = args['initialIndex'];
      }

      _targetSessionTitle = args['sessionTitle'] as String? ?? args['title'] as String?;

      if (args['stationData'] is Map) {
        _stationDataArg = Map<String, dynamic>.from(args['stationData'] as Map);
      }
    }

    _fetchData();
    _loadPassedQuizzes();
    _loadAnsweredQuizzes();
  }

  static String _cleanTitle(String s) => s.replaceAll(RegExp(r'[\s\.\:\-_()0-9۰-۹]'), '');

  Future<void> _fetchData({bool force = false}) async {
    try {
      final apiService = HttpApiService();

      final stations = await apiService.getStations();
      if (stations.isNotEmpty) {
        final sIndex = _currentStationIndex.clamp(0, stations.length - 1);
        _stationsData = stations;
        final data = stations[sIndex];
        final shown = _stationDataArg ?? data;
        _stationId = shown['id']?.toString() ?? '';
        _stationCount = stations.length;
        _stationTitle = shown['title']?.toString() ?? '';
        _stationNumber = (shown['orderIndex'] as num?)?.toInt() ?? StationNumbering.numberAt(sIndex + 1);
      }

      // The tabs are always built from the station's current categories, so a category renamed, added,
      // removed or reordered in the admin panel shows here exactly as it is there
      final Map<String, dynamic>? stationData = _stationDataArg ??
          (stations.isNotEmpty ? stations[_currentStationIndex.clamp(0, stations.length - 1)] : null);
      _categories = StationCategories.parse(stationData?['categories'] as List?);

      if (_targetCategoryId != null) {
        final i = _categories.indexWhere((c) => c.id == _targetCategoryId);
        if (i >= 0) _selectedTab = i;
      }

      // A specific session was requested: select its tab and expand it (by id first, then by title)
      bool found = false;
      if (_targetSessionId != null) {
        for (int c = 0; c < _categories.length && !found; c++) {
          final s = _categories[c].sessions.indexWhere((x) => x['id']?.toString() == _targetSessionId);
          if (s >= 0) {
            _selectedTab = c;
            _expandedSessionIndex = s;
            found = true;
          }
        }
      }
      if (!found && _targetSessionTitle != null && _targetSessionTitle!.trim().isNotEmpty) {
        final cleanTarget = _cleanTitle(_targetSessionTitle!);
        // The requested tab is searched first, then the others
        final order = [
          if (_selectedTab >= 0 && _selectedTab < _categories.length) _selectedTab,
          for (int c = 0; c < _categories.length; c++)
            if (c != _selectedTab) c,
        ];
        for (final c in order) {
          final sessions = _categories[c].sessions;
          final s = sessions.indexWhere((x) {
            final t = _cleanTitle(x['title']?.toString() ?? '');
            return t.isNotEmpty && cleanTarget.isNotEmpty && (t.contains(cleanTarget) || cleanTarget.contains(t));
          });
          if (s >= 0) {
            _selectedTab = c;
            _expandedSessionIndex = s;
            break;
          }
        }
      }
      if (_categories.isEmpty || _selectedTab < 0 || _selectedTab >= _categories.length) {
        _selectedTab = 0;
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
    _sessionsLoaded = true;
    if (mounted) _applyLastSeen();
  }

  /// A station is open when the user's level reached it or the stations before it are completed.
  bool _isStationLocked(int index) {
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    // The server also locks a station by its release time or manually
    if (!_isMentorUser && index >= 0 && index < _stationsData.length && _stationsData[index]['isLocked'] == true) {
      return true;
    }
    final level = user.levelFrame < 1 ? 1 : user.levelFrame;
    return index > 0 && (index + 1) > level && index > user.completedStationsCount;
  }

  Future<void> _goToStation(int delta) async {
    final target = _currentStationIndex + delta;
    if (target < 0 || (_stationCount > 0 && target >= _stationCount)) return;
    if (_isStationLocked(target)) {
      AppToast.info(context, 'این منزلگاه هنوز باز نشده است. ابتدا منزلگاه قبلی را کامل کنید.');
      return;
    }
    setState(() {
      _currentStationIndex = target;
      _expandedSessionIndex = 0;
      _currentClipIndex = 0;
      _playRequested = false;
      // The requested session / category belonged to the previous station
      _targetSessionTitle = null;
      _targetSessionId = null;
      _targetCategoryId = null;
      _stationDataArg = null;
      _isLoadingClasses = true;
    });
    await _fetchData(force: true);
  }

  StationCategory? get _currentCategory =>
      (_selectedTab >= 0 && _selectedTab < _categories.length) ? _categories[_selectedTab] : null;

  List<Map<String, dynamic>> get _currentSessions => _currentCategory?.sessions ?? const [];

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
    _cancelNextPartCountdown();
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

  /// Preview picture of the clip being shown (set per part in the admin panel), if any.
  String? get _currentCoverUrl {
    final session = _activeSession;
    if (session == null) return null;
    final clips = session['videoClips'] as List? ?? [];
    if (clips.isEmpty || _currentClipIndex >= clips.length) return null;
    final cover = clips[_currentClipIndex]['coverImageUrl']?.toString().trim();
    return (cover == null || cover.isEmpty) ? null : cover;
  }

  void _onVideoProgress(Duration position, Duration duration) {
    final pos = position.inMilliseconds;
    final dur = duration.inMilliseconds;
    _reportRealDuration(duration);
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

  /// The player knows a clip's real length: show it in the list and tell the server once.
  void _reportRealDuration(Duration duration) {
    final secs = duration.inSeconds;
    final clips = _activeSession?['videoClips'] as List? ?? [];
    if (secs <= 0 || _currentClipIndex >= clips.length) return;
    final clip = clips[_currentClipIndex];
    final id = clip['id']?.toString();
    final stored = (clip['duration'] as num?)?.toInt();
    if (id == null || id.isEmpty || _reportedDurations.contains(id)) return;
    if (stored != null && (stored - secs).abs() <= 2) return;
    _reportedDurations.add(id);
    clip['duration'] = secs;
    HttpApiService().reportClipDuration(id, secs);
    if (mounted) setState(() {});
  }

  /// Saves the watched clip to the database under the track of its category.
  void _recordClipWatched(Map<String, dynamic> session, int clipIndex) {
    final clips = session['videoClips'] as List? ?? [];
    if (clipIndex >= clips.length) return;
    final clipId = clips[clipIndex]['id']?.toString();
    if (clipId == null || clipId.isEmpty) return;
    final category = _categories.firstWhere(
      (c) => c.sessions.any((s) => s['id'] == session['id']),
      orElse: () => _currentCategory ?? const StationCategory(id: '', title: '', index: 0, sessions: []),
    );
    HttpApiService().markClipWatched(
      clipId,
      trackType: category.trackType,
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
  /// previous lesson has been answered.
  bool _isSessionLocked(List<Map<String, dynamic>> sessions, int sIndex) {
    if (sIndex >= 0 && sIndex < sessions.length && _sessionOpensAt(sessions[sIndex]) != null) return true;
    if (sIndex <= 0 || sIndex >= sessions.length) return false;
    final prev = sessions[sIndex - 1];
    final prevClips = prev['videoClips'] as List? ?? [];
    for (int i = 0; i < prevClips.length; i++) {
      if (!_isAnswered(prev, i)) return true;
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
          _progressRecords.add(Map<String, dynamic>.from(p));
          final key = '${p['sessionId']}|${p['clipId']}';
          if (p['quizPassed'] == true) _passedQuizzes.add(key);
          if (p['isWatched'] == true) _unlockedQuizzes.add(key);
        }
      });
    } catch (e) {
      debugPrint('Load quiz progress error: $e');
    }
    _progressLoaded = true;
    if (mounted) _applyLastSeen();
  }

  void _onVideoEnded() {
    if (_isMiniQuizShowing) return;
    // The quiz can be taken only once; after that it is review-only on demand
    final session = _activeSession;
    if (session != null && _isAnswered(session, _currentClipIndex)) return;
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
      currentBottomNavIndex: AppTabs.academy,
      onBackTap: () => Navigator.of(context).pop(),
      body: _isLoadingClasses
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.buttonCamel),
            )
          : Column(
              children: [
              Expanded(
              child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Station number and title above the video
                  if (_stationTitle.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Directionality(
                        textDirection: TextDirection.rtl,
                        child: Text(
                          'منزلگاه ${_toFarsiDigit(_stationNumber)}',
                          textAlign: TextAlign.right,
                          style: AppTypography.h3.copyWith(color: Color(0xFFEDE8F5)),
                        ),
                      ),
                    ),
                  // Video Player Box (مثل صفحه کلاس1 قسمت انیمیشن باید ببینید)
                  _buildVideoPlayerCard(),
                  const SizedBox(height: 8),

                  // Active Playing Part Title
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      _currentPlayingTitle,
                      style: AppTypography.caption.copyWith(color: Color(0xFFDDD9EE)),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Navigation Tabs Row: one tab per class category (as defined in the admin panel) | مشخصات جلسه
                  _buildTabsRow(),
                  const SizedBox(height: 12),

                  // Tab Body Content (باکس‌های جلسات و پارت‌ها منطبق بر رفرنس عکس)
                  if (_detailsTabSelected)
                    _buildSessionDetailsTab()
                  else
                    _buildSessionsAccordion(),

                  const SizedBox(height: 14),
                ],
              ),
            ),
              ),
              // Fixed at the bottom: does not move when the number of lessons changes
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 16, 16),
                child: _buildBottomActionBar(),
              ),
              ],
            ),
    );
  }

  /// 2. Video Player Card (دقیقاً مشابه باکس پخش ویدیو در کلاس1 برای انیمیشن باید ببینید)
  Widget _buildVideoPlayerCard() {
    final url = _currentVideoUrl;
    return NopaInlineVideoPlayer(
      key: ValueKey('class2_video_${_videoSessionToken}_$url'),
      videoUrl: url,
      coverImageUrl: _currentCoverUrl,
      title: _currentPlayingTitle,
      autoPlay: url.isNotEmpty && _playRequested,
      onProgress: _onVideoProgress,
      onEnded: _onVideoEnded,
      nextPartCountdown: _nextPartCountdown,
    );
  }

  /// 3. Tabs Row: the station's class categories (same number, names and order as the admin panel) | مشخصات جلسه
  Widget _buildTabsRow() {
    final tabs = <Widget>[
      for (final cat in _categories)
        _buildTabItem(
          title: cat.shortTitle,
          isSelected: !_detailsTabSelected && _selectedTab == cat.index,
          onTap: () => _selectCategoryTab(cat.index),
          expanded: _categories.length <= 3,
        ),
      _buildTabItem(
        title: 'مشخصات جلسه',
        isSelected: _detailsTabSelected,
        onTap: _selectDetailsTab,
        expanded: _categories.length <= 3,
      ),
    ];
    return Column(
      children: [
        Directionality(
          textDirection: TextDirection.rtl,
          // Up to three categories share the width; more scroll sideways
          child: _categories.length <= 3
              ? Row(children: tabs)
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: tabs),
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

  void _selectCategoryTab(int index) {
    setState(() {
      _selectedTab = index;
      _detailsTabSelected = false;
      _currentClipIndex = 0;
      _playRequested = false;
    });
    _initializeVideoForCurrentSession();
  }

  void _selectDetailsTab() {
    setState(() {
      _detailsTabSelected = true;
      _currentClipIndex = 0;
      _playRequested = false;
    });
  }

  Widget _buildTabItem({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
    required bool expanded,
  }) {
    final child = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: EdgeInsets.symmetric(horizontal: expanded ? 4 : 12, vertical: 12),
        child: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
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
    return expanded ? Expanded(child: child) : child;
  }

  String _formatDuration(dynamic duration) {
    if (duration == null) return '';
    if (duration is num) {
      final int totalSec = duration.toInt();
      if (totalSec <= 0) return '';
      final int minutes = totalSec ~/ 60;
      final int seconds = totalSec % 60;
      final String minStr = minutes.toString().padLeft(2, '0').toPersianDigits();
      final String secStr = seconds.toString().padLeft(2, '0').toPersianDigits();
      return '$minStr:$secStr';
    }
    final String str = duration.toString().trim();
    if (str.isEmpty) return '';
    return str.toPersianDigits();
  }

  /// 4. Sessions Accordion List (رنگ و استروک شبیه به باکس های منزلگاه در صفحه هوم + ریسپانسیو)
  Widget _buildSessionsAccordion() {
    final sessions = _currentSessions;
    if (sessions.isEmpty) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text(
            'فیلمی برای این بخش ثبت نشده است.',
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFF9D99B8)),
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
                TapExpander(child: InkWell(
                  onTap: () {
                    if (isLocked) {
                      final opensAt = _sessionOpensAt(session);
                      AppToast.info(
                        context,
                        opensAt != null
                            ? 'این جلسه ${ScheduleUtils.describe(opensAt)} باز می‌شود'
                            : 'برای باز شدن این درس، آزمون‌های درس قبل را بگذرانید',
                      );
                      return;
                    }
                    setState(() {
                      if (isExpanded) {
                        _expandedSessionIndex = -1;
                      } else {
                        _expandedSessionIndex = sIndex;
                        _currentClipIndex = 0;
                        _playRequested = false;
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
                            style: AppTypography.h3.copyWith(color: Color(0xFFF3EFFE)),
                          ),
                        ),
                      ],
                    ),
                  ),
                )),

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
                        final bool isPartLocked = _isPartLocked(session, cIndex);
                        void selectPart() {
                          if (isPartLocked) {
                            final opensAt = _clipUnlockTime(session, cIndex);
                            AppToast.info(
                              context,
                              opensAt != null
                                  ? 'این پارت ${ScheduleUtils.describe(opensAt)} باز می‌شود'
                                  : 'برای باز شدن این پارت، ابتدا به آزمون پارت قبل پاسخ دهید',
                            );
                            return;
                          }
                          setState(() {
                            _currentClipIndex = cIndex;
                            _playRequested = true;
                          });
                          _initializeVideoForCurrentSession();
                        }

                        final Widget partRow = Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5.5),
                          child: Directionality(
                            textDirection: TextDirection.rtl,
                            child: Row(
                              children: [
                                // 1. Far Right in RTL: وضعیت پارت (تایید برای دیده شده، پاز برای در حال دیدن، پلی برای دیده نشده)
                                TapExpander(child: GestureDetector(
                                  onTap: selectPart,
                                  child: isPartLocked
                                      ? Container(
                                          width: 20,
                                          height: 20,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: Colors.white.withValues(alpha: 0.05),
                                            border: Border.all(color: Colors.white.withValues(alpha: 0.2), width: 1.0),
                                          ),
                                          child: const Icon(Icons.lock_rounded, color: Colors.white38, size: 11),
                                        )
                                      : isPlaying
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
                                )),
                                const SizedBox(width: 8),

                                // 2. Right in RTL next to icon: عنوان پارت (کوتاه تر، کوچکتر و غیربولد)
                                Expanded(
                                  child: TapExpander(child: GestureDetector(
                                    onTap: selectPart,
                                    child: Text(
                                      clip['title']?.toString() ?? 'پارت ${_toFarsiDigit(cIndex + 1)}',
                                      textAlign: TextAlign.right,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.caption.copyWith(color: isPlaying ? AppColors.accentGoldEnd : const Color(0xFFDDD9EE)),
                                    ),
                                  )),
                                ),
                                const SizedBox(width: 8),

                                // 3. Left: مدت زمان پارت (15:00)
                                Text(
                                  _formatDuration(clip['duration']),
                                  style: AppTypography.caption.copyWith(color: Color(0xFF9D99B8)),
                                ),
                                const SizedBox(width: 8),

                                // 4. Far Left in RTL: دکمه آزمون
                                TapExpander(child: GestureDetector(
                                  onTap: () {
                                    if (isQuizUnlocked) {
                                      _showPartMiniQuiz(cIndex);
                                    } else {
                                      AppToast.info(context, 'برای باز شدن آزمون، حداقل ۹۰٪ ویدیو را مشاهده کنید');
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1B192A),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isQuizUnlocked
                                            ? AppColors.buttonCamel
                                            : const Color(0xFF6C6C63).withValues(alpha: 0.35),
                                        width: 0.85,
                                      ),
                                    ),
                                    child: Text(
                                      'آزمون',
                                      style: AppTypography.caption.copyWith(color: isQuizUnlocked
                                            ? AppColors.accentGoldEnd
                                            : const Color(0xFF8E889D).withValues(alpha: 0.5)),
                                    ),
                                  ),
                                )),
                              ],
                            ),
                          ),
                        );
                        if (cIndex == 0) return partRow;
                        return Column(
                          children: [
                            Container(
                              height: 1,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.white.withValues(alpha: 0.0),
                                    Colors.white.withValues(alpha: 0.12),
                                    Colors.white.withValues(alpha: 0.0),
                                  ],
                                ),
                              ),
                            ),
                            partRow,
                          ],
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
    final String handoutUrl = session['handoutUrl']?.toString().trim() ?? '';
    final String handoutTitle = session['handoutTitle']?.toString().trim() ?? '';

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
                Text(
                  'اطلاعات جلسه',
                  style: AppTypography.h3.copyWith(color: Color(0xFFE5B888)),
                ),
                const SizedBox(height: 6),
                Text(
                  sessionDesc.isNotEmpty
                      ? sessionDesc
                      : 'توضیحات و سرفصل‌های آموزشی این جلسه در کاروان نپا.',
                  style: AppTypography.caption.copyWith(color: Color(0xFFD3D0E3)),
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
                          style: AppTypography.h3.copyWith(color: Color(0xFFFBE4C8)),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _currentCategory?.title ?? 'استاد راهنمای جلسات کاروان',
                          style: AppTypography.caption.copyWith(color: Color(0xFF9D99B8)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 12),

          // 3. جزوه جلسه (فقط وقتی در پنل ادمین فایلی برای جلسه ثبت شده باشد)
          if (handoutUrl.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF241F3B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFC09268).withValues(alpha: 0.6)),
              ),
              child: ListTile(
                leading: const Icon(Icons.download_rounded, color: Color(0xFFE5B888), size: 20),
                title: Text(
                  handoutTitle.isNotEmpty ? handoutTitle : 'دانلود جزوه و درسنامه آموزشی',
                  style: const TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                trailing: const Icon(Icons.chevron_left_rounded, color: Color(0xFF9D99B8), size: 18),
                onTap: () => _openHandout(handoutUrl),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 6. Bottom Action Bar (منزلگاه قبل در راست و منزلگاه بعد در چپ)
  Widget _buildBottomActionBar() {
    const gold = AppColors.buttonCamel;
    final canNext = _stationCount == 0 || _currentStationIndex < _stationCount - 1;
    final canPrev = _currentStationIndex > 0;
    final dim = gold.withValues(alpha: 0.35);
    const textStyleBase = TextStyle(
      fontSize: 9.5,
      fontFamily: AppTheme.fontFamily,
      fontFamilyFallback: AppTheme.fontFamilyFallback,
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left: next station
        TapExpander(child: InkWell(
          onTap: canNext ? () => _goToStation(1) : null,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chevron_left_rounded, color: canNext ? gold : dim, size: 18),
              Text('منزلگاه بعد', style: textStyleBase.copyWith(color: canNext ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94))),
            ],
          ),
        )),

        // Middle: contact mentor (same look as the part quiz button)
        TapExpander(child: GestureDetector(
          onTap: () => contactMentor(
            context,
            Provider.of<AppRepository>(context, listen: false).currentUser,
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF1B192A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: gold, width: 0.85),
            ),
            child: Text(
              contactMentorLabel(Provider.of<AppRepository>(context, listen: false).currentUser),
              style: AppTypography.caption.copyWith(color: AppColors.accentGoldEnd),
            ),
          ),
        )),

        // Right: previous station
        TapExpander(child: InkWell(
          onTap: canPrev ? () => _goToStation(-1) : null,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('منزلگاه قبل', style: textStyleBase.copyWith(color: canPrev ? const Color(0xFFDDD9EE) : const Color(0xFF6B5F94))),
              Icon(Icons.chevron_right_rounded, color: canPrev ? gold : dim, size: 18),
            ],
          ),
        )),
      ],
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
    // One attempt only: once answered, the quiz can just be viewed.
    final bool reviewMode = session != null && _isAnswered(session, partIndex);
    final stored = session == null ? null : _quizAnswers[_passedKey(session, partIndex)];
    final List<int> userAnswers = (reviewMode && stored != null && stored.length == quizQuestions.length)
        ? List<int>.from(stored)
        : List.filled(quizQuestions.length, -1);
    String? feedbackMessage;
    bool isErrorFeedback = false;
    // After submitting, the dialog stays open and marks the right / wrong options
    bool submitted = false;
    // True only when this dialog itself submitted the answers (not when an old quiz is just reviewed)
    bool newlySubmitted = false;
    List<int>? revealCorrect;

    int correctIndexOf(dynamic q) =>
        q['correctIndex'] is int ? q['correctIndex'] : int.tryParse(q['correctIndex']?.toString() ?? '') ?? 0;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final question = quizQuestions[currentQuestionIndex];
            final selectedAns = userAnswers[currentQuestionIndex];
            final bool showAnswers = reviewMode || submitted;
            final int correctNow = (revealCorrect != null && currentQuestionIndex < revealCorrect!.length)
                ? revealCorrect![currentQuestionIndex]
                : correctIndexOf(question);

            // In landscape (e.g. the quiz opens over a fullscreen video) the screen is short and wide:
            // keep the box compact and let it scroll instead of stretching it past the screen height
            final bool landscape = MediaQuery.of(context).orientation == Orientation.landscape;
            return Dialog(
              backgroundColor: Colors.transparent,
              elevation: 0,
              insetPadding: landscape
                  ? const EdgeInsets.symmetric(horizontal: 40, vertical: 12)
                  : const EdgeInsets.symmetric(horizontal: 40, vertical: 24),
              child: NopaDialogContainer(
                constraints: BoxConstraints(maxWidth: landscape ? 460 : 560),
                radius: 24,
                padding: EdgeInsets.all(landscape ? 14 : 20),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'آزمون ${_toFarsiDigit(partIndex + 1)}ام از پارت ${_toFarsiDigit(partIndex + 1)}ام',
                            style: AppTypography.h3Strong.copyWith(color: Color(0xFFFBE4C8)),
                          ),
                          Text(
                            'سوال ${_toFarsiDigit(currentQuestionIndex + 1)} از ${_toFarsiDigit(quizQuestions.length)}',
                            style: AppTypography.caption.copyWith(color: Color(0xFF9D99B8)),
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
                              style: AppTypography.bodyLarge,
                            ),
                            const SizedBox(height: 12),
                            ...List.generate((question['options'] as List).length, (idx) {
                              bool isSel = selectedAns == idx;
                              final bool isCorrectOpt = showAnswers && idx == correctNow;
                              final bool isWrongSel = showAnswers && isSel && !isCorrectOpt;
                              final Color accent = isCorrectOpt
                                  ? AppToast.successColor
                                  : (isWrongSel ? AppToast.errorColor : AppColors.buttonCamel);
                              return TapExpander(child: GestureDetector(
                                onTap: showAnswers
                                    ? null
                                    : () => setDialogState(() {
                                          userAnswers[currentQuestionIndex] = idx;
                                          feedbackMessage = null;
                                        }),
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                  decoration: BoxDecoration(
                                    color: (isCorrectOpt || isWrongSel)
                                        ? accent.withValues(alpha: 0.45)
                                        : (isSel ? const Color(0xFF473E67) : const Color(0xFF1E1A33)),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: (isCorrectOpt || isWrongSel || isSel) ? accent : const Color(0xFF473E67),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        isCorrectOpt
                                            ? Icons.check_circle_rounded
                                            : (isSel ? Icons.radio_button_checked : Icons.radio_button_off),
                                        color: isSel || isCorrectOpt ? const Color(0xFFE5B888) : const Color(0xFF9D99B8),
                                        size: 16,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          question['options'][idx]?.toString() ?? '',
                                          style: AppTypography.caption.copyWith(color: isSel ? const Color(0xFFFBE4C8) : const Color(0xFFDDD9EE)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ));
                            }),
                          ],
                        ),
                      ),
                      if (feedbackMessage != null) ...[
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                          child: Text(
                            feedbackMessage!,
                            style: AppTypography.caption.copyWith(color: isErrorFeedback ? const Color(0xFFFF8A80) : const Color(0xFF6EE7B7)),
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
                                    if (!submitted) feedbackMessage = null;
                                  });
                                },
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF6B68A8)),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: Text(
                                  'قبلی',
                                  style: AppTypography.caption.copyWith(color: Color(0xFFDDD9EE)),
                                ),
                              ),
                            ),
                          if (showAnswers && currentQuestionIndex == quizQuestions.length - 1)
                            Expanded(
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: Text(
                                    'بستن',
                                    style: AppTypography.h3Strong.copyWith(color: AppColors.buttonCancelPurple),
                                  ),
                                ),
                              ),
                            )
                          else
                          Expanded(
                            child: ElevatedButton(
                              onPressed: (!showAnswers && selectedAns == -1)
                                  ? null
                                  : () async {
                                      if (currentQuestionIndex < quizQuestions.length - 1) {
                                        setDialogState(() {
                                          currentQuestionIndex++;
                                          if (!submitted) feedbackMessage = null;
                                        });
                                        return;
                                      }
                                      if (reviewMode || submitted) {
                                        Navigator.pop(context);
                                        return;
                                      }

                                      // Score locally for the feedback (the server decides pass/fail).
                                      int correctCount = 0;
                                      for (int i = 0; i < quizQuestions.length; i++) {
                                        if (userAnswers[i] == correctIndexOf(quizQuestions[i])) correctCount++;
                                      }

                                      final sessionId = session?['id']?.toString() ?? '';
                                      int rewardZarik = 0;
                                      bool passed;
                                      bool awaitingReview = false;
                                      List<int>? serverCorrect;
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
                                        final int? total = (result['total'] as num?)?.toInt();
                                        final int? score = (result['score'] as num?)?.toInt();
                                        awaitingReview = result['status']?.toString().toUpperCase() == 'PENDING';
                                        // Every answer right is a pass, whatever the pass mark says
                                        passed = result['passed'] == true || (!awaitingReview && total != null && total > 0 && score == total);
                                        if (result['correctAnswers'] is List) {
                                          serverCorrect = (result['correctAnswers'] as List).map((e) => (e as num).toInt()).toList();
                                        }
                                        if (result['rewardZarik'] is num) rewardZarik = (result['rewardZarik'] as num).toInt();
                                      } else {
                                        passed = correctCount == quizQuestions.length ||
                                            (quizQuestions.length > 1 && correctCount >= (quizQuestions.length * 0.6).ceil());
                                      }

                                      // Right or wrong, the submitted answer opens the next part.
                                      _markAnswered(session, partIndex, userAnswers);
                                      if (passed && session != null && mounted) {
                                        setState(() {
                                          _passedQuizzes.add(_passedKey(session, partIndex));
                                        });
                                      }

                                      // Stay in the dialog: mark right / wrong and show the feedback here
                                      if (!context.mounted) return;
                                      setDialogState(() {
                                        submitted = true;
                                        newlySubmitted = true;
                                        revealCorrect = serverCorrect;
                                        currentQuestionIndex = 0;
                                        if (awaitingReview) {
                                          isErrorFeedback = false;
                                          feedbackMessage = 'پاسخ شما ثبت شد و در انتظار بررسی راهبر است.';
                                        } else if (passed) {
                                          isErrorFeedback = false;
                                          feedbackMessage = rewardZarik > 0
                                              ? 'پاسخ شما درست بود آفرین\n${_toFarsiDigit(rewardZarik)} زریک دریافت کردید.'
                                              : 'پاسخ شما درست بود آفرین';
                                        } else {
                                          isErrorFeedback = true;
                                          feedbackMessage = 'آوووو اشکالی نداره بیشتر دقت کنید';
                                        }
                                      });
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.buttonCamel,
                                foregroundColor: const Color(0xFF1E1A33),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: Text(
                                currentQuestionIndex < quizQuestions.length - 1
                                    ? 'سوال بعدی'
                                    : (showAnswers ? 'بستن' : 'ثبت و مشاهده نتیجه'),
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
              ),
            );
          },
        );
      },
    ).then((_) {
      // Let the next video end (e.g. after a re-watch) open the quiz again
      if (mounted) setState(() => _isMiniQuizShowing = false);
      if (mounted && newlySubmitted && session != null) _startNextPartCountdown(session, partIndex);
    });
  }

  Future<void> _openHandout(String url) async {
    final ok = await launchUrl(Uri.parse(ApiConstants.resolveImageUrl(url)), mode: LaunchMode.externalApplication)
        .catchError((_) => false);
    if (!ok && mounted) AppToast.info(context, 'باز کردن جزوه ممکن نشد.');
  }
}


typedef Class2Screen = StudentClass2Screen;
