import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../main.dart';

class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});

  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  // 0: فردی, 1: گروهی, 2: میان گروهی
  int _selectedCategoryIndex = 0;
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
      final int nextIndex = (_currentBannerIndex + 1) % 3;
      _bannerPageCtrl.animateToPage(
        nextIndex,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _bannerAutoScrollTimer?.cancel();
    _bannerPageCtrl.dispose();
    super.dispose();
  }

  void _handleBackAction() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      navigateToMainTab(0); // Return to Home
    }
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
      String rawStatus = 'none';
      if (c.myStatus != null && c.myStatus != 'none') {
        rawStatus = c.myStatus!;
      } else if (localSub != null) {
        rawStatus = localSub.status;
      }
      if (rawStatus == 'PENDING_REVIEW') rawStatus = 'pending';

      final String status;
      if (rawStatus == 'approved') {
        status = 'completed';
      } else if (rawStatus == 'pending') {
        status = 'started';
      } else if (rawStatus == 'rejected') {
        status = 'rejected';
      } else {
        status = 'new';
      }

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
        'mentorName': c.mentorName,
        'caravanName': c.caravanName,
        'mentorFeedback': c.mentorFeedback ?? localSub?.scoreFeedback,
        'myAnswerText': c.myAnswerText ?? localSub?.answerText,
        'isByAdmin': c.isByAdmin,
        'creatorName': c.creatorName ?? (c.isByAdmin ? 'مدیر سیستم' : (c.mentorName ?? 'راهبر')),
        'createdAt': c.createdAt ?? DateTime.now().subtract(const Duration(days: 2)),
        'durationDays': c.durationDays ?? 5,
      });
    }
    return list;
  }

  void _showSubmissionDialog(Map<String, dynamic> challenge) {
    final TextEditingController textCtrl = TextEditingController(text: challenge['myAnswerText']?.toString() ?? '');
    int tempSelectedOption = -1;
    String? attachedFileName;
    int currentStep = 0;
    List<dynamic> qList = (challenge['questions'] != null && challenge['questions'] is List)
        ? (challenge['questions'] as List)
        : [];
    List<int> answers = List.filled(qList.isEmpty ? 3 : qList.length, -1);

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            bool hasOptions = challenge['options'] != null && (challenge['options'] as List).isNotEmpty;
            bool isStepByStep = (challenge['type'] == 'step_by_step_quiz' || challenge['type'] == 'quiz') && qList.isNotEmpty;

            return Directionality(
              textDirection: TextDirection.rtl,
              child: Dialog(
                backgroundColor: const Color(0xFF1E1435),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                  side: BorderSide(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                challenge['title'],
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () => Navigator.pop(context),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'جایزه: ${challenge['reward'].toString().toPersianDigits()} زریک 🪙',
                            style: const TextStyle(
                              color: Color(0xFFFFD54F),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                        const Divider(color: Colors.white10, height: 24),

                        if (!isStepByStep) ...[
                          Text(
                            challenge['desc'] ?? '',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                              height: 1.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Descriptive Text Submission
                          const Text(
                            'پاسخ تشریحی خود را بنویسید:',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: textCtrl,
                            maxLines: 3,
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                            textAlign: TextAlign.right,
                            decoration: InputDecoration(
                              hintText: 'متن پاسخ شما برای راهبر کاروان...',
                              hintStyle: const TextStyle(color: Colors.white24, fontSize: 11, fontFamily: AppTheme.fontFamily),
                              filled: true,
                              fillColor: const Color(0xFF160E2A),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Colors.white10),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Colors.white10),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFF8B5CF6)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Multiple Choice
                          if (hasOptions) ...[
                            const Text(
                              'گزینه پاسخ صحیح را انتخاب کنید:',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ...List.generate((challenge['options'] as List).length, (index) {
                              bool isSel = tempSelectedOption == index;
                              return GestureDetector(
                                onTap: () {
                                  setDialogState(() {
                                    tempSelectedOption = index;
                                  });
                                },
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: isSel ? const Color(0xFF8B5CF6).withValues(alpha: 0.15) : const Color(0xFF160E2A),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSel ? const Color(0xFF8B5CF6) : Colors.white10,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 18,
                                        height: 18,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: isSel ? const Color(0xFF8B5CF6) : Colors.white30,
                                            width: 2,
                                          ),
                                          color: isSel ? const Color(0xFF8B5CF6) : Colors.transparent,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          challenge['options'][index],
                                          textAlign: TextAlign.right,
                                          style: TextStyle(
                                            color: isSel ? Colors.white : Colors.white70,
                                            fontSize: 12.5,
                                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }),
                            const SizedBox(height: 16),
                          ],

                          // File Upload Attachment Section
                          const Text(
                            'پیوست فایل تکلیف (عکس / صوت / مدرک):',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 8),
                          InkWell(
                            onTap: () {
                              setDialogState(() {
                                attachedFileName = 'فایل_تکلیف_نپا_${challenge['id'].toString().substring(0, 4)}.mp3';
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                              decoration: BoxDecoration(
                                color: const Color(0xFF160E2A),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    attachedFileName == null ? Icons.attach_file : Icons.check_circle_outline,
                                    color: attachedFileName == null ? Colors.white38 : const Color(0xFF10B981),
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    attachedFileName ?? 'انتخاب و پیوست فایل از دستگاه',
                                    style: TextStyle(
                                      color: attachedFileName == null ? Colors.white38 : const Color(0xFF10B981),
                                      fontSize: 12,
                                      fontWeight: attachedFileName == null ? FontWeight.normal : FontWeight.bold,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                        ] else ...[
                          // Step-by-step quiz UI
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD946EF).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'مرحله ${(currentStep + 1).toString().toPersianDigits()} از ${qList.length.toString().toPersianDigits()}',
                              style: const TextStyle(
                                color: Color(0xFFD946EF),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            qList[currentStep]['q'] ?? qList[currentStep]['question'] ?? qList[currentStep]['text'] ?? '',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              height: 1.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ...List.generate(((qList[currentStep]['options'] ?? qList[currentStep]['opts'] ?? []) as List).length, (index) {
                            final currentOpts = (qList[currentStep]['options'] ?? qList[currentStep]['opts'] ?? []) as List;
                            bool isSel = answers[currentStep] == index;
                            return GestureDetector(
                              onTap: () {
                                setDialogState(() {
                                  answers[currentStep] = index;
                                });
                              },
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  color: isSel ? const Color(0xFF8B5CF6).withValues(alpha: 0.15) : const Color(0xFF160E2A),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSel ? const Color(0xFF8B5CF6) : Colors.white10,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 18,
                                      height: 18,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isSel ? const Color(0xFF8B5CF6) : Colors.white30,
                                          width: 2,
                                        ),
                                        color: isSel ? const Color(0xFF8B5CF6) : Colors.transparent,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        currentOpts[index].toString(),
                                        textAlign: TextAlign.right,
                                        style: TextStyle(
                                          color: isSel ? Colors.white : Colors.white70,
                                          fontSize: 12.5,
                                          fontFamily: AppTheme.fontFamily,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                          const SizedBox(height: 24),
                        ],

                        // Submit Button
                        Container(
                          width: double.infinity,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)]),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: ElevatedButton(
                            onPressed: () {
                              if (isStepByStep) {
                                if (answers[currentStep] == -1) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'لطفاً یکی از گزینه‌ها را برای این مرحله انتخاب کنید.',
                                        style: TextStyle(fontFamily: AppTheme.fontFamily),
                                      ),
                                      backgroundColor: Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  return;
                                }
                                if (currentStep < qList.length - 1) {
                                  setDialogState(() {
                                    currentStep++;
                                  });
                                  return;
                                }
                              } else {
                                final String textValue = textCtrl.text.trim();
                                final bool hasText = textValue.isNotEmpty;
                                final bool hasFile = attachedFileName != null && attachedFileName!.trim().isNotEmpty;
                                final bool hasOption = hasOptions && tempSelectedOption != -1;

                                if (!hasText && !hasFile && !hasOption) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'فیلد پاسخ خالی است! لطفاً متن پاسخ یا فایل مورد نظر را وارد نمایید.',
                                        style: TextStyle(fontFamily: AppTheme.fontFamily),
                                      ),
                                      backgroundColor: Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  return;
                                }
                              }

                              Navigator.pop(context);

                              final repository = Provider.of<AppRepository>(context, listen: false);
                              if (isStepByStep) {
                                repository.submitAssignment(SubmissionModel(
                                  id: 's_${DateTime.now().millisecondsSinceEpoch}',
                                  challengeId: challenge['id'],
                                  studentId: repository.currentUser.id,
                                  studentName: repository.currentUser.name,
                                  answerText: 'کوییز مرحله‌ای پاسخ داده شد. پاسخ‌ها: $answers',
                                  submittedAt: DateTime.now(),
                                  status: 'approved',
                                  scoreFeedback: 'آزمون مرحله‌ای ثبت شد! ${challenge['reward']}+ زریک کسب کردید! 🎓🏆',
                                ));
                                repository.currentUser = UserModel(
                                  id: repository.currentUser.id,
                                  name: repository.currentUser.name,
                                  phoneNumber: repository.currentUser.phoneNumber,
                                  role: repository.currentUser.role,
                                  zarik: repository.currentUser.zarik + (challenge['reward'] as int),
                                  nakh: repository.currentUser.nakh,
                                  beyragh: repository.currentUser.beyragh,
                                  farsh: repository.currentUser.farsh,
                                  hasEvaluatedMentorThisSeason: repository.currentUser.hasEvaluatedMentorThisSeason,
                                );
                                HttpApiService().submitQuizChallenge(challenge['id'], answers);
                              } else {
                                String ansText = textCtrl.text;
                                if (attachedFileName != null) {
                                  ansText += '\nفایل: $attachedFileName';
                                }
                                if (tempSelectedOption != -1) {
                                  ansText += '\nگزینه انتخابی: $tempSelectedOption';
                                }
                                repository.submitAssignment(SubmissionModel(
                                  id: 's_${DateTime.now().millisecondsSinceEpoch}',
                                  challengeId: challenge['id'],
                                  studentId: repository.currentUser.id,
                                  studentName: repository.currentUser.name,
                                  answerText: ansText,
                                  submittedAt: DateTime.now(),
                                  status: 'pending',
                                ));
                              }

                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    isStepByStep
                                        ? 'آزمون مرحله‌ای ثبت شد! ${challenge['reward']}+ زریک کسب کردید! 🎓🏆'
                                        : 'پاسخ شما با موفقیت ثبت شد و برای راهبر کاروان ارسال گردید ✅',
                                    style: const TextStyle(fontFamily: AppTheme.fontFamily),
                                  ),
                                  backgroundColor: const Color(0xFF10B981),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: Text(
                              (isStepByStep && currentStep < qList.length - 1)
                                  ? 'مرحله بعدی ⬅️'
                                  : 'ثبت و ارسال نهایی چالش',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
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

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
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

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // 1. Top Bar: Gradient NOPA + Back button on Left, Hamburger Menu on Right
              _buildTopBar(),

              // 2. Main Scrollable Content: Slim Banner + Category Tabs + Challenge Cards
              Expanded(
                child: RefreshIndicator(
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
                        // 2.1 Compact Station Banner Carousel with 3 indicator dots
                        _buildStationBannerSlider(),

                        const SizedBox(height: 18),

                        // 2.2 Category Tabs: فردی / گروهی / میان گروهی
                        _buildCategoryTabsBar(),

                        const SizedBox(height: 18),

                        // 2.3 Challenge Cards List or Empty State
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
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Top Bar matching user design: Left = NOPA + بازگشت, Right = Hamburger Menu Button
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, top: 10, bottom: 6),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: NOPA Logo + Return / Back button
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 38,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [
                          Color(0xFFC09268),
                          Color(0xFFF4DCC5),
                        ],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ).createShader(bounds),
                      child: const Text(
                        'NOPA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: _handleBackAction,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 4, right: 8),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SvgPicture.asset(
                          'assets/svg_icons/back01.svg',
                          width: 17,
                          height: 17,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFFC7B299),
                            BlendMode.srcIn,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text(
                          'بازگشت',
                          style: TextStyle(
                            color: Color(0xFFC7B299),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // Right: Drawer Hamburger Menu Button (height 42)
            Builder(
              builder: (ctx) => Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => Scaffold.of(ctx).openDrawer(),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: Color(0xFF23223D),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.menu_rounded,
                        color: Color(0xFFC7B299),
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Compact Banner Slider with 3 indicator dots matching Home screen
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
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Banner Image
                      Image.asset(
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

                      // Soft dark vignette overlay
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.black.withValues(alpha: 0.25),
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.35),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),

                      // Glowing Center Badge matching screenshot
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'منزلگاه اول',
                              style: TextStyle(
                                color: Color(0xFFF4DCC5),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                                shadows: [
                                  Shadow(
                                    color: Color(0xCC000000),
                                    blurRadius: 4,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 3.5),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.55),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: const Color(0xFFDE9959).withValues(alpha: 0.7),
                                  width: 1.0,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFE5A86D).withValues(alpha: 0.3),
                                    blurRadius: 10,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                              child: const Text(
                                'کاروانسرای غبارگرفته',
                                style: TextStyle(
                                  color: Color(0xFFFFB366),
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  shadows: [
                                    Shadow(
                                      color: Color(0xFFDE9959),
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 8),

        // 3 Animated Dot Indicators matching Home Banner
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

  /// Category Tabs: فردی / گروهی / میان گروهی matching screenshot
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
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: tabs.map((tab) {
              final int idx = tab['index'] as int;
              final bool isSelected = _selectedCategoryIndex == idx;

              return GestureDetector(
                onTap: () => setState(() => _selectedCategoryIndex = idx),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: Text(
                    tab['title'] as String,
                    style: TextStyle(
                      color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF9D99B8),
                      fontSize: isSelected ? 16 : 14.5,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                      shadows: isSelected
                          ? [
                              Shadow(
                                color: const Color(0xFFDE9959).withValues(alpha: 0.4),
                                blurRadius: 8,
                              ),
                            ]
                          : null,
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

  /// Responsive Challenge Card with Title -> Status Tag -> Prize Icon -> Description & Participate Button
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
    Color statusColor = const Color(0xFF22C55E);
    Color statusBg = const Color(0xFF22C55E).withValues(alpha: 0.15);
    Color statusBorder = const Color(0xFF22C55E).withValues(alpha: 0.4);

    if (status == 'started') {
      statusLabel = 'شروع شده';
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
        padding: const EdgeInsets.all(1.2), // Gradient border
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Top Row: Title on Right -> Status Tag -> Prize Icon -> Expand Toggle
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
                child: Row(
                  children: [
                    // Right: Title (Flexible so it adapts smoothly to screen width)
                    Flexible(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Next: Status Tag (جدید / شروع شده / اصلاحیه / منقضی شده)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusBorder, width: 0.9),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Next: Zaric Reward Prize Badge with Gold Coin Icon
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF231E3D).withValues(alpha: 0.8),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFFDE9959).withValues(alpha: 0.5),
                          width: 0.9,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '+${reward.toString().toPersianDigits()}',
                            style: const TextStyle(
                              color: Color(0xFFF4DCC5),
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(width: 3),
                          const Icon(
                            Icons.monetization_on_rounded,
                            size: 13,
                            color: Color(0xFFFFD54F),
                          ),
                        ],
                      ),
                    ),

                    const Spacer(),

                    // Expand / Collapse Chevron Icon on the far left
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: const Color(0xFF9897D2),
                      size: 20,
                    ),
                  ],
                ),
              ),

              // 2. Challenge Description (متن توضیحات چالش)
              if (desc.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  desc,
                  textAlign: TextAlign.right,
                  maxLines: isExpanded ? 8 : 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFD3D0E3),
                    fontSize: 11.5,
                    height: 1.55,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],

              // 3. Mentor Feedback if rejected
              if (status == 'rejected' && feedback != null && feedback.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
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

              const SizedBox(height: 10),

              // 4. Bottom Row: Info on Right -> Participate Button on Left
              Row(
                children: [
                  // Right: Info chips (Type + Creation Date + Deadline)
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

                  // Left: Participate Button (دکمه شرکت در سمت چپ)
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
                        status == 'rejected' ? 'اصلاح و ارسال' : (status == 'started' ? 'ادامه' : 'شرکت'),
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
