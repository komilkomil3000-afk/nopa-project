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

  // Singleton Pattern
  static final AppRepository _instance = AppRepository._internal();
  factory AppRepository() => _instance;
  AppRepository._internal() {
    _initializeMockData();
    WidgetsBinding.instance.addObserver(this);
    if (kDebugMode) {
      EmbeddedServer().start().then((_) {
        _apiService.checkBackendHealth();
        refreshUser();
      });
    } else {
      refreshUser();
    }
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
    await _apiService.logout();
    currentUser = UserModel(
      id: 'loading',
      name: 'در حال بارگذاری...',
      phoneNumber: '',
      role: UserRole.member,
      zarik: 0,
      nakh: 0,
      beyragh: 0,
      farsh: 0,
    );
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
  final Map<String, Map<String, dynamic>> mentorData = {
    'alavi': {
      'id': 'alavi',
      'name': 'استاد علوی',
      'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      'rating': 4.8,
      'caravans': 12,
      'members': 480,
      'bio': 'مدرس باسابقه مفاهیم کار گروهی و تفکر خلاق در سرزمین نپا با بیش از ۵ سال سابقه منتورینگ.',
    },
    'rezaei': {
      'id': 'rezaei',
      'name': 'استاد رضایی',
      'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      'rating': 4.5,
      'caravans': 8,
      'members': 320,
      'bio': 'متخصص تولید محتوا و رسانه‌های نوین دیجیتال. همراه شما در چالش‌های رسانه‌ای کاروان.',
    },
    'hosseini': {
      'id': 'hosseini',
      'name': 'استاد حسینی',
      'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
      'rating': 4.2,
      'caravans': 6,
      'members': 240,
      'bio': 'مدرس مبانی تفکر انقلابی و طراحی پروژه‌های همیاری اجتماعی کاروان‌های نپا.',
    }
  };

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

  int get unreadNotificationsCount {
    return notifications.where((n) => !n['isRead'] && n['isForMentor'] == (currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor)).length;
  }

  void markAllNotificationsAsRead() {
    for (var n in notifications) {
      if (n['isForMentor'] == (currentUser.role == UserRole.mentor || currentUser.role == UserRole.superMentor)) {
        n['isRead'] = true;
      }
    }
    notifyListeners();
  }

  void _initializeMockData() {

    // Initial Caravans
    caravans.addAll([
      CaravanModel(id: 'c1', name: 'یاوران علاءالملک', memberCount: 12, overallProgress: 0.78, activeStation: 'ایستگاه مهارتی ۱'),
      CaravanModel(id: 'c2', name: 'کاروان عمار', memberCount: 10, overallProgress: 0.58, activeStation: 'ایستگاه رسانه‌ای ۱'),
      CaravanModel(id: 'c3', name: 'کاروان مالک', memberCount: 8, overallProgress: 0.42, activeStation: 'ایستگاه رسانه‌ای ۲'),
    ]);

    // Initial Challenges
    challenges.addAll([
      ChallengeModel(
        id: 'c1',
        title: 'چالش هدف‌گذاری SMART',
        description: 'اهداف شخصی خود را در سه حوزه طبق الگوی پنجگانه SMART بنویسید.',
        rewardZarik: 200,
        type: 'text',
        createdByMentorId: 'alavi',
        progress: 0.8,
      ),
      ChallengeModel(
        id: 'c2',
        title: 'آزمون مرحله‌ای رسانه و تفکر',
        description: 'آزمون ۳ مرحله‌ای برای سنجش معلومات رسانه‌ای شما.',
        rewardZarik: 250,
        type: 'multiple_choice',
        questions: [
          {
            'q': 'منظور از تفکر SMART چیست؟',
            'options': ['مشخص، قابل اندازه‌گیری، دستیابی، مرتبط، زمان‌دار', 'ساده، مهم، دقیق، اصولی، سریع', 'هیچکدام'],
            'correct': 0,
          },
          {
            'q': 'مهم‌ترین اصل در نگارش سناریوی جذاب رسانه‌ای چیست؟',
            'options': ['پایان غافلگیرکننده', 'قلاب ۳ ثانیه اول ویدیو', 'طولانی بودن متن سناریو'],
            'correct': 1,
          },
          {
            'q': 'کدام گزینه نشان‌دهنده یک هدف زمان‌دار است؟',
            'options': ['ثبت‌نام در یک کلاس مهارتی', 'یادگیری انگلیسی تا پایان آذرماه', 'تلاش مستمر برای ارتقای معدل'],
            'correct': 1,
          }
        ],
        createdByMentorId: 'rezaei',
        progress: 0.4,
      ),
      ChallengeModel(
        id: 'c3',
        title: 'چالش اولین بیرق کاروان',
        description: 'یک گزارش متنی از اولین جلسه همفکری با هم‌گروهی‌های خود ارسال کنید.',
        rewardZarik: 300,
        type: 'text',
        createdByMentorId: 'alavi',
        progress: 1.0,
      )
    ]);

    // Initial Submissions
    submissions.addAll([
      SubmissionModel(
        id: 's1',
        challengeId: 'c1',
        studentId: 'student_2',
        studentName: 'امیرحسین رضایی',
        answerText: 'مبادله ۵۰۰ زریک به ۱ نخ برای ساخت بیرق دوم گروه علاءالملک.',
        submittedAt: DateTime.now().subtract(const Duration(minutes: 5)),
        status: 'pending',
      ),
      SubmissionModel(
        id: 's2',
        challengeId: 'c1',
        studentId: 'student_3',
        studentName: 'سارا احمدی',
        answerText: 'مبادله ۵ نخ به ۱ فرش ساده طبق استراتژی امتیازدهی ایستگاه اول.',
        submittedAt: DateTime.now().subtract(const Duration(minutes: 15)),
        status: 'pending',
      ),
      SubmissionModel(
        id: 's3',
        challengeId: 'c2',
        studentId: 'student_4',
        studentName: 'علی حسینی',
        answerText: 'پاسخ من به تفکر SMART: گزینه اول شامل هدف معین، سنجش‌پذیر، قابل دستیابی است.',
        submittedAt: DateTime.now().subtract(const Duration(hours: 1)),
        status: 'pending',
      )
    ]);

    // Seed mock notifications
    notifications.addAll([
      {
        'id': 'n_mock_1',
        'title': 'خوش‌آمدگویی به نپا 🚩',
        'body': 'به سامانه یکپارچه مربیگری و دانش‌آموزی نپا خوش آمدید.',
        'isForMentor': false,
        'isRead': false,
        'time': '۱ ساعت پیش',
      },
      {
        'id': 'n_mock_2',
        'title': 'جلسه هماهنگی راهبران 🎓',
        'body': 'جلسه هماهنگی ساعت ۱۸ برگزار می‌گردد.',
        'isForMentor': true,
        'isRead': false,
        'time': '۲ ساعت پیش',
      }
    ]);
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

  void submitAssignment(SubmissionModel submission) {
    submissions.insert(0, submission);
    addNotification(
      'پاسخ جدید دریافت شد 📝',
      'دانش‌آموز "${submission.studentName}" پاسخی برای چالش ثبت کرد.',
      isForMentor: true,
    );
    notifyListeners();
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

