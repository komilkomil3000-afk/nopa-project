import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/nopa_notification_dialog.dart';

class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});

  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  bool _showArchived = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppRepository>(context, listen: false).refreshChallenges();
    });
  }

  // Read reactively from AppRepository
  List<Map<String, dynamic>> _getChallenges(AppRepository repository) {
    final List<Map<String, dynamic>> list = [];
    final submissions = repository.submissions;

    for (var c in repository.challenges) {
      final hasApproved = submissions.any((s) => s.challengeId == c.id && s.status == 'approved');
      final hasPending = submissions.any((s) => s.challengeId == c.id && s.status == 'pending');
      final String status = hasApproved
          ? 'archived_completed'
          : (hasPending ? 'archived_pending' : 'active');

      list.add({
        'id': c.id,
        'title': c.title,
        'desc': c.description,
        'reward': c.rewardZarik,
        'type': c.type,
        'status': status,
        'questions': c.questions,
        'progress': c.progress,
      });
    }
    return list;
  }

  void _showSubmissionDialog(Map<String, dynamic> challenge) {
    final TextEditingController textCtrl = TextEditingController();
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
                                  fontFamily: 'Vazirmatn',
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
                            'جایزه: ${challenge['reward']} زریک 🪙',
                            style: const TextStyle(
                              color: Color(0xFFFFD54F),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
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
                              fontFamily: 'Vazirmatn',
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
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: textCtrl,
                            maxLines: 3,
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'Vazirmatn'),
                            textAlign: TextAlign.right,
                            decoration: InputDecoration(
                              hintText: 'متن پاسخ شما برای راهبر کاروان...',
                              hintStyle: const TextStyle(color: Colors.white24, fontSize: 11, fontFamily: 'Vazirmatn'),
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
                                fontFamily: 'Vazirmatn',
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
                                            fontFamily: 'Vazirmatn',
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
                              fontFamily: 'Vazirmatn',
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
                                      fontFamily: 'Vazirmatn',
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
                              'مرحله ${currentStep + 1} از ${qList.length}',
                              style: const TextStyle(
                                color: Color(0xFFD946EF),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
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
                              fontFamily: 'Vazirmatn',
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
                                          fontFamily: 'Vazirmatn',
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
                                if (answers[currentStep] == -1) return;
                                if (currentStep < qList.length - 1) {
                                  setDialogState(() {
                                    currentStep++;
                                  });
                                  return;
                                }
                              } else {
                                if (textCtrl.text.isEmpty && attachedFileName == null && tempSelectedOption == -1) return;
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
                                    style: const TextStyle(fontFamily: 'Vazirmatn'),
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
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
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

    // Filter challenges based on the active tab toggle
    final filtered = allChallenges.where((c) {
      if (_showArchived) {
        return c['status'] == 'archived_completed';
      } else {
        return c['status'] == 'active' || c['status'] == 'archived_pending';
      }
    }).toList();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () => repository.refreshChallenges(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              children: [
                // Top RTL Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: SafeArea(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Right: Title & Badge
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD946EF).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.emoji_events_rounded, color: Color(0xFFD946EF), size: 22),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'چالش‌ها و تکالیف نپا',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ],
                        ),

                        // Left: Actions (Notification & Drawer)
                        Row(
                          children: [
                            Consumer<AppRepository>(
                              builder: (context, repo, _) {
                                final count = repo.unreadNotificationsCount;
                                return Stack(
                                  children: [
                                    GestureDetector(
                                      onTap: () => NopaNotificationDialog.show(context),
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: Colors.black38,
                                          shape: BoxShape.circle,
                                          border: Border.all(color: Colors.white10),
                                        ),
                                        child: const Icon(Icons.notifications_none, color: Colors.white, size: 20),
                                      ),
                                    ),
                                    if (count > 0)
                                      Positioned(
                                        top: 2,
                                        right: 2,
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: const BoxDecoration(
                                            color: Colors.red,
                                            shape: BoxShape.circle,
                                          ),
                                          child: Text(
                                            '$count',
                                            style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      ),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(width: 8),
                            Builder(
                              builder: (menuContext) => GestureDetector(
                                onTap: () => Scaffold.of(menuContext).openDrawer(),
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.black38,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white10),
                                  ),
                                  child: const Icon(Icons.menu, color: Colors.white, size: 20),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Toggle active / archived (Active on Right, Archived on Left in RTL)
                _buildArchiveToggleButtons(),

                const SizedBox(height: 16),

                // Challenges list
                if (filtered.isEmpty)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1435),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.assignment_turned_in_outlined,
                            color: Color(0xFF8B5CF6),
                            size: 36,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _showArchived ? 'چالشی در آرشیو وجود ندارد' : 'در حال حاضر چالشی ابلاغ نشده است',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _showArchived
                              ? 'چالش‌های تکمیل شده یا ارزیابی شده شما در این بخش ذخیره می‌شوند.'
                              : 'به محض اینکه مربی یا مدیر کاروان چالش جدیدی برای شما ایجاد و ارسال کند، در این قسمت نمایش داده خواهد شد.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 12,
                            height: 1.5,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      return _buildChallengeItemCard(item);
                    },
                  ),

                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildArchiveToggleButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          // Active Challenges Button (Right in RTL)
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showArchived = false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  color: !_showArchived ? const Color(0xFFEC4899) : const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: !_showArchived ? const Color(0xFFEC4899) : Colors.white.withValues(alpha: 0.05),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'چالش‌های فعال ⚡',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Archived Challenges Button (Left in RTL)
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showArchived = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  color: _showArchived ? const Color(0xFF8B5CF6) : const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _showArchived ? const Color(0xFF8B5CF6) : Colors.white.withValues(alpha: 0.05),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'آرشیو شده‌ها 📂',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChallengeItemCard(Map<String, dynamic> item) {
    bool isCompleted = item['status'] == 'archived_completed';
    bool isPending = item['status'] == 'archived_pending';

    return Container(
      margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isCompleted 
              ? const Color(0xFF10B981).withValues(alpha: 0.3)
              : (isPending ? const Color(0xFFFFD54F).withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.04)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Challenge Title (Right in RTL)
              Expanded(
                child: Text(
                  item['title'],
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Status Badge (Left in RTL)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isCompleted 
                      ? const Color(0xFF10B981).withValues(alpha: 0.15)
                      : (isPending ? const Color(0xFFFFD54F).withValues(alpha: 0.15) : const Color(0xFF8B5CF6).withValues(alpha: 0.15)),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isCompleted 
                        ? const Color(0xFF10B981).withValues(alpha: 0.4)
                        : (isPending ? const Color(0xFFFFD54F).withValues(alpha: 0.4) : const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                  ),
                ),
                child: Text(
                  isCompleted ? 'کامل شده' : (isPending ? 'در انتظار بررسی' : 'فعال'),
                  style: TextStyle(
                    color: isCompleted ? const Color(0xFF10B981) : (isPending ? const Color(0xFFFFD54F) : const Color(0xFF8B5CF6)),
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item['desc'] ?? '',
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              height: 1.45,
              fontFamily: 'Vazirmatn',
            ),
          ),
          const SizedBox(height: 14),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Reward text (Right in RTL)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFD54F).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'جایزه: ${item['reward']} زریک 🪙',
                  style: const TextStyle(
                    color: Color(0xFFFFD54F),
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ),

              // Action button (Left in RTL)
              if (!isCompleted && !isPending)
                ElevatedButton.icon(
                  onPressed: () => _showSubmissionDialog(item),
                  icon: const Icon(Icons.send_rounded, size: 14, color: Colors.white),
                  label: const Text(
                    'پاسخ و ارسال تکلیف',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEC4899),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                )
              else if (isPending)
                const Text(
                  'پاسخ شما برای راهبر ارسال شده است',
                  style: TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'Vazirmatn'),
                )
              else
                const Text(
                  'این چالش با موفقیت ثبت نهایی شده است ✅',
                  style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
