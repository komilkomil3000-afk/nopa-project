import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'api_service.dart';
import 'auth_service.dart';

import '../backend_server/embedded_server.dart';

class AppRepository extends ChangeNotifier with WidgetsBindingObserver {
  // Config Toggle
  bool useMockBackend = false;
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
      if (kDebugMode && useMockBackend) {
        EmbeddedServer().start().then((_) {
          _apiService.checkBackendHealth();
          refreshUser();
        }).catchError((e) {
          debugPrint('EmbeddedServer start error: $e');
        });
      } else {
        refreshUser().catchError((e) {
          debugPrint('Startup refreshUser error: $e');
        });
      }
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

  void _startPeriodicNotificationSync() {
    _notificationPollTimer?.cancel();
    _notificationPollTimer = Timer.periodic(const Duration(seconds: 45), (_) async {
      try {
        if (_apiService.isAuthenticated) {
          await fetchNotifications();
        }
      } catch (e) {
        debugPrint('Periodic notification sync caught: $e');
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    try {
      if (state == AppLifecycleState.resumed) {
        recordActivity();
        if (_apiService.isAuthenticated) {
          refreshUser().catchError((e) {
            debugPrint('Resumed refreshUser error: $e');
          });
        }
      } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.detached) {
        recordActivity();
      }
    } catch (e) {
      debugPrint('Lifecycle state change caught: $e');
    }
  }




  Future<void> refreshUser() async {
    final user = await _apiService.getMe();
    if (user != null) {
      final existingRole = currentUser.role;
      if (user.isDualRole && (existingRole == UserRole.mentor || existingRole == UserRole.member)) {
        currentUser = user.copyWith(role: existingRole);
      } else {
        currentUser = user;
      }
      final apiChallenges = await _apiService.getChallenges();
      challenges.clear();
      challenges.addAll(apiChallenges);
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
    submissions.add(jsonEncode(data));
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
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(prefKeyLastActive);
      if (currentUser.phoneNumber.isNotEmpty) {
        await prefs.setString('saved_login_phone', currentUser.phoneNumber);
      }
    } catch (_) {}

    await _apiService.logout();
    challenges.clear();
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
    challenges.clear();
    notifyListeners();
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
  String _selectedCaravanId = 'c1'; // Default: یاوران علاءالملک
  String get selectedCaravanId => _selectedCaravanId;
  String get selectedCaravanName {
    if (caravans.isEmpty) {
      return currentUser.caravanName ?? 'کاروان یاوران علاءالملک';
    }
    final c = caravans.firstWhere((element) => element.id == _selectedCaravanId,
        orElse: () => caravans.first);
    return c.name;
  }

  // Reactive Collections
  List<CaravanModel> caravans = [
    CaravanModel(id: 'c1', name: 'کاروان یاوران علاءالملک', memberCount: 24, overallProgress: 0.78, activeStation: 'منزلگاه اول'),
    CaravanModel(id: 'c2', name: 'کاروان عمار', memberCount: 20, overallProgress: 0.65, activeStation: 'منزلگاه دوم'),
    CaravanModel(id: 'c3', name: 'کاروان مالک اشتر', memberCount: 18, overallProgress: 0.50, activeStation: 'منزلگاه سوم'),
  ];

  Future<void> fetchCaravans() async {
    try {
      final data = await _apiService.getCaravans();
      if (data.isNotEmpty) {
        final List<CaravanModel> loaded = [];
        for (final item in data) {
          final members = (item['members'] is List) ? (item['members'] as List) : ((item['membersList'] is List) ? item['membersList'] as List : []);
          final memberCount = (item['memberCount'] is int) ? (item['memberCount'] as int) : members.length;
          final overallProgress = (item['overallProgress'] is num) ? (item['overallProgress'] as num).toDouble() : 0.75;
          final activeStation = item['activeStation']?.toString() ?? 'منزلگاه اول';
          loaded.add(CaravanModel(
            id: item['id']?.toString() ?? '',
            name: item['name']?.toString() ?? 'کاروان',
            memberCount: memberCount,
            overallProgress: overallProgress,
            activeStation: activeStation,
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

  // Caravan dynamic stats helper
  Map<String, dynamic> get activeCaravanStats {
    CaravanModel caravan;
    if (caravans.isEmpty) {
      caravan = CaravanModel(
        id: 'c1',
        name: currentUser.caravanName ?? 'کاروان یاوران علاءالملک',
        memberCount: 24,
        overallProgress: 0.78,
        activeStation: 'منزلگاه اول',
      );
    } else {
      caravan = caravans.firstWhere((element) => element.id == _selectedCaravanId,
          orElse: () => caravans.first);
    }

    // Calculate dynamic tickets and submission values from repository
    final activeCaravanSubmissions = submissions.where((s) => 
      s.status == 'pending' && 
      (s.studentName.contains('رضایی') || s.studentName.contains('حسینی') || s.studentName.contains('احمدی'))
    ).length;

    // Base values that get returned
    if (caravan.id == 'c1') {
      return {
        'members': caravan.memberCount,
        'progress': '${(caravan.overallProgress * 100).toInt()}%',
        'progressVal': caravan.overallProgress,
        'tasks': '۴۵/۵۰',
        'tasksVal': 0.90,
        'tickets': '$activeCaravanSubmissions',
        'ticketsVal': activeCaravanSubmissions / 10.0,
        'score': '۳,۵۰۰',
        'scoreVal': 0.95,
        'progressLabel': 'پیشرفت عالی کلاس‌های مهارتی و رسانه‌ای کاروان علاءالملک',
        'progressPercent': caravan.overallProgress,
        'progressM1': 0.85,
        'progressM2': 0.75,
        'progressM3': 0.80,
        'progressM4': 0.60,
        'progressM5': 0.40,
      };
    } else if (caravan.id == 'c2') {
      return {
        'members': caravan.memberCount,
        'progress': '${(caravan.overallProgress * 100).toInt()}%',
        'progressVal': caravan.overallProgress,
        'tasks': '۳۴/۴۰',
        'tasksVal': 0.85,
        'tickets': '$activeCaravanSubmissions',
        'ticketsVal': activeCaravanSubmissions / 10.0,
        'score': '۲,۴۵۰',
        'scoreVal': 0.70,
        'progressLabel': 'روند مناسب کلاس‌های جاری کاروان عمار',
        'progressPercent': caravan.overallProgress,
        'progressM1': 0.70,
        'progressM2': 0.60,
        'progressM3': 0.55,
        'progressM4': 0.45,
        'progressM5': 0.35,
      };
    } else {
      return {
        'members': caravan.memberCount,
        'progress': '${(caravan.overallProgress * 100).toInt()}%',
        'progressVal': caravan.overallProgress,
        'tasks': '۲۰/۴۸',
        'tasksVal': 0.41,
        'tickets': '$activeCaravanSubmissions',
        'ticketsVal': activeCaravanSubmissions / 10.0,
        'score': '۱,۸۰۰',
        'scoreVal': 0.50,
        'progressLabel': 'نیاز به تمرکز بیشتر بر سرفصل‌های کاروان مالک',
        'progressPercent': caravan.overallProgress,
        'progressM1': 0.50,
        'progressM2': 0.40,
        'progressM3': 0.45,
        'progressM4': 0.30,
        'progressM5': 0.10,
      };
    }
  }

  // Notifications collections
  final List<Map<String, dynamic>> notifications = [];

  void addNotification(String title, String body, {bool isForMentor = false}) {
    notifications.insert(0, {
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'title': title,
      'body': body,
      'isForMentor': isForMentor,
      'isRead': false,
      'time': 'الان',
    });
    notifyListeners();
  }

  Future<void> fetchNotifications() async {
    try {
      final data = await _apiService.getNotifications();
      if (data != null && data['notifications'] is List) {
        final List notifs = data['notifications'];
        final isMentor = currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor;
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
    return notifications.where((n) => !n['isRead'] && n['isForMentor'] == (currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor)).length;
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
      if (n['isForMentor'] == (currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor)) {
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
    addNotification(
      'چالش جدید منتشر شد 🏆',
      'راهبر کاروان چالش جدید "${challenge.title}" را ثبت کرد.',
      isForMentor: false,
    );
    notifyListeners();
  }

  Future<void> refreshChallenges() async {
    final apiChallenges = await _apiService.getChallenges();
    challenges.clear();
    challenges.addAll(apiChallenges);
    await fetchNotifications();
    notifyListeners();
  }

  void submitAssignment(SubmissionModel submission) {
    submissions.removeWhere((s) => s.challengeId == submission.challengeId);
    submissions.insert(0, submission);
    addNotification(
      'پاسخ جدید دریافت شد 📝',
      'دانش‌آموز "${submission.studentName}" پاسخی برای چالش ثبت کرد.',
      isForMentor: true,
    );
    notifyListeners();

    // Persist to backend and reload live challenges with new status
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

    addNotification(
      'ارزیابی جدید ثبت شد ⭐',
      'یک عضو کاروان ارزیابی عملکرد جدیدی با امتیاز $rating ثبت کرد.',
      isForMentor: true,
    );

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

      addNotification(
        approved ? 'تکلیف تایید شد ✅' : 'تکلیف رد شد ❌',
        approved 
            ? 'پاسخ شما به چالش تایید شد و ${reward.toInt()} زریک و ۱ نخ به شما اهدا گردید.' 
            : 'پاسخ شما به چالش رد شد. فیدبک را بررسی کنید.',
        isForMentor: false,
      );

      notifyListeners();
    }
  }

  void switchCaravan(String caravanId) {
    _selectedCaravanId = caravanId;
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

