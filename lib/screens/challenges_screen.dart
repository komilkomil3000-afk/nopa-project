import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../core/theme/app_theme.dart';
import 'mentor_challenge_details_screen.dart';

class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});

  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
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
        status = 'pending';
      } else if (rawStatus == 'rejected') {
        status = 'rejected';
      } else if (rawStatus == 'expired') {
        status = 'expired';
      } else if (rawStatus == 'started') {
        status = 'started';
      } else {
        status = 'started';
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

    // Ensure requested sample challenges exist for complete demonstration
    final bool hasPendingIndividual = list.any((c) => c['category'] == 'individual' && c['status'] == 'pending');
    final bool hasStartedIndividual = list.any((c) => c['category'] == 'individual' && (c['status'] == 'started' || c['status'] == 'new'));
    final bool hasExpiredIndividual = list.any((c) => c['category'] == 'individual' && c['status'] == 'expired');
    final bool hasGroup = list.any((c) => c['category'] == 'group');
    final bool hasInterGroup = list.any((c) => c['category'] == 'inter_group');

    if (!hasPendingIndividual) {
      list.insert(0, {
        'id': 'demo_indiv_pending',
        'title': 'تحلیل و گزارش کاروان اول',
        'desc': 'پاسخ شما برای بررسی به راهبر کاروان ارسال شده و در حال ارزیابی نهایی است.',
        'reward': 60,
        'type': 'text',
        'status': 'pending',
        'category': 'individual',
        'myAnswerText': 'پروژه تحلیل منزلگاه با موفقیت ارسال شد.',
        'creatorName': 'رضا جلالی (راهبر کاروان)',
        'createdAt': DateTime.now().subtract(const Duration(days: 1)),
        'durationDays': 4,
      });
    }

    if (!hasStartedIndividual) {
      list.add({
        'id': 'demo_indiv_started',
        'title': 'مهارت‌آموزی دیجیتال و کار با نقشه',
        'desc': 'چالش فعال برای تمرین مهارت‌های کاروان و کسب امتیاز زریک.',
        'reward': 50,
        'type': 'choice',
        'status': 'started',
        'category': 'individual',
        'creatorName': 'مدیر سیستم',
        'createdAt': DateTime.now().subtract(const Duration(hours: 12)),
        'durationDays': 5,
      });
    }

    if (!hasExpiredIndividual) {
      list.add({
        'id': 'demo_indiv_expired',
        'title': 'آزمون هفتگی پیشینه و مسیر کاروان',
        'desc': 'مهلت شرکت و ارسال پاسخ در این چالش به پایان رسیده است.',
        'reward': 40,
        'type': 'text',
        'status': 'expired',
        'category': 'individual',
        'creatorName': 'راهبر کاروان',
        'createdAt': DateTime.now().subtract(const Duration(days: 7)),
        'durationDays': 3,
      });
    }

    if (!hasGroup) {
      list.add({
        'id': 'demo_group_1',
        'title': 'پروژه همکاری تیمی کاروان',
        'desc': 'همکاری و تعامل اعضای کاروان در تدوین و ارائه دستاورد مشترک تیمی.',
        'reward': 120,
        'type': 'file',
        'status': 'started',
        'category': 'group',
        'creatorName': 'رضا جلالی (راهبر کاروان)',
        'createdAt': DateTime.now().subtract(const Duration(days: 1)),
        'durationDays': 7,
      });
    }

    if (!hasInterGroup) {
      list.add({
        'id': 'demo_intergroup_1',
        'title': 'مناظره و رقابت میان کاروان‌ها',
        'desc': 'رقابت جذاب حل مسئله و سرعت عمل میان اعضای کاروان‌های مختلف نپا.',
        'reward': 200,
        'type': 'text',
        'status': 'started',
        'category': 'inter_group',
        'creatorName': 'مدیر سیستم',
        'createdAt': DateTime.now().subtract(const Duration(days: 2)),
        'durationDays': 10,
      });
    }

    return list;
  }

  /// Interactive Question Dialog matching exact reference designs
  void _showSubmissionDialog(Map<String, dynamic> challenge) {
    final TextEditingController textCtrl = TextEditingController(text: challenge['myAnswerText']?.toString() ?? '');
    int selectedOptionIndex = -1;
    String? attachedFileName;

    final String type = challenge['type']?.toString().toLowerCase() ?? '';
    final List<dynamic> qList = (challenge['questions'] != null && challenge['questions'] is List)
        ? (challenge['questions'] as List)
        : [];
    final bool isMultipleChoice = type == 'quiz' ||
        type == 'step_by_step_quiz' ||
        type == 'multiple_choice' ||
        qList.isNotEmpty ||
        (challenge['options'] != null && (challenge['options'] as List).isNotEmpty);

    // Extract options
    List<String> options = [];
    String questionText = challenge['desc'] ?? '';
    if (qList.isNotEmpty) {
      final firstQ = qList[0];
      if (firstQ is Map) {
        questionText = firstQ['q'] ?? firstQ['question'] ?? firstQ['text'] ?? questionText;
        final rawOpts = firstQ['options'] ?? firstQ['opts'];
        if (rawOpts is List) {
          options = rawOpts.map((e) => e.toString()).toList();
        }
      }
    } else if (challenge['options'] != null && challenge['options'] is List) {
      options = (challenge['options'] as List).map((e) => e.toString()).toList();
    }
    if (options.isEmpty && isMultipleChoice) {
      options = [
        'پاسخ شماره اول',
        'پاسخ شماره دوم',
        'پاسخ شماره سوم',
        'پاسخ شماره چهارم',
      ];
    }

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: Dialog(
                backgroundColor: const Color(0xFF28274A),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                  side: BorderSide(
                    color: const Color(0xFF5A588B).withValues(alpha: 0.5),
                    width: 1.2,
                  ),
                ),
                insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 1. Top Header: Flame/Challenge Icon on Left + Title centered
                        Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFF7E72B8).withValues(alpha: 0.35),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.local_fire_department_rounded,
                                  color: Color(0xFF9E92E8),
                                  size: 22,
                                ),
                              ),
                            ),
                            const Expanded(
                              child: Center(
                                child: Text(
                                  'شرکت در چالش',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 36), // Symmetrical balance for center title
                          ],
                        ),

                        const SizedBox(height: 20),

                        // 2. Row: تیتر: | Title
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Pill Badge "تیتر:"
                            _buildDialogPillBadge('تیتر:'),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                challenge['title'] ?? '',
                                style: const TextStyle(
                                  color: Color(0xFFD6D3E6),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),

                        // 3. Row: سوال: | Question
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Pill Badge "سوال:"
                            _buildDialogPillBadge(isMultipleChoice ? 'سوال۱:' : 'سوال:'),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                questionText.isNotEmpty ? questionText : 'توضیحات تکمیلی این چالش',
                                style: const TextStyle(
                                  color: Color(0xFFD6D3E6),
                                  fontSize: 12.5,
                                  height: 1.5,
                                  fontWeight: FontWeight.w500,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),

                        // 4. Input Area: Multiple Choice OR Descriptive Text + File Picker
                        if (isMultipleChoice) ...[
                          // Multiple Choice Options List matching photo
                          ...List.generate(options.length, (index) {
                            final bool isSelected = selectedOptionIndex == index;
                            final String optionNumber = (index + 1).toString().toPersianDigits();

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10.0),
                              child: GestureDetector(
                                onTap: () {
                                  setDialogState(() {
                                    selectedOptionIndex = index;
                                  });
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? const Color(0xFF383568)
                                        : const Color(0xFF1E1D38),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSelected
                                          ? const Color(0xFF9292E2)
                                          : const Color(0xFF454270),
                                      width: isSelected ? 1.4 : 1.0,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      // Option Number on Right in RTL
                                      Text(
                                        optionNumber,
                                        style: TextStyle(
                                          color: isSelected
                                              ? const Color(0xFFDE9959)
                                              : const Color(0xFF8E88B0),
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: AppTheme.fontFamily,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      // Option Text
                                      Expanded(
                                        child: Text(
                                          options[index],
                                          style: TextStyle(
                                            color: isSelected
                                                ? Colors.white
                                                : const Color(0xFFD3D0E3),
                                            fontSize: 12,
                                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ] else ...[
                          // Descriptive Question Area (پاسخ:)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildDialogPillBadge('پاسخ:'),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextField(
                                  controller: textCtrl,
                                  maxLines: 4,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                  textAlign: TextAlign.right,
                                  decoration: InputDecoration(
                                    hintText: 'پاسخ تشریحی خود را بنویسید...',
                                    hintStyle: const TextStyle(
                                      color: Color(0xFF7E789F),
                                      fontSize: 11.5,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                    filled: true,
                                    fillColor: const Color(0xFF1E1D38),
                                    contentPadding: const EdgeInsets.all(12),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFF454270)),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFF454270)),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFF9292E2)),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 14),

                          // File Attachment Row (پیوست فایل:)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              _buildDialogPillBadge('پیوست فایل:'),
                              const SizedBox(width: 12),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () async {
                                    try {
                                      final result = await FilePicker.platform.pickFiles(
                                        type: FileType.any,
                                        allowMultiple: false,
                                      );
                                      if (result != null && result.files.isNotEmpty) {
                                        setDialogState(() {
                                          attachedFileName = result.files.first.name;
                                        });
                                      }
                                    } catch (e) {
                                      debugPrint('FilePicker error: $e');
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1E1D38),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: const Color(0xFF454270)),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            attachedFileName ?? 'انتخاب فایل از دستگاه',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: attachedFileName == null
                                                  ? const Color(0xFF7E789F)
                                                  : const Color(0xFF22C55E),
                                              fontSize: 11.5,
                                              fontWeight: attachedFileName == null ? FontWeight.normal : FontWeight.bold,
                                              fontFamily: AppTheme.fontFamily,
                                            ),
                                          ),
                                        ),
                                        Icon(
                                          attachedFileName == null ? Icons.attach_file : Icons.check_circle_outline,
                                          color: attachedFileName == null ? const Color(0xFF7E789F) : const Color(0xFF22C55E),
                                          size: 16,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],

                          const SizedBox(height: 24),

                          // 5. Bottom Action Row: ارسال (Right) | لغو (Left)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // لغو Button on Left in RTL
                              TextButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text(
                                  'لغو',
                                  style: TextStyle(
                                    color: Color(0xFF9D99B8),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ),

                              // ارسال Button on Right in RTL
                              TextButton(
                                onPressed: () {
                                  if (isMultipleChoice) {
                                    if (selectedOptionIndex == -1) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('لطفاً یکی از گزینه‌ها را انتخاب کنید.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                          backgroundColor: Color(0xFFEF4444),
                                        ),
                                      );
                                      return;
                                    }
                                  } else {
                                    final String textValue = textCtrl.text.trim();
                                    final bool hasText = textValue.isNotEmpty;
                                    final bool hasFile = attachedFileName != null && attachedFileName!.trim().isNotEmpty;
                                    if (!hasText && !hasFile) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('لطفاً متن پاسخ یا فایل را وارد نمایید.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                          backgroundColor: Color(0xFFEF4444),
                                        ),
                                      );
                                      return;
                                    }
                                  }

                                  Navigator.pop(context);

                                  final repository = Provider.of<AppRepository>(context, listen: false);
                                  if (isMultipleChoice) {
                                    repository.submitAssignment(SubmissionModel(
                                      id: 's_${DateTime.now().millisecondsSinceEpoch}',
                                      challengeId: challenge['id'],
                                      studentId: repository.currentUser.id,
                                      studentName: repository.currentUser.name,
                                      answerText: 'گزینه انتخابی: ${(selectedOptionIndex + 1).toString().toPersianDigits()}',
                                      submittedAt: DateTime.now(),
                                      status: 'approved',
                                      scoreFeedback: 'پاسخ ثبت شد و ${challenge['reward']} زریک به حساب شما اضافه شد.',
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
                                    HttpApiService().submitQuizChallenge(challenge['id'], [selectedOptionIndex]);
                                  } else {
                                    String ansText = textCtrl.text;
                                    if (attachedFileName != null) {
                                      ansText += '\nفایل: $attachedFileName';
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
                                    const SnackBar(
                                      content: Text(
                                        'با موفقیت ارسال شد',
                                        style: TextStyle(fontFamily: AppTheme.fontFamily),
                                        textAlign: TextAlign.right,
                                      ),
                                      backgroundColor: Color(0xFF10B981),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                                child: const Text(
                                  'ارسال',
                                  style: TextStyle(
                                    color: Color(0xFFDE9959),
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

  static Widget _buildDialogPillBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF383562),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF535084), width: 1.0),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFD6D3E6),
          fontSize: 11,
          fontWeight: FontWeight.bold,
          fontFamily: AppTheme.fontFamily,
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _getMentorChallenges(AppRepository repository) {
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

      final String statusTag;
      final Color statusColor;
      if (rawStatus == 'approved' || rawStatus == 'completed') {
        statusTag = 'تایید شده';
        statusColor = const Color(0xFF22C55E);
      } else if (rawStatus == 'pending') {
        statusTag = 'در انتظار بررسی';
        statusColor = const Color(0xFFEAB308);
      } else if (rawStatus == 'rejected') {
        statusTag = 'نیاز به اصلاح';
        statusColor = const Color(0xFFEF4444);
      } else if (rawStatus == 'expired') {
        statusTag = 'منقضی';
        statusColor = const Color(0xFF9E9AC0);
      } else {
        statusTag = 'جدید';
        statusColor = const Color(0xFF22C55E);
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
        'typeLabel': _resolveChallengeTypeLabel(c.type),
        'createdDate': _formatPersianDate(c.createdAt),
        'durationDays': c.durationDays ?? 5,
        'category': category,
        'desc': c.description,
        'actionLabel': rawStatus == 'pending' ? 'بررسی پاسخ‌ها' : (rawStatus == 'rejected' ? 'ویرایش پاسخ' : 'مشاهده'),
      });
    }

    if (list.isEmpty) {
      return [
        {
          'id': 'm_ch_1',
          'title': 'پوسترینو',
          'creatorName': repository.currentUser.name.isNotEmpty ? repository.currentUser.name : 'راهبر کاروان',
          'statusTag': 'جدید',
          'statusColor': const Color(0xFF22C55E),
          'reward': 50,
          'typeLabel': 'تستی',
          'createdDate': '15/08/1405',
          'durationDays': 5,
          'category': 'intra_group',
          'desc': 'چالش تستی طراحی پوستر و استفاده از خلاقیت فردی در ارائه پیام موثر.',
          'actionLabel': 'مشاهده',
        },
      ];
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
                  decoration: BoxDecoration(
                    color: const Color(0xFF2C2849),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 24,
                        spreadRadius: 2,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
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
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'چالش "${titleCtrl.text}" با موفقیت ایجاد و برای کاروان ابلاغ شد 🏆',
                                      style: const TextStyle(fontFamily: AppTheme.fontFamily),
                                    ),
                                    backgroundColor: const Color(0xFF10B981),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
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
              decoration: BoxDecoration(
                color: const Color(0xFF2C2849),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 24,
                    spreadRadius: 2,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
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
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'پیام "${titleCtrl.text}" با موفقیت برای اعضای کاروان ارسال شد ✉️',
                                  style: const TextStyle(fontFamily: AppTheme.fontFamily),
                                ),
                                backgroundColor: const Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
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
    String statusLabel = 'شروع شده';
    Color statusColor = const Color(0xFFE5A86D);
    Color statusBg = const Color(0xFFE5A86D).withValues(alpha: 0.15);
    Color statusBorder = const Color(0xFFE5A86D).withValues(alpha: 0.4);

    if (status == 'pending') {
      statusLabel = 'در حال انجام';
      statusColor = const Color(0xFF38BDF8);
      statusBg = const Color(0xFF38BDF8).withValues(alpha: 0.15);
      statusBorder = const Color(0xFF38BDF8).withValues(alpha: 0.4);
    } else if (status == 'started' || status == 'new') {
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
