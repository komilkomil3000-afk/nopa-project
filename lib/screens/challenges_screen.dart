import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../utils/global_state.dart';
import '../services/app_state_repository.dart';
import '../models/models.dart';
import '../widgets/nopa_notification_dialog.dart';


class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});

  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  bool _showArchived = false;

  int get _userZarikPoints {
    return Provider.of<AppRepository>(context, listen: false).currentUser.zarik;
  }
  

  // Read reactively from AppRepository
  List<Map<String, dynamic>> get _challenges {
    final repository = Provider.of<AppRepository>(context, listen: false);
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
    List<int> answers = [-1, -1, -1];

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            bool hasOptions = challenge['options'] != null && (challenge['options'] as List).isNotEmpty;
            bool isStepByStep = challenge['type'] == 'step_by_step_quiz';

            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        challenge['title'],
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'جایزه: ${challenge['reward']} زریک 🪙',
                        style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                      const Divider(color: Colors.white10),
                      const SizedBox(height: 10),
                      
                      if (!isStepByStep) ...[
                        Text(
                          challenge['desc'],
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 16),
                        
                        // Descriptive Text Submission
                        const Text('پاسخ تشریحی خود را بنویسید:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                        const SizedBox(height: 6),
                        TextField(
                          controller: textCtrl,
                          maxLines: 3,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          textAlign: TextAlign.right,
                          decoration: InputDecoration(
                            hintText: 'متن پاسخ شما...',
                            hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                            filled: true,
                            fillColor: const Color(0xFF160E2A),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 16),
                        
                        // Multiple Choice
                        if (hasOptions) ...[
                          const Text('گزینه پاسخ صحیح را انتخاب کنید:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
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
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      challenge['options'][index],
                                      style: TextStyle(
                                        color: isSel ? Colors.white : Colors.white70,
                                        fontSize: 12,
                                        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                        fontFamily: 'Vazirmatn',
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Container(
                                      width: 16,
                                      height: 16,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(color: isSel ? const Color(0xFF8B5CF6) : Colors.white30),
                                        color: isSel ? const Color(0xFF8B5CF6) : Colors.transparent,
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
                        const Text('پیوست فایل تکلیف (عکس/مدرک):', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: () {
                            setDialogState(() {
                              attachedFileName = 'تصویر_تکلیف_نپا_${challenge['id']}.jpg';
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
                                  attachedFileName ?? 'انتخاب فایل از دستگاه',
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
                        
                        // Share Button
                        OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('لینک مستقیم چالش جهت ارسال در پیام‌رسان‌ها کپی شد 🔗', style: TextStyle(fontFamily: 'Vazirmatn')),
                                backgroundColor: Color(0xFF8B5CF6),
                              ),
                            );
                          },
                          icon: const Icon(Icons.share, color: Color(0xFFEC4899), size: 16),
                          label: const Text(
                            'ارسال و هماهنگی از طریق پیام‌رسان‌های مجازی',
                            style: TextStyle(color: Color(0xFFEC4899), fontSize: 11, fontFamily: 'Vazirmatn'),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFEC4899)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            minimumSize: const Size(double.infinity, 44),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ] else ...[
                        // Step-by-step quiz UI
                        Text(
                          'مرحله ${currentStep + 1} از ${challenge['questions'].length}',
                          style: const TextStyle(color: Color(0xFFD946EF), fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          challenge['questions'][currentStep]['q'],
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 12),
                        ...List.generate(challenge['questions'][currentStep]['options'].length, (index) {
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
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Text(
                                    challenge['questions'][currentStep]['options'][index],
                                    style: TextStyle(
                                      color: isSel ? Colors.white : Colors.white70,
                                      fontSize: 12,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    width: 16,
                                    height: 16,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(color: isSel ? const Color(0xFF8B5CF6) : Colors.white30),
                                      color: isSel ? const Color(0xFF8B5CF6) : Colors.transparent,
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
                              if (currentStep < challenge['questions'].length - 1) {
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
                                      : 'پاسخ شما با موفقیت ثبت شد و در انتظار ارزیابی راهبر قرار گرفت ✅',
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
                            (isStepByStep && currentStep < challenge['questions'].length - 1)
                                ? 'مرحله بعدی ➡️'
                                : 'ثبت و ارسال نهایی چالش',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                          ),
                        ),
                      ),
                    ],
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
    // Filter challenges based on the active tab toggle
    final filtered = _challenges.where((c) {
      if (_showArchived) {
        return c['status'] == 'archived_completed';
      } else {
        return c['status'] == 'active' || c['status'] == 'archived_pending';
      }
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Custom Header (Hamburger leftmost, Bell next to it, LTR forced)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: SafeArea(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Row(
                        children: [
                          // Hamburger Menu Button (Leftmost)
                          Builder(
                            builder: (menuContext) => GestureDetector(
                              onTap: () {
                                Scaffold.of(menuContext).openDrawer();
                              },
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: Colors.black38,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white10),
                                ),
                                child: const Icon(Icons.menu, color: Colors.white, size: 22),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Consumer<AppRepository>(
                            builder: (context, repository, _) {
                              final count = repository.unreadNotificationsCount;
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
                                      child: const Icon(Icons.notifications_none, color: Colors.white, size: 22),
                                    ),
                                  ),
                                  if (count > 0)
                                    Positioned(
                                      right: 2,
                                      top: 2,
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
                        ],
                      ),
                    ),
                    const Text(
                      'چالش‌ها و تکالیف نپا',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                  ],
                ),
              ),
            ),

            // Top Member stats dashboard
            _buildMemberPerformanceHeader(),
            

            const SizedBox(height: 20),
            
            // Toggle active / archived
            _buildArchiveToggleButtons(),
            
            const SizedBox(height: 16),
            
            // Challenges list
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40.0),
                child: Center(
                  child: Text(
                    _showArchived ? 'چالشی در آرشیو وجود ندارد' : 'تمام چالش‌های فعال انجام شده‌اند! 🎉',
                    style: const TextStyle(color: Colors.white30, fontSize: 13, fontFamily: 'Vazirmatn'),
                  ),
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
            
            const SizedBox(height: 20),

            // Support Tickets Section
            _buildMemberTicketsSection(),

            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildMemberTicketsSection() {
    final ticketsList = GlobalState.tickets;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Icon(Icons.chat_bubble_outline, color: Colors.white54, size: 20),
              Text(
                'سوالات و تیکت‌های پشتیبانی درسی شما',
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
            ],
          ),
          const Divider(color: Colors.white10, height: 20),
          if (ticketsList.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 20.0),
                child: Text(
                  'تیکتی ثبت نکرده‌اید. برای ثبت به صفحه کلاس مراجعه کنید.',
                  style: TextStyle(color: Colors.white30, fontSize: 11, fontFamily: 'Vazirmatn'),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: ticketsList.length,
              itemBuilder: (context, index) {
                final ticket = ticketsList[index];
                final isAnswered = ticket['status'] == 'answered';
                final int rating = ticket['rating'] ?? 0;

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF160E2A),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isAnswered
                                  ? const Color(0xFF10B981).withValues(alpha: 0.12)
                                  : const Color(0xFFFFD54F).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isAnswered ? 'پاسخ داده شده ✅' : 'در انتظار پاسخ ⏳',
                              style: TextStyle(
                                color: isAnswered ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ),
                          Text(
                            'سوال از: ${ticket['teacher']}',
                            style: const TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        ticket['message'],
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                      if (isAnswered) ...[
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1435),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.2)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text(
                                'پاسخ راهبر:',
                                style: TextStyle(color: Color(0xFFD946EF), fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                ticket['answer'] ?? '',
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Rating star bar
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: List.generate(5, (starIdx) {
                                final starVal = starIdx + 1;
                                final isLit = starVal <= rating;
                                return GestureDetector(
                                  onTap: rating > 0
                                      ? null
                                      : () {
                                          setState(() {
                                            ticket['rating'] = starVal;
                                          });
                                          Provider.of<AppRepository>(context, listen: false).rateMentor('alavi', starVal.toDouble(), 'امتیاز به راهنمایی راهبر');
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('امتیاز شما به راهبر ثبت شد ⭐', style: TextStyle(fontFamily: 'Vazirmatn')),
                                              backgroundColor: Color(0xFF10B981),
                                            ),
                                          );
                                        },
                                  child: Icon(
                                    isLit ? Icons.star : Icons.star_border,
                                    color: const Color(0xFFFFD54F),
                                    size: 18,
                                  ),
                                );
                              }),
                            ),
                            const Text(
                              'امتیازدهی به راهنمایی راهبر:',
                              style: TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'Vazirmatn'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildMemberPerformanceHeader() {
    final user = Provider.of<AppRepository>(context).currentUser;
    final hasMentor = user.caravanMentor != null && user.caravanMentor!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
      ),
      child: Row(
        children: [
          // Zarik Points
          Expanded(
            child: Column(
              children: [
                const Text('امتیازات تا کنون', style: TextStyle(color: Colors.white54, fontSize: 11)),
                const SizedBox(height: 4),
                Text(
                  '$_userZarikPoints زریک 🪙',
                  style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 40, color: Colors.white10),
          // Mentor Satisfaction
          Expanded(
            child: Column(
              children: [
                const Text('رضایت راهبر از شما', style: TextStyle(color: Colors.white54, fontSize: 11)),
                const SizedBox(height: 4),
                if (!hasMentor)
                  const Text(
                    'تعیین نشده',
                    style: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn'),
                  )
                else
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.star, color: Color(0xFFFFD54F), size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${user.satisfactionScore > 0 ? user.satisfactionScore : 4.8} از ۵',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
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

  Widget _buildArchiveToggleButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showArchived = true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: _showArchived ? const Color(0xFF8B5CF6) : const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
                ),
                child: const Center(
                  child: Text('آرشیو شده‌ها 📂', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _showArchived = false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: !_showArchived ? const Color(0xFFEC4899) : const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
                ),
                child: const Center(
                  child: Text('چالش‌های فعال ⚡', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
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
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isCompleted 
                      ? const Color(0xFF10B981).withValues(alpha: 0.12)
                      : (isPending ? const Color(0xFFFFD54F).withValues(alpha: 0.12) : const Color(0xFF8B5CF6).withValues(alpha: 0.12)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isCompleted ? 'کامل شده' : (isPending ? 'در انتظار بررسی' : 'فعال'),
                  style: TextStyle(
                    color: isCompleted ? const Color(0xFF10B981) : (isPending ? const Color(0xFFFFD54F) : const Color(0xFF8B5CF6)),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Text(
                item['title'],
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item['desc'],
            textAlign: TextAlign.right,
            style: const TextStyle(color: Colors.white60, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 12),
          
          Row(
            children: [
              if (!isCompleted && !isPending)
                ElevatedButton(
                  onPressed: () => _showSubmissionDialog(item),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEC4899),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('پاسخ و ارسال تکلیف', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                )
              else if (isPending)
                const Text('پاسخ شما برای راهبر ارسال شده است', style: TextStyle(color: Colors.white38, fontSize: 11))
              else
                const Text('این چالش با موفقیت ثبت نهایی شده است', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
              
              const Spacer(),
              Text('جایزه: ${item['reward']} زریک', style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

}
