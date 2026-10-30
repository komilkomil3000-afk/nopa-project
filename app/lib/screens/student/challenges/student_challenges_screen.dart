import 'dart:async';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/models/models.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/widgets/challenge_submission_dialog.dart';
import 'package:nopa_app/screens/mentor/challenges/mentor_challenge_grading_screen.dart';

class StudentChallengesScreen extends StatefulWidget {
  const StudentChallengesScreen({super.key});

  @override
  State<StudentChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<StudentChallengesScreen> {
  // 0: فردی, 1: گروهی, 2: میان گروهی
  int _selectedCategoryIndex = 0;
  // 0: درون گروهی, 1: میان گروهی (ویژه راهبر)
  int _mentorSelectedCategoryIndex = 0;
  final Set<String> _expandedChallengeIds = {};

  late final PageController _bannerPageCtrl;
  int _currentBannerIndex = 0;
  Timer? _bannerAutoScrollTimer;

  @override
  void initState() {
    super.initState();
    _bannerPageCtrl = PageController(viewportFraction: 0.92);
    _startBannerAutoScroll();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
      }
    });
  }

  void _startBannerAutoScroll() {
    _bannerAutoScrollTimer?.cancel();
    _bannerAutoScrollTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted || !_bannerPageCtrl.hasClients) return;
      try {
        final int nextIndex = (_currentBannerIndex + 1) % 3;
        _currentBannerIndex = nextIndex;
        _bannerPageCtrl.animateToPage(
          nextIndex,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOutCubic,
        );
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    _bannerAutoScrollTimer?.cancel();
    _bannerPageCtrl.dispose();
    super.dispose();
  }

  String _formatDate(dynamic createdAt) {
    if (createdAt != null) {
      try {
        final dt = createdAt is DateTime ? createdAt : DateTime.tryParse(createdAt.toString());
        if (dt != null) {
          final j = Jalali.fromDateTime(dt);
          final y = (j.year % 100).toString().padLeft(2, '0');
          final m = j.month.toString().padLeft(2, '0');
          final d = j.day.toString().padLeft(2, '0');
          return '$d/$m/۱۴$y'.toPersianDigits();
        }
      } catch (_) {}
    }
    final nowJ = Jalali.now();
    final y = (nowJ.year % 100).toString().padLeft(2, '0');
    final m = nowJ.month.toString().padLeft(2, '0');
    final d = nowJ.day.toString().padLeft(2, '0');
    return '$d/$m/۱۴$y'.toPersianDigits();
  }

  String _formatPersianDate(dynamic date) => _formatDate(date);

  String _resolveChallengeTypeLabel(String type) {
    switch (type.toLowerCase()) {
      case 'quiz':
      case 'step_by_step_quiz':
      case 'multiple_choice':
        return 'تستی';
      case 'skill':
        return 'مهارتی';
      case 'file':
        return 'پروژه‌ای';
      case 'text':
      default:
        return 'تشریحی';
    }
  }

  List<Map<String, dynamic>> _getChallenges(AppRepository repository) {
    final List<Map<String, dynamic>> list = [];
    final submissions = repository.submissions;

    for (var c in repository.challenges) {
      final localSub = submissions.where((s) => s.challengeId == c.id).firstOrNull;
      final String status = repository.challengeStatus(c);

      // Determine category (0: فردی, 1: گروهی, 2: میان گروهی)
      String category = 'individual';
      final String rawCat = (c.category ?? '').toLowerCase();
      final String title = c.title.toLowerCase();
      final String desc = c.description.toLowerCase();

      if (rawCat.contains('inter') || rawCat.contains('میان') || title.contains('میان گروهی') || desc.contains('میان گروهی') || title.contains('بین گروهی')) {
        category = 'inter_group';
      } else if (rawCat.contains('group') || rawCat.contains('گروهی') || title.contains('گروهی') || desc.contains('گروهی')) {
        category = 'group';
      } else {
        category = 'individual';
      }

      list.add({
        'id': c.id,
        'title': c.title,
        'desc': c.description,
        'reward': c.rewardZarik,
        'type': c.type,
        'status': status,
        'category': category,
        'questions': c.questions,
        'progress': c.progress,
        'stationId': c.stationId,
        'dueDate': c.dueDate,
        'stationTitle': c.stationTitle,
        'mentorName': c.mentorName,
        'caravanName': c.caravanName,
        'mentorFeedback': c.mentorFeedback ?? localSub?.scoreFeedback,
        'myAnswerText': c.myAnswerText ?? localSub?.answerText,
        'myFileUrl': c.myFileUrl,
        'isByAdmin': c.isByAdmin,
        'creatorName': c.creatorName ?? (c.isByAdmin ? 'مدیر سیستم' : (c.mentorName ?? 'راهبر')),
        'createdAt': c.createdAt ?? DateTime.now().subtract(const Duration(days: 2)),
        'durationDays': c.durationDays ?? 5,
      });
    }
    return list;
  }

  /// Opens the answer dialog. Editable only for a new or corrected answer; while the
  /// mentor has not replied (or after approval/expiry) it is a read-only view.
  Future<void> _showSubmissionDialog(Map<String, dynamic> challenge) async {
    final repository = Provider.of<AppRepository>(context, listen: false);
    final String status = challenge['status']?.toString() ?? 'new';
    final result = await ChallengeSubmissionDialog.show(context, challenge: challenge, status: status);
    if (result == null || !mounted) return;

    repository.submitAssignment(
      SubmissionModel(
        id: 's_${DateTime.now().millisecondsSinceEpoch}',
        challengeId: challenge['id'],
        studentId: repository.currentUser.id,
        studentName: repository.currentUser.name,
        answerText: result.answerText,
        submittedAt: DateTime.now(),
        status: result.isQuiz ? 'approved' : 'pending',
      ),
      persist: false,
    );
    AppToast.success(
      context,
      result.isQuiz ? 'پاسخ شما ثبت شد' : 'پاسخ شما ارسال شد و در انتظار بررسی راهبر است',
    );
    await repository.refreshChallenges();
    if (result.isQuiz) await repository.refreshUser();
  }

  List<Map<String, dynamic>> _getMentorChallenges(AppRepository repository) {
    final List<Map<String, dynamic>> list = [];

    for (var c in repository.challenges) {
      // Mentors never answer challenges: the tag reflects the review state of their students' answers
      final String statusTag;
      final Color statusColor;
      if (c.pendingSubmissions > 0) {
        statusTag = '${c.pendingSubmissions.toString().toPersianDigits()} پاسخ در انتظار بررسی';
        statusColor = const Color(0xFFEAB308);
      } else if (c.totalSubmissions > 0) {
        statusTag = 'بررسی شده';
        statusColor = const Color(0xFF22C55E);
      } else if (c.dueDate != null && DateTime.now().isAfter(c.dueDate!)) {
        statusTag = 'منقضی';
        statusColor = const Color(0xFF9E9AC0);
      } else {
        statusTag = 'بدون پاسخ';
        statusColor = const Color(0xFF9E9AC0);
      }

      String category = 'intra_group'; // درون گروهی
      final String rawCat = (c.category ?? '').toLowerCase();
      final String title = c.title.toLowerCase();
      final String desc = c.description.toLowerCase();
      if (rawCat.contains('inter') || rawCat.contains('میان') || title.contains('میان گروهی') || desc.contains('میان گروهی') || title.contains('بین گروهی')) {
        category = 'inter_group';
      }

      list.add({
        'id': c.id,
        'title': c.title,
        'creatorName': c.creatorName ?? (c.isByAdmin ? 'مدیر سیستم' : (c.mentorName ?? (repository.currentUser.name.isNotEmpty ? repository.currentUser.name : 'راهبر کاروان'))),
        'statusTag': statusTag,
        'statusColor': statusColor,
        'reward': c.rewardZarik,
        'rewardMin': c.rewardMin,
        'rewardMax': c.rewardMax,
        'rewardAsset': c.rewardAssetType,
        'typeLabel': _resolveChallengeTypeLabel(c.type),
        'createdDate': _formatPersianDate(c.createdAt),
        'durationDays': c.durationDays ?? 5,
        'category': category,
        'desc': c.description,
        'actionLabel': c.pendingSubmissions > 0 ? 'بررسی پاسخ‌ها' : 'مشاهده',
      });
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final user = repository.currentUser;
    final bool isMentor = user.role == UserRole.mentor || user.role == UserRole.superMentor;

    if (isMentor) {
      return _buildMentorChallengesView(context, repository, user);
    }

    final allChallenges = _getChallenges(repository);

    // Filter by selected category (0: فردی, 1: گروهی, 2: میان گروهی)
    final filtered = allChallenges.where((c) {
      if (_selectedCategoryIndex == 0) {
        return c['category'] == 'individual';
      } else if (_selectedCategoryIndex == 1) {
        return c['category'] == 'group';
      } else {
        return c['category'] == 'inter_group';
      }
    }).toList();

    return RefreshIndicator(
      color: const Color(0xFFCD8449),
      backgroundColor: const Color(0xFF231C38),
      onRefresh: () async {
        await repository.refreshChallenges();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Clean Station Banner Carousel with 3 indicator dots (No text overlay)
            _buildStationBannerSlider(),

            const SizedBox(height: 18),

            // 2. Category Tabs: فردی / گروهی / میان گروهی (گروهی strictly centered)
            _buildCategoryTabsBar(),

            const SizedBox(height: 18),

            // 3. Challenge Cards List or Empty State
            if (filtered.isEmpty)
              _buildEmptyState()
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: filtered.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  final String id = item['id']?.toString() ?? 'ch_$index';
                  final bool isExpanded = _expandedChallengeIds.contains(id);

                  return _buildChallengeCard(
                    item: item,
                    id: id,
                    isExpanded: isExpanded,
                  );
                },
              ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildMentorChallengesView(
    BuildContext context,
    AppRepository repository,
    UserModel user,
  ) {
    final mentorChallenges = _getMentorChallenges(repository);
    final filtered = mentorChallenges.where((c) {
      if (_mentorSelectedCategoryIndex == 0) {
        return c['category'] == 'intra_group';
      } else {
        return c['category'] == 'inter_group';
      }
    }).toList();

    final caravanName = user.caravanName ?? 'کاروان پنجم رضا جلالی';

    return RefreshIndicator(
      color: const Color(0xFFCD8449),
      backgroundColor: const Color(0xFF231C38),
      onRefresh: () async {
        await repository.refreshChallenges();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Caravan Name Subtitle on right
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 2, right: 4, bottom: 12),
                child: Text(
                  caravanName,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF9E9AC0).withValues(alpha: 0.9),
                  ),
                ),
              ),
            ),

            // Top Action Buttons: [ + ایجاد چالش جدید ] [ + ایجاد پیام ]
            Row(
              children: [
                Expanded(
                  child: _buildMentorHeaderButton(
                    title: 'ایجاد پیام',
                    onTap: () => _showCreateMessageDialog(context, user),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMentorHeaderButton(
                    title: 'ایجاد چالش جدید',
                    onTap: () => _showCreateChallengeDialog(context, user),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Mentor Category Tabs: [درون گروهی] [میان گروهی]
            _buildMentorCategoryTabsBar(),

            const SizedBox(height: 18),

            // Challenge Cards List
            if (filtered.isEmpty)
              _buildEmptyState()
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: filtered.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final item = filtered[index];
                  final String id = item['id']?.toString() ?? 'm_ch_$index';
                  return _buildMentorChallengeCard(
                    context: context,
                    user: user,
                    item: item,
                    id: id,
                  );
                },
              ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildMentorHeaderButton({
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: const Color(0xFFC09268),
            width: 1.0,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add, color: Color(0xFFE1BC96), size: 18),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFFE1BC96),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMentorCategoryTabsBar() {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              // درون گروهی
              GestureDetector(
                onTap: () => setState(() => _mentorSelectedCategoryIndex = 0),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Text(
                    'درون گروهی',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _mentorSelectedCategoryIndex == 0
                          ? const Color(0xFFDFB690)
                          : const Color(0xFF8E88B0),
                    ),
                  ),
                ),
              ),
              // میان گروهی
              GestureDetector(
                onTap: () => setState(() => _mentorSelectedCategoryIndex = 1),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Text(
                    'میان گروهی',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _mentorSelectedCategoryIndex == 1
                          ? const Color(0xFFDFB690)
                          : const Color(0xFF8E88B0),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Subtle gradient divider line
          Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.white.withValues(alpha: 0.0),
                  Colors.white.withValues(alpha: 0.15),
                  Colors.white.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMentorChallengeCard({
    required BuildContext context,
    required UserModel user,
    required Map<String, dynamic> item,
    required String id,
  }) {
    final title = item['title'] ?? '';
    final statusTag = item['statusTag'] ?? '';
    final statusColor = item['statusColor'] as Color? ?? const Color(0xFFE5A86D);
    final reward = item['reward'] ?? 50;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
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
        padding: const EdgeInsets.all(1.2), // Gradient border matching student challenges
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14.8),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => MentorChallengeDetailsScreen(
                      challenge: item,
                      user: user,
                    ),
                  ),
                );
              },
              child: Container(
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
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                child: Row(
                  children: [
                    // Right: Challenge Title (Matching student challenges: concise, bold, white, fontSize: 12)
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Left Group: Status Tag -> Reward Amount (ایکن سمت چپ حذف شد)
                    // 1. Status Tag
                    if (statusTag.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6.5, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: statusColor.withValues(alpha: 0.4), width: 0.9),
                        ),
                        child: Text(
                          statusTag,
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],

                    // 2. Reward Amount
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+${reward.toString().toPersianDigits()}',
                          style: const TextStyle(
                            color: Color(0xFF9292E2),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        const SizedBox(width: 4),
                        SvgPicture.asset(
                          'assets/svg_icons/challeng01.svg',
                          width: 12,
                          height: 12,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFF9292E2),
                            BlendMode.srcIn,
                          ),
                          errorBuilder: (ctx, err, stack) => Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF9292E2),
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
        ),
      ),
    );
  }

  void _showCreateChallengeDialog(BuildContext context, UserModel user) {
    final titleCtrl = TextEditingController(text: 'بیا یه پوستر خفن بزنیم');
    final questionCtrl = TextEditingController(text: 'وقتی استاد سر کلاس نمیاد چکار میکنید شما؟');
    final List<TextEditingController> optionControllers = [
      TextEditingController(text: '۱. سوال نداره میریم خونه'),
      TextEditingController(text: '۲. تکالیف جلسه بعد رو انجام میدیم'),
      TextEditingController(text: '۳. با بچه‌ها تمرین مباحث قبلی رو انجام میدیم'),
      TextEditingController(text: '۴. منتظر اعلام نماینده کلاس می‌مونیم'),
    ];
    int selectedCorrectOptionIndex = 0;
    final rewardCtrl = TextEditingController(text: '100');
    String selectedAsset = 'زریک';
    String selectedType = 'چند گزینه ای';
    String selectedAudience = 'همه اعضا';

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 420),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
                  decoration: AppColors.loginDialogDecoration(radius: 24),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Header: Fire icon on right and Centered Title (Matching ContactUsDialog)
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            const Align(
                              alignment: Alignment.centerRight,
                              child: Icon(
                                Icons.local_fire_department_rounded,
                                color: Color(0xFF9E9CD6),
                                size: 34,
                              ),
                            ),
                            const Text(
                              'ایجاد چالش',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),

                        const SizedBox(height: 22),

                        // Field 1: ایجاد کننده
                        _buildContactDialogFieldRow(
                          label: 'ایجاد کننده:',
                          child: _buildContactDialogValueText(user.name),
                        ),
                        const SizedBox(height: 12),

                        // Field 2: نام کاروان
                        _buildContactDialogFieldRow(
                          label: 'نام کاروان:',
                          child: _buildContactDialogValueText(user.caravanName ?? 'کاروان شماره پنجم'),
                        ),
                        const SizedBox(height: 12),

                        // Field 3: دریافت کننده
                        _buildContactDialogFieldRow(
                          label: 'دریافت کننده:',
                          child: _buildContactDialogValueText(selectedAudience),
                        ),
                        const SizedBox(height: 12),

                        // Field 4: تاریخ
                        _buildContactDialogFieldRow(
                          label: 'تاریخ:',
                          child: _buildContactDialogValueText('1405/05/05'),
                        ),
                        const SizedBox(height: 12),

                        // Field 5: جایزه (Amount + Asset)
                        _buildContactDialogFieldRow(
                          label: 'جایزه:',
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Container(
                                  height: 36,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: const Color(0xFF7A709E),
                                      width: 1.1,
                                    ),
                                  ),
                                  child: TextField(
                                    controller: rewardCtrl,
                                    textAlign: TextAlign.center,
                                    keyboardType: TextInputType.number,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontFamily: AppTheme.fontFamily,
                                      fontSize: 13,
                                    ),
                                    decoration: const InputDecoration(
                                      border: InputBorder.none,
                                      isDense: true,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 2,
                                child: Container(
                                  height: 36,
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: const Color(0xFF7A709E),
                                      width: 1.1,
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String>(
                                      value: selectedAsset,
                                      dropdownColor: const Color(0xFF2C2849),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontFamily: AppTheme.fontFamily,
                                        fontSize: 12,
                                      ),
                                      icon: const Icon(
                                        Icons.keyboard_arrow_down,
                                        color: Color(0xFF9E9CD6),
                                        size: 18,
                                      ),
                                      isExpanded: true,
                                      items: ['زریک', 'نخ', 'فرش']
                                          .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                                          .toList(),
                                      onChanged: (v) {
                                        if (v != null) setDialogState(() => selectedAsset = v);
                                      },
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Field 6: نوع
                        _buildContactDialogFieldRow(
                          label: 'نوع:',
                          child: Container(
                            height: 36,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF7A709E),
                                width: 1.1,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: selectedType,
                                dropdownColor: const Color(0xFF2C2849),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 12.5,
                                ),
                                icon: const Icon(
                                  Icons.keyboard_arrow_down,
                                  color: Color(0xFF9E9CD6),
                                  size: 18,
                                ),
                                isExpanded: true,
                                items: ['چند گزینه ای', 'تشریحی', 'فایلی']
                                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                                    .toList(),
                                onChanged: (v) {
                                  if (v != null) setDialogState(() => selectedType = v);
                                },
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Field 7: تیتر:
                        _buildContactDialogFieldRow(
                          label: 'تیتر:',
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF7A709E),
                                width: 1.1,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: TextField(
                              controller: titleCtrl,
                              style: const TextStyle(
                                color: Colors.white,
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Field 8: متن سوال اول
                        _buildContactDialogFieldRow(
                          label: 'متن سوال:',
                          isTopAligned: true,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF7A709E),
                                width: 1.1,
                              ),
                            ),
                            child: TextField(
                              controller: questionCtrl,
                              maxLines: 2,
                              style: const TextStyle(
                                color: Colors.white,
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 12.5,
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Field 9: گزینه ها (فقط در صورت انتخاب نوع چند گزینه‌ای)
                        if (selectedType == 'چند گزینه ای') ...[
                          _buildContactDialogFieldRow(
                            label: 'گزینه‌ها:',
                            isTopAligned: true,
                            child: Column(
                              children: [
                                for (int i = 0; i < optionControllers.length; i++) ...[
                                  Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.transparent,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: selectedCorrectOptionIndex == i
                                            ? const Color(0xFFC09268)
                                            : const Color(0xFF7A709E),
                                        width: 1.1,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: TextField(
                                            controller: optionControllers[i],
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontFamily: AppTheme.fontFamily,
                                              fontSize: 12.5,
                                            ),
                                            decoration: const InputDecoration(
                                              border: InputBorder.none,
                                              isDense: true,
                                              contentPadding: EdgeInsets.symmetric(vertical: 7),
                                            ),
                                          ),
                                        ),
                                        if (optionControllers.length > 2) ...[
                                          InkWell(
                                            onTap: () {
                                              setDialogState(() {
                                                optionControllers.removeAt(i);
                                                if (selectedCorrectOptionIndex >= optionControllers.length) {
                                                  selectedCorrectOptionIndex = optionControllers.length - 1;
                                                }
                                              });
                                            },
                                            child: Padding(
                                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                              child: Icon(
                                                Icons.close_rounded,
                                                color: const Color(0xFFE57373).withValues(alpha: 0.85),
                                                size: 16,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                        ],
                                        // Radio Button to mark correct answer
                                        GestureDetector(
                                          onTap: () {
                                            setDialogState(() {
                                              selectedCorrectOptionIndex = i;
                                            });
                                          },
                                          child: Container(
                                            width: 22,
                                            height: 22,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: selectedCorrectOptionIndex == i
                                                  ? const Color(0xFFC09268).withValues(alpha: 0.2)
                                                  : Colors.transparent,
                                              border: Border.all(
                                                color: selectedCorrectOptionIndex == i
                                                    ? const Color(0xFFC09268)
                                                    : const Color(0xFF9E9CD6),
                                                width: selectedCorrectOptionIndex == i ? 2.0 : 1.4,
                                              ),
                                            ),
                                            child: selectedCorrectOptionIndex == i
                                                ? Center(
                                                    child: Container(
                                                      width: 10,
                                                      height: 10,
                                                      decoration: const BoxDecoration(
                                                        shape: BoxShape.circle,
                                                        color: Color(0xFFC09268),
                                                      ),
                                                    ),
                                                  )
                                                : null,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 2),
                                // + Add button
                                GestureDetector(
                                  onTap: () {
                                    setDialogState(() {
                                      final nextNumber = (optionControllers.length + 1).toString().toPersian();
                                      optionControllers.add(TextEditingController(text: '$nextNumber. '));
                                    });
                                  },
                                  child: Container(
                                    width: double.infinity,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: Colors.transparent,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: const Color(0xFFC09268).withValues(alpha: 0.6),
                                        width: 1.0,
                                      ),
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        Icons.add,
                                        color: Color(0xFFC09268),
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Bottom Actions: ارسال & لغو (Matching ContactUsDialog)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // ارسال (Right in RTL)
                            TextButton(
                              onPressed: () {
                                Navigator.pop(ctx);
                                AppToast.info(context, 'چالش "${titleCtrl.text}" با موفقیت ایجاد و برای کاروان ابلاغ شد 🏆');
                              },
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              ),
                              child: const Text(
                                'ارسال',
                                style: TextStyle(
                                  color: Color(0xFF9E9CD6),
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ),

                            // لغو (Left in RTL)
                            TextButton(
                              onPressed: () => Navigator.pop(ctx),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              ),
                              child: const Text(
                                'لغو',
                                style: TextStyle(
                                  color: Color(0xFF9E9CD6),
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
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
    );
  }

  void _showCreateMessageDialog(BuildContext context, UserModel user) {
    final titleCtrl = TextEditingController(text: 'بیا یه پوستر خفن بزنیم');
    final messageCtrl = TextEditingController(text: 'بچه بیاید توی گروه کلی صحبت باهاتون دارم گلای من');
    String selectedAudience = 'همه اعضا';

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
              decoration: AppColors.loginDialogDecoration(radius: 24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header: Message Icon on right and Centered Title (Matching ContactUsDialog)
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        const Align(
                          alignment: Alignment.centerRight,
                          child: Icon(
                            Icons.chat_bubble_outline_rounded,
                            color: Color(0xFF9E9CD6),
                            size: 32,
                          ),
                        ),
                        const Text(
                          'ایجاد پیام',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),

                    const SizedBox(height: 22),

                    // Field 1: ایجاد کننده
                    _buildContactDialogFieldRow(
                      label: 'ایجاد کننده:',
                      child: _buildContactDialogValueText(user.name),
                    ),
                    const SizedBox(height: 12),

                    // Field 2: نام کاروان
                    _buildContactDialogFieldRow(
                      label: 'نام کاروان:',
                      child: _buildContactDialogValueText(user.caravanName ?? 'کاروان شماره پنجم'),
                    ),
                    const SizedBox(height: 12),

                    // Field 3: دریافت کننده
                    _buildContactDialogFieldRow(
                      label: 'دریافت کننده:',
                      child: _buildContactDialogValueText(selectedAudience),
                    ),
                    const SizedBox(height: 12),

                    // Field 4: تاریخ
                    _buildContactDialogFieldRow(
                      label: 'تاریخ:',
                      child: _buildContactDialogValueText('1405/05/05'),
                    ),
                    const SizedBox(height: 12),

                    // Field 5: تیتر:
                    _buildContactDialogFieldRow(
                      label: 'تیتر:',
                      child: Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF7A709E),
                            width: 1.1,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: TextField(
                          controller: titleCtrl,
                          style: const TextStyle(
                            color: Colors.white,
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 13,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Field 6: متن پیام
                    _buildContactDialogFieldRow(
                      label: 'متن پیام:',
                      isTopAligned: true,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF7A709E),
                            width: 1.1,
                          ),
                        ),
                        child: TextField(
                          controller: messageCtrl,
                          maxLines: 3,
                          style: const TextStyle(
                            color: Colors.white,
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 12.5,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Bottom Actions: ارسال & لغو (Matching ContactUsDialog)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // ارسال (Right in RTL)
                        TextButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            AppToast.info(context, 'پیام "${titleCtrl.text}" با موفقیت برای اعضای کاروان ارسال شد ✉️');
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          ),
                          child: const Text(
                            'ارسال',
                            style: TextStyle(
                              color: Color(0xFF9E9CD6),
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),

                        // لغو (Left in RTL)
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          ),
                          child: const Text(
                            'لغو',
                            style: TextStyle(
                              color: Color(0xFF9E9CD6),
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
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
  }

  /// Reusable Field Row matching ContactUsDialog specification
  Widget _buildContactDialogFieldRow({
    required String label,
    required Widget child,
    bool isTopAligned = false,
    Color labelBorderColor = const Color(0xFFC09268),
  }) {
    return Row(
      crossAxisAlignment: isTopAligned ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      children: [
        // Label Pill on Right (First child in RTL)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6.5),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: labelBorderColor,
              width: 1.1,
            ),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFDDD9EE),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(width: 12),

        // Value / Input on Left (Second child in RTL)
        Expanded(child: child),
      ],
    );
  }

  /// Reusable Text Value for ContactUsDialog style fields
  Widget _buildContactDialogValueText(String value) {
    return Text(
      value,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 13,
        fontWeight: FontWeight.w600,
        fontFamily: AppTheme.fontFamily,
      ),
    );
  }


  /// Clean Banner Slider (No text overlay) with 3 animated indicator dots
  Widget _buildStationBannerSlider() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 82,
          child: PageView.builder(
            controller: _bannerPageCtrl,
            itemCount: 3,
            onPageChanged: (index) {
              setState(() => _currentBannerIndex = index);
            },
            itemBuilder: (context, index) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.asset(
                    'assets/images/banners/banner1.jpg',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF5A3825), Color(0xFF382318)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 8),

        // 3 Animated Dot Indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            3,
            (index) {
              final bool isActive = _currentBannerIndex == index;

              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isActive ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isActive
                      ? const Color(0xFFCD8449)
                      : Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  /// Category Tabs: فردی / گروهی / میان گروهی (Strictly equal distances with گروهی dead-center)
  Widget _buildCategoryTabsBar() {
    final tabs = [
      {'title': 'فردی', 'index': 0},
      {'title': 'گروهی', 'index': 1},
      {'title': 'میان گروهی', 'index': 2},
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: tabs.map((tab) {
              final int idx = tab['index'] as int;
              final bool isSelected = _selectedCategoryIndex == idx;

              return Expanded(
                child: Center(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedCategoryIndex = idx),
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        tab['title'] as String,
                        style: TextStyle(
                          color: isSelected ? const Color(0xFFE1BC96) : const Color(0xFF9D99B8),
                          fontSize: isSelected ? 15.5 : 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                          shadows: isSelected
                              ? [
                                  Shadow(
                                    color: const Color(0xFFC09268).withValues(alpha: 0.45),
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          // Subtle Thin Divider
          Container(
            height: 1.0,
            width: double.infinity,
            color: const Color(0xFF383556).withValues(alpha: 0.7),
          ),
        ],
      ),
    );
  }

  /// Compact Challenge Box (collapsed shows only Title, Tag, Reward) -> expands on tap showing info & participate button
  Widget _buildChallengeCard({
    required Map<String, dynamic> item,
    required String id,
    required bool isExpanded,
  }) {
    final String title = item['title'] ?? 'چالش نپا';
    final String desc = item['desc'] ?? '';
    final String status = item['status'] ?? 'new';
    final int reward = item['reward'] ?? 50;
    final String dateStr = _formatDate(item['createdAt']);
    final String typeLabel = _resolveChallengeTypeLabel(item['type']?.toString() ?? '');
    final int durationDays = item['durationDays'] ?? 5;
    final String? feedback = item['mentorFeedback']?.toString();

    // Status label, text color & background
    String statusLabel = 'جدید';
    Color statusColor = const Color(0xFFE5A86D);
    Color statusBg = const Color(0xFFE5A86D).withValues(alpha: 0.15);
    Color statusBorder = const Color(0xFFE5A86D).withValues(alpha: 0.4);

    if (status == 'pending') {
      statusLabel = 'در انتظار بررسی';
      statusColor = const Color(0xFF38BDF8);
      statusBg = const Color(0xFF38BDF8).withValues(alpha: 0.15);
      statusBorder = const Color(0xFF38BDF8).withValues(alpha: 0.4);
    } else if (status == 'started' || status == 'new') {
      statusLabel = 'جدید';
      statusColor = const Color(0xFFE5A86D);
      statusBg = const Color(0xFFE5A86D).withValues(alpha: 0.15);
      statusBorder = const Color(0xFFE5A86D).withValues(alpha: 0.4);
    } else if (status == 'rejected') {
      statusLabel = 'اصلاحیه';
      statusColor = const Color(0xFFEF4444);
      statusBg = const Color(0xFFEF4444).withValues(alpha: 0.15);
      statusBorder = const Color(0xFFEF4444).withValues(alpha: 0.45);
    } else if (status == 'completed') {
      statusLabel = 'تکمیل شده';
      statusColor = const Color(0xFF10B981);
      statusBg = const Color(0xFF10B981).withValues(alpha: 0.15);
      statusBorder = const Color(0xFF10B981).withValues(alpha: 0.4);
    } else if (status == 'expired') {
      statusLabel = 'منقضی شده';
      statusColor = const Color(0xFF9D99B8);
      statusBg = const Color(0xFF9D99B8).withValues(alpha: 0.15);
      statusBorder = const Color(0xFF9D99B8).withValues(alpha: 0.35);
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Compact Header Box (Title -> Tag -> Reward Amount & Coin)
          GestureDetector(
            onTap: () {
              setState(() {
                if (_expandedChallengeIds.contains(id)) {
                  _expandedChallengeIds.remove(id);
                } else {
                  _expandedChallengeIds.add(id);
                }
              });
            },
            behavior: HitTestBehavior.opaque,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: isExpanded
                    ? const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
                      )
                    : BorderRadius.circular(16),
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
              padding: const EdgeInsets.all(1.2), // Gradient border
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.only(
                          topLeft: Radius.circular(14.8),
                          topRight: Radius.circular(14.8),
                        )
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
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                child: Row(
                  children: [
                    // Right: Challenge Title (Smaller, concise)
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Left Group: Status Tag -> Reward Amount -> Chevron
                    // 1. Status Tag
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.5, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusBorder, width: 0.9),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    const SizedBox(width: 6),

                    // 2. Reward Amount
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+${reward.toString().toPersianDigits()}',
                          style: const TextStyle(
                            color: Color(0xFF9292E2),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        const SizedBox(width: 4),
                        SvgPicture.asset(
                          'assets/svg_icons/challeng01.svg',
                          width: 12,
                          height: 12,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFF9292E2),
                            BlendMode.srcIn,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(width: 6),

                    // Far Left: Expand / Collapse Chevron Icon
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: const Color(0xFF9897D2),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 2. Expanded Area: Opens on Click and Shows Description + Details + Participate Button
          if (isExpanded)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF242240).withValues(alpha: 0.95),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
                border: Border(
                  left: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                  right: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                  bottom: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Description
                  if (desc.isNotEmpty) ...[
                    Text(
                      desc,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Color(0xFFD3D0E3),
                        fontSize: 11.5,
                        height: 1.55,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Mentor Feedback if rejected
                  if (status == 'rejected' && feedback != null && feedback.trim().isNotEmpty) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.35)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFF87171), size: 15),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'توضیح راهبر: $feedback',
                              style: const TextStyle(
                                color: Color(0xFFFCA5A5),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Bottom Action Row: Details on Right -> Participate Button on Left
                  Row(
                    children: [
                      // Right: Details (Type + Creation Date + Deadline)
                      Expanded(
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              'نوع: $typeLabel',
                              style: const TextStyle(
                                color: Color(0xFFB8B5CE),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w500,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                            Text(
                              'مهلت: ${durationDays.toString().toPersianDigits()} روز',
                              style: const TextStyle(
                                color: Color(0xFFB8B5CE),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w400,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                            Text(
                              'تاریخ: $dateStr',
                              style: const TextStyle(
                                color: Color(0xFF9D99B8),
                                fontSize: 10,
                                fontWeight: FontWeight.w400,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(width: 8),

                      // Left: Participate Button (دکمه شرکت)
                      GestureDetector(
                        onTap: () => _showSubmissionDialog(item),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2A2835),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: const Color(0xFFC09268).withValues(alpha: 0.85),
                              width: 1.0,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            status == 'rejected'
                                ? 'اصلاح و ارسال'
                                : (status == 'new' ? 'شرکت' : 'مشاهده'),
                            style: const TextStyle(
                              color: Color(0xFFF4DCC5),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// Empty State Widget
  Widget _buildEmptyState() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 30),
      padding: const EdgeInsets.all(26),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF453F73).withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.emoji_events_outlined,
            size: 44,
            color: Color(0xFF676296),
          ),
          const SizedBox(height: 12),
          const Text(
            'چالشی در این دسته‌بندی وجود ندارد',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'چالش‌های جدید ثبت شده توسط راهبر یا مدیر در این بخش نمایش داده خواهند شد.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF9D99B8),
              fontSize: 11.5,
              height: 1.5,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ],
      ),
    );
  }
}


typedef ChallengesScreen = StudentChallengesScreen;
