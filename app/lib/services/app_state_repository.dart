import 'package:nopa_app/core/asset_names.dart';
import 'package:nopa_app/core/app_images.dart';
import '../core/challenge_taxonomy.dart';
import '../core/economy_rates.dart';
import 'chat_repository.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'api_service.dart';
import 'auth_service.dart';
import 'local_cache.dart';


class AppRepository extends ChangeNotifier with WidgetsBindingObserver {
  // Config Toggle
  final HttpApiService _apiService = HttpApiService();
  HttpApiService get apiService => _apiService;
  Timer? _notificationPollTimer;

  // Singleton Pattern
  static final AppRepository _instance = AppRepository._internal();
  factory AppRepository() => _instance;
  AppRepository._internal() {
    _lastActiveTimestamp = DateTime.now();
    HttpApiService.onActivity = recordActivity;
    _initializeMockData();
    WidgetsBinding.instance.addObserver(this);
    
    // Defer network operations, user refresh and timers until after the initial UI frame renders
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startPeriodicNotificationSync();
      refreshUser().catchError((e) {
        debugPrint('Startup refreshUser error: $e');
      });
    });
  }

  static VoidCallback? onSessionTimeout;
  static const int inactivityTimeoutMinutes = 60 * 24 * 30; // 30-day persistent session
  static const String prefKeyLastActive = 'last_app_exit_timestamp';
  DateTime? _lastActiveTimestamp;
  DateTime? get lastActiveTimestamp => _lastActiveTimestamp;
  DateTime? _lastDiskPersistTimestamp;
  int _activeMediaPlayingCount = 0;

  bool get isMediaPlaying => _activeMediaPlayingCount > 0;

  void setMediaPlaying(bool playing) {
    if (playing) {
      _activeMediaPlayingCount++;
      recordActivity();
    } else {
      if (_activeMediaPlayingCount > 0) {
        _activeMediaPlayingCount--;
      }
    }
    _noteAreaChange();
  }

  void recordActivity() {
    final now = DateTime.now();
    _lastActiveTimestamp = now;
    // Throttle disk writes to SharedPreferences (at most once every 60s) to prevent UI lag on gestures
    if (_lastDiskPersistTimestamp == null || now.difference(_lastDiskPersistTimestamp!) > const Duration(seconds: 60)) {
      _lastDiskPersistTimestamp = now;
      SharedPreferences.getInstance().then((prefs) {
        prefs.setInt(prefKeyLastActive, now.millisecondsSinceEpoch);
      }).catchError((_) {});
    }
  }

  Future<void> checkInactivityTimeout() async {
    // Session is persisted for 30 days; do not randomly kick the user out while active
    recordActivity();
  }

  /// Live-sync interval: profile, challenges and notifications are re-requested this often while the app is open.
  static const Duration pollInterval = Duration(seconds: 3);
  /// While the chat socket is live, polling runs on every 10th tick (about 30 seconds).
  static const int slowPollEvery = 10;
  int _socketTicks = 0;
  bool _pollInFlight = false;
  bool _appInForeground = true;

  // Foreground time not yet reported to the server (shown to mentors as the member's time in the app).
  int _usagePendingSeconds = 0;
  // Times the app was opened (or brought back after [_reopenAfter] in the background) not yet reported:
  // the panel charts "تعداد ورود به اپ" from them.
  int _usagePendingOpens = 0;
  // Parts of the pending seconds spent in the chat and with a video playing (the panel shows time in the chat,
  // in videos and in the rest of the app separately).
  int _usagePendingChat = 0;
  int _usagePendingVideo = 0;
  bool _usageFlushing = false;
  DateTime? _backgroundSince;
  static const Duration _reopenAfter = Duration(minutes: 1);
  /// The foreground time is reported this often; it is also the heartbeat behind «online now» in the panel.
  static const int _heartbeatSeconds = 15;

  /// Set by the shells: the chat tab is the one on screen.
  bool chatTabVisible = false;
  int _chatScreensOpen = 0;
  /// A chat conversation screen opened / closed (it can be pushed over any tab).
  void chatScreenOpened() { _chatScreensOpen++; _noteAreaChange(); }
  void chatScreenClosed() { if (_chatScreensOpen > 0) _chatScreensOpen--; _noteAreaChange(); }

  // ---- the part of the app on screen (the panel's «آمار» and the person's activity log) ----
  // Parts: home | academy | station | challenges | market | profile | chat | other. The shell sets the part of the
  // bottom tab on screen; screens pushed over it (the station pages) push their own part while they are open.
  String _tabArea = 'home';
  final List<_AreaEntry> _areaStack = [];
  // seconds per part not yet reported, and the parts entered since the last report (the activity log)
  final Map<String, int> _usagePendingAreas = {};
  final List<Map<String, dynamic>> _pendingAreaEvents = [];
  String _lastLoggedArea = '';

  /// The part of the app on screen now.
  String get currentArea {
    if (_chatScreensOpen > 0) return 'chat';
    if (_areaStack.isNotEmpty) return _areaStack.last.area;
    if (chatTabVisible) return 'chat';
    return _tabArea;
  }

  String get _currentAreaLabel => _chatScreensOpen == 0 && _areaStack.isNotEmpty ? _areaStack.last.label : '';
  String get _currentAreaRef => _chatScreensOpen == 0 && _areaStack.isNotEmpty ? _areaStack.last.refId : '';

  /// The shell: the bottom tab on screen changed.
  void setTabArea(String area) {
    if (_tabArea == area) return;
    _tabArea = area;
    scheduleMicrotask(_noteAreaChange);
  }

  /// A screen of a part of the app opened over the tabs (e.g. a station page); returns the token for
  /// [updateArea] / [popArea]. [label] names it in the activity log ("منزلگاه ۳").
  Object pushArea(String area, {String label = '', String refId = ''}) {
    final e = _AreaEntry(area, label, refId);
    _areaStack.add(e);
    scheduleMicrotask(_noteAreaChange);
    return e;
  }

  /// The screen of [token] now shows something else (e.g. the next station).
  void updateArea(Object token, {required String label, String refId = ''}) {
    if (token is! _AreaEntry || (token.label == label && token.refId == refId)) return;
    token.label = label;
    token.refId = refId;
    scheduleMicrotask(_noteAreaChange);
  }

  void popArea(Object? token) {
    if (token == null) return;
    _areaStack.remove(token);
    scheduleMicrotask(_noteAreaChange);
  }

  String get _usageArea => currentArea;
  String? _lastReportedArea;

  void _noteAreaChange() {
    if (!_appInForeground || !_apiService.isAuthenticated) return;
    // one row in the activity log for each part of the app entered
    final logKey = '$currentArea|$_currentAreaLabel|$_currentAreaRef';
    if (logKey != _lastLoggedArea) {
      _lastLoggedArea = logKey;
      _pendingAreaEvents.add({
        'type': 'enter',
        'area': currentArea,
        if (_currentAreaLabel.isNotEmpty) 'label': _currentAreaLabel,
        if (_currentAreaRef.isNotEmpty) 'refId': _currentAreaRef,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      if (_pendingAreaEvents.length > 40) _pendingAreaEvents.removeRange(0, _pendingAreaEvents.length - 40);
    }
    if ('$_usageArea|$isMediaPlaying' != _lastReportedArea || _pendingAreaEvents.isNotEmpty) _flushUsage(force: true);
  }

  /// Sends the gathered time. [force] sends even without new seconds (a heartbeat / a change of area); [away] tells
  /// the server the app went to the background.
  Future<void> _flushUsage({bool force = false, bool away = false}) async {
    if (_usageFlushing || !_apiService.isAuthenticated) return;
    if (!force && !away && _usagePendingSeconds < 5 && _usagePendingOpens == 0) return;
    _usageFlushing = true;
    final sending = _usagePendingSeconds < 5 && !away ? 0 : _usagePendingSeconds;
    final chat = sending == 0 ? 0 : _usagePendingChat.clamp(0, sending);
    final video = sending == 0 ? 0 : _usagePendingVideo.clamp(0, sending);
    final opens = _usagePendingOpens;
    final area = away ? 'away' : _usageArea;
    final playing = !away && isMediaPlaying;
    final areas = sending == 0 ? <String, int>{} : Map<String, int>.from(_usagePendingAreas);
    final events = List<Map<String, dynamic>>.from(_pendingAreaEvents);
    try {
      if (await _apiService.pingAppUsage(sending, opens: opens, chatSeconds: chat, videoSeconds: video, area: area,
          playing: playing, areas: areas, events: events)) {
        _usagePendingSeconds -= sending;
        _usagePendingChat = (_usagePendingChat - chat).clamp(0, 1 << 30);
        _usagePendingVideo = (_usagePendingVideo - video).clamp(0, 1 << 30);
        _usagePendingOpens -= opens;
        areas.forEach((k, v) {
          final left = (_usagePendingAreas[k] ?? 0) - v;
          if (left > 0) {
            _usagePendingAreas[k] = left;
          } else {
            _usagePendingAreas.remove(k);
          }
        });
        _pendingAreaEvents.removeRange(0, events.length.clamp(0, _pendingAreaEvents.length));
        _lastReportedArea = away ? 'away' : '$area|$playing';
      }
    } catch (_) {
    } finally {
      _usageFlushing = false;
    }
  }

  /// Counts one opening of the app and reports it right away (with the time gathered so far).
  void _noteAppOpened() {
    _usagePendingOpens++;
    _flushUsage();
  }

  void _startPeriodicNotificationSync() {
    // A new sync loop = the app was started or someone signed in: one opening
    if (_notificationPollTimer == null) _noteAppOpened();
    _notificationPollTimer?.cancel();
    var tick = 0;
    _notificationPollTimer = Timer.periodic(pollInterval, (_) async {
      if (_appInForeground && _apiService.isAuthenticated) {
        final step = pollInterval.inSeconds;
        _usagePendingSeconds += step;
        final area = _usageArea;
        if (area == 'chat') _usagePendingChat += step;
        if (isMediaPlaying) _usagePendingVideo += step;
        _usagePendingAreas[area] = (_usagePendingAreas[area] ?? 0) + step;
        if (_usagePendingSeconds >= _heartbeatSeconds || '$area|$isMediaPlaying' != _lastReportedArea || _pendingAreaEvents.isNotEmpty) {
          _flushUsage(force: true);
        }
      }
      // One request round at a time (a slow network must not pile up requests) and none while in background.
      if (_pollInFlight || !_appInForeground || !_apiService.isAuthenticated) return;
      if (ChatRepository.instance.connected && ++_socketTicks % slowPollEvery != 0) return;
      _pollInFlight = true;
      try {
        await _pollOnce(heavy: ++tick % 10 == 0);
      } catch (e) {
        debugPrint('Periodic sync caught: $e');
      } finally {
        _pollInFlight = false;
      }
    });
  }

  /// One light refresh round. Only data that really changed notifies the UI. Stations, caravans and banners
  /// (rarely changing, heavier) are refreshed every 10th round (about every 30 seconds).
  Future<void> _pollOnce({required bool heavy}) async {
    final user = await _apiService.getMe();
    if (user != null && !_apiService.isUnchanged('me')) {
      _applyUser(user);
      notifyListeners();
    }
    if (currentUser.role.isChannelManager) {
      await fetchNotifications(onlyIfChanged: true);
      return;
    }
    await Future.wait([
      syncChallenges(onlyIfChanged: true),
      fetchNotifications(onlyIfChanged: true),
    ]);
    if (heavy) {
      _apiService.getStations().then((_) => notifyListeners()).catchError((e) => debugPrint('getStations error: $e'));
      fetchCaravanBanners().catchError((e) => debugPrint('fetchCaravanBanners error: $e'));
      fetchCaravans().catchError((e) => debugPrint('fetchCaravans error: $e'));
    }
  }

  /// Keeps the role the user switched to when the account has both roles.
  void _applyUser(UserModel user) {
    final existingRole = currentUser.role;
    if (user.isDualRole && (existingRole == UserRole.mentor || existingRole == UserRole.member)) {
      currentUser = user.copyWith(role: existingRole);
    } else {
      currentUser = user;
    }
    if (user.id.isNotEmpty) LocalCache.instance.scope = user.id;
  }

  /// Saves gender / avatar on the server; the app updates immediately on success.
  Future<bool> updateAvatar({required String avatarKey}) async {
    final res = await _apiService.updateMyAvatar(avatarKey: avatarKey);
    if (res == null) return false;
    currentUser = currentUser.copyWith(avatarUrl: res['avatarUrl']?.toString() ?? '');
    notifyListeners();
    return true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    try {
      _appInForeground = state == AppLifecycleState.resumed;
      ChatRepository.instance.setForeground(_appInForeground);
      if (state == AppLifecycleState.resumed) {
        final away = _backgroundSince;
        _backgroundSince = null;
        if (away != null && DateTime.now().difference(away) >= _reopenAfter && _apiService.isAuthenticated) _noteAppOpened();
        recordActivity();
        if (_apiService.isAuthenticated) {
          fetchNotifications().catchError((e) {
            debugPrint('Resumed fetchNotifications error: $e');
          });
          refreshUser().catchError((e) {
            debugPrint('Resumed refreshUser error: $e');
          });
        }
      } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.detached) {
        if (state != AppLifecycleState.inactive) _backgroundSince ??= DateTime.now();
        recordActivity();
        // in the background: send the time gathered so far and leave «online now»
        _flushUsage(away: state != AppLifecycleState.inactive);
      }
    } catch (e) {
      debugPrint('Lifecycle state change caught: $e');
    }
  }




  bool _assetNamesLoaded = false;

  /// Admin-editable asset names (once per session) – the app keeps its built-in defaults when this fails.
  Future<void> loadAssetNames() async {
    final rates = await _apiService.getEconomyRates();
    if (rates != null) EconomyRates.apply(rates);
    if (_assetNamesLoaded) return;
    // The pictures set in the panel (asset images) come with the names
    final images = await _apiService.getAppImages();
    if (images != null) AppImages.apply(images);
    // The challenge categories' names come with the asset names: both are admin-editable labels
    final taxonomy = await _apiService.getChallengeTaxonomy();
    if (taxonomy.isNotEmpty) ChallengeTaxonomy.apply(taxonomy);
    final rows = await _apiService.getAssetTypes();
    if (rows.isEmpty) return;
    AssetNames.apply(rows);
    _assetNamesLoaded = true;
    notifyListeners();
  }

  /// Banners (درفش) won by the caravan: shown as one total on the home screens, itemised in a dialog.
  int caravanBannerTotal = 0;
  Map<String, dynamic> caravanBanners = {};

  Future<void> fetchCaravanBanners() async {
    final isMentor = currentUser.role.isMentorLike;
    final data = await _apiService.getCaravanBanners(caravanId: isMentor ? _selectedCaravanId : null);
    if (data != null) {
      caravanBanners = data;
      caravanBannerTotal = (data['total'] as num?)?.toInt() ?? 0;
      notifyListeners();
    }
  }

  Future<void> refreshUser() async {
    final user = await _apiService.getMe();
    if (user != null) {
      loadAssetNames().catchError((e) => debugPrint('loadAssetNames error: $e'));
      _apiService.getStations().then((_) => notifyListeners()).catchError((e) => debugPrint('getStations error: $e'));
      fetchCaravanBanners().catchError((e) => debugPrint('fetchCaravanBanners error: $e'));
      _applyUser(user);
      final apiChallenges = await _apiService.getChallenges();
      if (apiChallenges != null) {
        challenges.clear();
        challenges.addAll(apiChallenges);
      }
      await fetchNotifications();
      await fetchCaravans();
      notifyListeners();
      await _syncOfflineData();
    }
  }

  Future<void> _syncOfflineData() async {
    final prefs = await SharedPreferences.getInstance();

    final offlineSubmissions = prefs.getStringList('offline_submissions') ?? [];
    if (offlineSubmissions.isNotEmpty) {
      final List<String> remainingSubmissions = [];
      for (final raw in offlineSubmissions) {
        try {
          final data = jsonDecode(raw) as Map<String, dynamic>;
          // Another account's queued answer stays queued until that account is signed in again
          if (data['userId'] != null && data['userId'] != currentUser.id) {
            remainingSubmissions.add(raw);
            continue;
          }
          final challengeId = data['challengeId']?.toString();
          final answerText = data['answerText']?.toString() ?? '';
          final fileUrl = data['fileUrl']?.toString();

          if (challengeId != null && challengeId.isNotEmpty) {
            final ok = await _apiService.submitTask(challengeId, answerText, fileUrl: fileUrl);
            if (!ok) {
              remainingSubmissions.add(raw);
            }
          }
        } catch (e) {
          debugPrint('[SyncOffline] submission error: $e');
          remainingSubmissions.add(raw);
        }
      }
      await prefs.setStringList('offline_submissions', remainingSubmissions);
      debugPrint(
        '[SyncOffline] Submissions sync finished: '
        '${offlineSubmissions.length - remainingSubmissions.length} sent, '
        '${remainingSubmissions.length} remaining.',
      );
    }

    final offlineWatchProgress = prefs.getStringList('offline_watch_progress') ?? [];
    if (offlineWatchProgress.isNotEmpty) {
      final List<String> remainingWatch = [];
      for (final raw in offlineWatchProgress) {
        try {
          final data = jsonDecode(raw) as Map<String, dynamic>;
          if (data['userId'] != null && data['userId'] != currentUser.id) {
            remainingWatch.add(raw);
            continue;
          }
          final sessionId = data['sessionId']?.toString();
          final percentage = (data['percentage'] as num?)?.toDouble() ?? 0.0;
          final currentPos = (data['currentPositionSeconds'] as num?)?.toInt() ?? (percentage * 10).toInt();
          final duration = (data['durationSeconds'] as num?)?.toInt() ?? 1000;

          if (sessionId != null && sessionId.isNotEmpty) {
            final res = await _apiService.heartbeatSessionWatch(sessionId, currentPos, duration);
            if (res == null) {
              remainingWatch.add(raw);
            }
          }
        } catch (e) {
          debugPrint('[SyncOffline] watch-progress error: $e');
          remainingWatch.add(raw);
        }
      }
      await prefs.setStringList('offline_watch_progress', remainingWatch);
      debugPrint(
        '[SyncOffline] Watch-progress sync finished: '
        '${offlineWatchProgress.length - remainingWatch.length} sent, '
        '${remainingWatch.length} remaining.',
      );
    }
  }

  Future<void> cacheSubmissionOffline(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final submissions = prefs.getStringList('offline_submissions') ?? [];
    submissions.add(jsonEncode({...data, 'userId': currentUser.id}));
    await prefs.setStringList('offline_submissions', submissions);
  }
  
  Future<void> cacheWatchProgressOffline(String sessionId, double percentage, {int? currentPositionSeconds, int? durationSeconds}) async {
    final prefs = await SharedPreferences.getInstance();
    final progressList = prefs.getStringList('offline_watch_progress') ?? [];
    final map = <String, dynamic>{
      'sessionId': sessionId,
      'percentage': percentage,
    };
    if (currentPositionSeconds != null) {
      map['currentPositionSeconds'] = currentPositionSeconds;
    }
    if (durationSeconds != null) {
      map['durationSeconds'] = durationSeconds;
    }
    map['userId'] = currentUser.id;
    progressList.add(jsonEncode(map));
    await prefs.setStringList('offline_watch_progress', progressList);
  }

  void updateUser(UserModel user) {
    currentUser = user;
    notifyListeners();
  }

  void setActiveCaravan({required String name, required String id}) {
    _selectedCaravanId = id;
    currentUser = currentUser.copyWith(
      caravanName: name,
      caravanId: id,
    );
    notifyListeners();
  }

  void setSelectedCaravan(String id, String name) {
    setActiveCaravan(name: name, id: id);
  }

  String? get activeCaravanName => currentUser.caravanName;
  String? get activeCaravanId => currentUser.caravanId ?? _selectedCaravanId;

  Future<void> logout() async {
    ChatRepository.instance.reset();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(prefKeyLastActive);
      if (currentUser.phoneNumber.isNotEmpty) {
        await prefs.setString('saved_login_phone', currentUser.phoneNumber);
      }
    } catch (_) {}

    await _apiService.logout();
    await LocalCache.instance.clearScope();
    LocalCache.instance.scope = 'anon';
    _resetSessionData();
    currentUser = UserModel(
      id: 'guest',
      name: 'مهمان',
      phoneNumber: '',
      role: UserRole.member,
      zarik: 0,
      nakh: 0,
      beyragh: 0,
      farsh: 0,
    );
    notifyListeners();
  }

  void handleUnauthorized() {
    currentUser = UserModel(
      id: 'guest',
      name: 'مهمان',
      phoneNumber: '',
      role: UserRole.member,
      zarik: 0,
      nakh: 0,
      beyragh: 0,
      farsh: 0,
    );
    _resetSessionData();
    notifyListeners();
  }

  /// Everything loaded for the signed-in user (a singleton outlives the session, so it must be emptied explicitly).
  void _resetSessionData() {
    challenges.clear();
    submissions.clear();
    notifications.clear();
    caravans = [];
    mentorData.clear();
    caravanBanners = {};
    caravanBannerTotal = 0;
    _selectedCaravanId = '';
  }

  // Current Logged-in User
  UserModel currentUser = UserModel(
    id: 'loading',
    name: 'در حال بارگذاری...',
    phoneNumber: '',
    role: UserRole.member,
    zarik: 0,
    nakh: 0,
    beyragh: 0,
    farsh: 0,
  );

  // Active Caravan Selector
  String _selectedCaravanId = '';
  String get selectedCaravanId => _selectedCaravanId;
  String get selectedCaravanName {
    if (caravans.isEmpty) {
      return currentUser.caravanName ?? 'بدون کاروان';
    }
    final c = caravans.firstWhere((element) => element.id == _selectedCaravanId,
        orElse: () => caravans.first);
    return c.name;
  }

  // Reactive Collections
  List<CaravanModel> caravans = [];

  /// The caravan currently picked by the mentor (null until caravans are loaded).
  CaravanModel? get selectedCaravan {
    if (caravans.isEmpty) return null;
    return caravans.firstWhere((c) => c.id == _selectedCaravanId, orElse: () => caravans.first);
  }

  Future<void> fetchCaravans() async {
    try {
      final data = await _apiService.getCaravans();
      if (data.isNotEmpty) {
        final List<CaravanModel> loaded = [];
        for (final item in data) {
          final members = (item['members'] is List) ? (item['members'] as List) : ((item['membersList'] is List) ? item['membersList'] as List : []);
          final memberCount = (item['memberCount'] is int) ? (item['memberCount'] as int) : members.length;
          final overallProgress = (item['overallProgress'] is num) ? (item['overallProgress'] as num).toDouble() : 0.0;
          final activeStation = item['activeStation']?.toString() ?? 'منزلگاه اول';
          int sumOf(List<String> keys) => members.whereType<Map>().fold<int>(0, (sum, m) {
                for (final k in keys) {
                  if (m[k] is num) return sum + (m[k] as num).toInt();
                }
                return sum;
              });
          loaded.add(CaravanModel(
            id: item['id']?.toString() ?? '',
            name: item['name']?.toString() ?? 'کاروان',
            memberCount: memberCount,
            overallProgress: overallProgress,
            activeStation: activeStation,
            totalZarik: sumOf(['zarikBalance', 'zarik']),
            totalBeyragh: sumOf(['beyragh']),
            totalNakh: sumOf(['nakh']),
            totalFarsh: sumOf(['farsh']),
          ));
        }
        if (loaded.isNotEmpty) {
          caravans = loaded;
          if (!caravans.any((c) => c.id == _selectedCaravanId)) {
            _selectedCaravanId = caravans.first.id;
          }
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('fetchCaravans error: $e');
    }
  }
  final List<ChallengeModel> challenges = [];
  final List<SubmissionModel> submissions = [];
  final List<MentorRatingModel> mentorRatings = [];

  /// Number of challenges that the student has not yet completed and gotten approved
  int get uncompletedChallengesCount {
    if (currentUser.role != UserRole.member) return 0;
    int count = 0;
    for (final c in challenges) {
      final localSub = submissions.where((s) => s.challengeId == c.id).firstOrNull;
      final isApproved = (c.myStatus == 'approved') || (localSub != null && localSub.status == 'approved');
      if (!isApproved) {
        count++;
      }
    }
    return count;
  }

  /// Returns true if student has any pending/uncompleted challenges
  bool get hasPendingChallenges => uncompletedChallengesCount > 0;

  // Mentor Satisfaction Data Cache
  final Map<String, Map<String, dynamic>> mentorData = {};

  // Notifications collections
  final List<Map<String, dynamic>> notifications = [];

  Future<void> fetchNotifications({bool onlyIfChanged = false}) async {
    try {
      final data = await _apiService.getNotifications();
      if (onlyIfChanged && _apiService.isUnchanged('notifications')) return;
      if (data != null && data['notifications'] is List) {
        final List notifs = data['notifications'];
        final isMentor = currentUser.role.isMentorLike;
        final List<Map<String, dynamic>> updatedNotifs = [];
        for (final item in notifs) {
          String timeStr = 'اعلان سیستم';
          if (item['createdAt'] != null) {
            final dt = DateTime.tryParse(item['createdAt'].toString());
            if (dt != null) {
              final diff = DateTime.now().difference(dt.toLocal());
              if (diff.inMinutes < 2) {
                timeStr = 'همین الان';
              } else if (diff.inMinutes < 60) {
                timeStr = '${diff.inMinutes} دقیقه پیش';
              } else if (diff.inHours < 24) {
                timeStr = '${diff.inHours} ساعت پیش';
              } else if (diff.inDays < 7) {
                timeStr = '${diff.inDays} روز پیش';
              } else {
                timeStr = '${dt.year}/${dt.month}/${dt.day}';
              }
            }
          }

          updatedNotifs.add({
            'id': item['id']?.toString() ?? '',
            'title': item['title'] ?? '',
            'body': item['message'] ?? '',
            'type': item['type'] ?? 'alert',
            'createdAt': item['createdAt'],
            'isForMentor': isMentor,
            'isRead': item['isRead'] == true,
            'time': timeStr,
          });
        }
        notifications.clear();
        notifications.addAll(updatedNotifs);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('fetchNotifications error: $e');
    }
  }

  int get unreadNotificationsCount {
    return notifications.where((n) => !n['isRead'] && n['isForMentor'] == (currentUser.role.isMentorLike)).length;
  }

  Future<void> markNotificationAsRead(String id) async {
    final idx = notifications.indexWhere((n) => n['id']?.toString() == id);
    if (idx != -1) {
      notifications[idx]['isRead'] = true;
      notifyListeners();
      if (id.isNotEmpty) {
        try {
          await _apiService.markNotificationAsRead(id);
        } catch (e) {
          debugPrint('markNotificationAsRead API error: $e');
        }
      }
    }
  }

  void markAllNotificationsAsRead() {
    for (var n in notifications) {
      if (n['isForMentor'] == (currentUser.role.isMentorLike)) {
        if (n['isRead'] == false && n['id'] != null && n['id'].toString().isNotEmpty) {
          _apiService.markNotificationAsRead(n['id'].toString());
        }
        n['isRead'] = true;
      }
    }
    notifyListeners();
  }

  void _initializeMockData() {
    // Empty intentionally to ensure live API data is used instead of fallback mocks
  }

  // --- ACTIONS & MUTATIONS ---

  void createChallenge(ChallengeModel challenge) {
    challenges.insert(0, challenge);
    notifyListeners();
  }

  /// Reloads the challenge list only (no notification fetch); a failed load keeps the current list.
  Future<void> syncChallenges({bool onlyIfChanged = false}) async {
    final apiChallenges = await _apiService.getChallenges();
    if (apiChallenges == null) return;
    if (onlyIfChanged && _apiService.isUnchanged('challenges')) return;
    challenges.clear();
    challenges.addAll(apiChallenges);
    submissions.removeWhere((s) => challenges.any((c) => c.id == s.challengeId && c.myStatus != null && c.myStatus != 'none'));
    notifyListeners();
  }

  Future<void> refreshChallenges() async {
    final apiChallenges = await _apiService.getChallenges();
    // A failed load keeps the current list: challenges must never vanish on a network error
    if (apiChallenges != null) {
      challenges.clear();
      challenges.addAll(apiChallenges);
      // The server is the source of truth for the answers; drop optimistic local copies
      submissions.removeWhere((s) => challenges.any((c) => c.id == s.challengeId && c.myStatus != null && c.myStatus != 'none'));
    }
    await fetchNotifications();
    notifyListeners();
  }

  /// One status for a challenge, shared by the challenges page and the home card:
  /// 'new' (not answered), 'pending' (waiting for the mentor), 'rejected' (needs correction),
  /// 'completed' (approved) or 'expired' (deadline passed without an answer).
  String challengeStatus(ChallengeModel c) {
    final localSub = submissions.where((s) => s.challengeId == c.id).firstOrNull;
    String raw = 'none';
    if (c.myStatus != null && c.myStatus != 'none') {
      raw = c.myStatus!;
    } else if (localSub != null) {
      raw = localSub.status;
    }
    switch (raw) {
      case 'approved':
      case 'completed':
        return 'completed';
      case 'pending':
      case 'PENDING_REVIEW':
        return 'pending';
      case 'rejected':
        return 'rejected';
    }
    final bool dueDatePassed = c.dueDate != null && DateTime.now().isAfter(c.dueDate!);
    return (dueDatePassed || raw == 'expired') ? 'expired' : 'new';
  }

  void submitAssignment(SubmissionModel submission, {bool persist = true}) {
    submissions.removeWhere((s) => s.challengeId == submission.challengeId);
    submissions.insert(0, submission);
    notifyListeners();

    // Persist to backend and reload live challenges with new status
    if (!persist) return;
    _apiService.submitTask(submission.challengeId, submission.answerText).then((_) {
      refreshChallenges();
    });
  }

  void rateMentor(String mentorId, double rating, String comment) {
    final newRating = MentorRatingModel(
      mentorId: mentorId,
      studentId: currentUser.id,
      ratingValue: rating,
      comment: comment,
      createdAt: DateTime.now(),
    );
    mentorRatings.add(newRating);

    // Recalculate satisfaction rating
    final ratingsForMentor = mentorRatings.where((r) => r.mentorId == mentorId).toList();
    double total = 0.0;
    for (var r in ratingsForMentor) {
      total += r.ratingValue;
    }
    
    // Add default initial ratings weight to avoid extreme swings
    double calculated = (total + (5.0 * 4)) / (ratingsForMentor.length + 4);
    if (mentorData.containsKey(mentorId)) {
      mentorData[mentorId]!['rating'] = double.parse(calculated.toStringAsFixed(1));
    }


    notifyListeners();
  }

  void reviewSubmission(String submissionId, bool approved, double reward) {
    final subIndex = submissions.indexWhere((element) => element.id == submissionId);
    if (subIndex != -1) {
      final sub = submissions[subIndex];
      sub.status = approved ? 'approved' : 'rejected';
      sub.scoreFeedback = approved ? 'با موفقیت تایید شد' : 'رد شد. لطفا اصلاح و مجدد ارسال کنید.';

      if (approved) {
        if (sub.studentId == currentUser.id) {
          currentUser = UserModel(
            id: currentUser.id,
            name: currentUser.name,
            phoneNumber: currentUser.phoneNumber,
            role: currentUser.role,
            zarik: currentUser.zarik + reward.toInt(),
            nakh: currentUser.nakh + 1,
            beyragh: currentUser.beyragh,
            farsh: currentUser.farsh,
            hasEvaluatedMentorThisSeason: currentUser.hasEvaluatedMentorThisSeason,
            userCode: currentUser.userCode,
          );
        }
      }


      notifyListeners();
    }
  }

  void switchCaravan(String caravanId) {
    _selectedCaravanId = caravanId;
    fetchCaravanBanners().catchError((e) => debugPrint('fetchCaravanBanners error: $e'));
    notifyListeners();
  }

  void setActiveRole(UserRole role) {
    currentUser = currentUser.copyWith(role: role);
    AuthService.selectedRole = role;
    notifyListeners();
  }

  void toggleUserRole() {
    final nextRole = currentUser.role == UserRole.member ? UserRole.mentor : UserRole.member;
    setActiveRole(nextRole);
  }

  Future<Map<String, dynamic>?> getStudentPerformance(String userId) async {
    return await _apiService.getStudentPerformance(userId);
  }
}

/// A screen of one part of the app pushed over the tabs (AppRepository.pushArea).
class _AreaEntry {
  _AreaEntry(this.area, this.label, this.refId);
  final String area;
  String label;
  String refId;
}
