import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'api_service.dart';

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
    _initializeMockData();
    WidgetsBinding.instance.addObserver(this);
    _startPeriodicNotificationSync();
    if (kDebugMode && useMockBackend) {
      EmbeddedServer().start().then((_) {
        _apiService.checkBackendHealth();
        refreshUser();
      });
    } else {
      refreshUser();
    }
  }

  void _startPeriodicNotificationSync() {
    _notificationPollTimer?.cancel();
    _notificationPollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      fetchNotifications();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refreshUser();
    }
  }




  Future<void> refreshUser() async {
    final user = await _apiService.getMe();
    if (user != null) {
      currentUser = user;
      final apiChallenges = await _apiService.getChallenges();
      challenges.clear();
      challenges.addAll(apiChallenges);
      await fetchNotifications();
      notifyListeners();
      await _syncOfflineData();
    }
  }

  Future<void> _syncOfflineData() async {
    final prefs = await SharedPreferences.getInstance();
    final offlineSubmissions = prefs.getStringList('offline_submissions') ?? [];
    if (offlineSubmissions.isNotEmpty) {
      // Logic to push offline submissions to backend would go here
      // For now we just clear it upon successful sync
      await prefs.remove('offline_submissions');
    }
    
    final offlineWatchProgress = prefs.getStringList('offline_watch_progress') ?? [];
    if (offlineWatchProgress.isNotEmpty) {
      // Logic to push watch progress to backend
      await prefs.remove('offline_watch_progress');
    }
  }

  Future<void> cacheSubmissionOffline(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final submissions = prefs.getStringList('offline_submissions') ?? [];
    submissions.add(jsonEncode(data));
    await prefs.setStringList('offline_submissions', submissions);
  }
  
  Future<void> cacheWatchProgressOffline(String sessionId, double percentage) async {
    final prefs = await SharedPreferences.getInstance();
    final progressList = prefs.getStringList('offline_watch_progress') ?? [];
    progressList.add(jsonEncode({'sessionId': sessionId, 'percentage': percentage}));
    await prefs.setStringList('offline_watch_progress', progressList);
  }

  void updateUser(UserModel user) {
    currentUser = user;
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      if (currentUser.phoneNumber.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
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
    final c = caravans.firstWhere((element) => element.id == _selectedCaravanId,
        orElse: () => caravans.first);
    return c.name;
  }

  // Reactive Collections
  final List<CaravanModel> caravans = [];
  final List<ChallengeModel> challenges = [];
  final List<SubmissionModel> submissions = [];
  final List<MentorRatingModel> mentorRatings = [];

  // Mentor Satisfaction Data Cache
  final Map<String, Map<String, dynamic>> mentorData = {};

  // Caravan dynamic stats helper
  Map<String, dynamic> get activeCaravanStats {
    final caravan = caravans.firstWhere((element) => element.id == _selectedCaravanId,
        orElse: () => caravans.first);

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
        notifications.clear();
        for (final item in notifs) {
          notifications.add({
            'id': item['id']?.toString() ?? '',
            'title': item['title'] ?? '',
            'body': item['message'] ?? '',
            'isForMentor': isMentor,
            'isRead': item['isRead'] == true,
            'time': 'اعلان سیستم',
          });
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('fetchNotifications error: $e');
    }
  }

  int get unreadNotificationsCount {
    return notifications.where((n) => !n['isRead'] && n['isForMentor'] == (currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor)).length;
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

  void toggleUserRole() {
    final nextRole = currentUser.role == UserRole.member ? UserRole.mentor : UserRole.member;
    currentUser = UserModel(
      id: currentUser.id,
      name: currentUser.name,
      phoneNumber: currentUser.phoneNumber,
      role: nextRole,
      zarik: currentUser.zarik,
      nakh: currentUser.nakh,
      beyragh: currentUser.beyragh,
      farsh: currentUser.farsh,
      hasEvaluatedMentorThisSeason: currentUser.hasEvaluatedMentorThisSeason,
      userCode: currentUser.userCode,
    );
    notifyListeners();
  }

  Future<Map<String, dynamic>?> getStudentPerformance(String userId) async {
    return await _apiService.getStudentPerformance(userId);
  }
}

