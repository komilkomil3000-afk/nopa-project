import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../models/user_model.dart';
import '../services/app_state_repository.dart';

class MentorChallengeDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> challenge;
  final UserModel? user;

  const MentorChallengeDetailsScreen({
    super.key,
    required this.challenge,
    this.user,
  });

  @override
  State<MentorChallengeDetailsScreen> createState() => _MentorChallengeDetailsScreenState();
}

class _MentorChallengeDetailsScreenState extends State<MentorChallengeDetailsScreen> {
  final Set<String> _expandedParticipantIds = {'part_1'};

  late List<Map<String, dynamic>> _participants;

  @override
  void initState() {
    super.initState();
    _participants = _generateInitialParticipants();
  }

  List<Map<String, dynamic>> _generateInitialParticipants() {
    final typeLabel = widget.challenge['typeLabel']?.toString() ?? 'تستی';
    final createdDate = widget.challenge['createdDate']?.toString() ?? '15/08/1405';

    return [
      {
        'id': 'part_1',
        'name': 'محمد حسینی',
        'typeLabel': typeLabel,
        'createdDate': createdDate,
        'answerDate': '15/08/1405',
        'questionText': 'وقتی معلم نیاد سر کلاس دقیقا چیکار میکنی؟',
        'userAnswer': '۱. سوال نذاره میریم خونه',
        'status': 'pending', // 'pending', 'approved', 'needs_revision'
        'feedback': '',
      },
      {
        'id': 'part_2',
        'name': 'علی رضایی',
        'typeLabel': typeLabel,
        'createdDate': createdDate,
        'answerDate': '15/08/1405',
        'questionText': 'وقتی معلم نیاد سر کلاس دقیقا چیکار میکنی؟',
        'userAnswer': '۲. تکالیف جلسه بعد رو انجام میدیم',
        'status': 'pending',
        'feedback': '',
      },
      {
        'id': 'part_3',
        'name': 'زهرا محمدی',
        'typeLabel': typeLabel,
        'createdDate': createdDate,
        'answerDate': '14/08/1405',
        'questionText': 'وقتی معلم نیاد سر کلاس دقیقا چیکار میکنی؟',
        'userAnswer': '۳. با بچه‌ها تمرین مباحث قبلی رو انجام میدیم',
        'status': 'approved',
        'feedback': '',
      },
      {
        'id': 'part_4',
        'name': 'مهدی صادقی',
        'typeLabel': typeLabel,
        'createdDate': createdDate,
        'answerDate': '14/08/1405',
        'questionText': 'وقتی معلم نیاد سر کلاس دقیقا چیکار میکنی؟',
        'userAnswer': '۴. منتظر اعلام نماینده کلاس می‌مونیم',
        'status': 'needs_revision',
        'feedback': 'پاسخ ارسالی نیاز به توضیح تکمیلی دارد.',
      },
    ];
  }

  void _showRevisionDialog(Map<String, dynamic> participant) {
    final name = participant['name']?.toString() ?? '';
    final subjectCtrl = TextEditingController(text: 'اصلاح پاسخ چالش');
    final explanationCtrl = TextEditingController();
    final dateStr = '1405/05/05';

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xFF2C274A),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: const Color(0xFF4C4578),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Header: Shield Icon Badge + Title
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF3F3765),
                              border: Border.all(
                                color: const Color(0xFFC09268).withValues(alpha: 0.7),
                                width: 1.2,
                              ),
                            ),
                            child: const Icon(
                              Icons.person_outline_rounded,
                              color: Color(0xFFDFB690),
                              size: 22,
                            ),
                          ),
                        ),
                        const Text(
                          'پیام به دانش آموز',
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 17.5,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // Field 1: نام و نام خانوادگی
                    _buildDialogRow('نام و نام خانوادگی', name),
                    const SizedBox(height: 12),

                    // Field 2: تاریخ
                    _buildDialogRow('تاریخ', dateStr),
                    const SizedBox(height: 12),

                    // Field 3: موضوع:
                    _buildDialogRow('موضوع:', subjectCtrl.text),
                    const SizedBox(height: 12),

                    // Field 4: شرح دهید: (Multiline)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(
                          width: 85,
                          child: Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text(
                              'شرح دهید:',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                                color: Color(0xFFC7C5DD),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Container(
                            height: 110,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E1A38),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFF4C4578),
                                width: 1.0,
                              ),
                            ),
                            child: TextField(
                              controller: explanationCtrl,
                              maxLines: 4,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              decoration: const InputDecoration(
                                isDense: true,
                                hintText: 'توضیحات تان درمورد تصمیم تان را برای عضو مورد نظر بنویسید',
                                hintStyle: TextStyle(
                                  color: Color(0xFF8882A8),
                                  fontSize: 11.5,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                                border: InputBorder.none,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Bottom Action Buttons: ارسال & لغو
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            setState(() {
                              participant['status'] = 'needs_revision';
                              participant['feedback'] = explanationCtrl.text.trim();
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'پیام اصلاحیه با موفقیت برای $name ارسال شد ✉️',
                                  style: const TextStyle(fontFamily: AppTheme.fontFamily),
                                ),
                                backgroundColor: const Color(0xFFEAB308),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          child: const Text(
                            'ارسال',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFE5A855),
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text(
                            'لغو',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF9E9CD6),
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

  void _approveParticipant(Map<String, dynamic> participant) {
    final name = participant['name']?.toString() ?? '';
    final reward = widget.challenge['reward'] ?? 50;

    setState(() {
      participant['status'] = 'approved';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'پاسخ $name تایید شد و $reward زریک جایزه به وی اهدا گردید 🏆',
          style: const TextStyle(fontFamily: AppTheme.fontFamily),
        ),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _buildDialogRow(String label, String value) {
    return Row(
      children: [
        SizedBox(
          width: 85,
          child: Text(
            label,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 13,
              color: Color(0xFFC7C5DD),
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A38),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF4C4578)),
            ),
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context, listen: false);
    final currentUser = widget.user ?? repository.currentUser;
    final caravanName = currentUser.caravanName ?? 'کاروان پنجم رضا جلالی';
    final challengeTitle = widget.challenge['title']?.toString() ?? 'پوسترینو';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFF18152D),
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Color(0xFF231E3E),
                Color(0xFF19152B),
                Color(0xFF110E1F),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Top Bar with Back Arrow, Caravan Subtitle and Title
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      // Back Arrow on Left (RTL leftmost)
                      InkWell(
                        onTap: () => Navigator.of(context).pop(),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            color: Color(0xFFDFB690),
                            size: 26,
                          ),
                        ),
                      ),
                      const Spacer(),
                      // Caravan Subtitle & Title on Right
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            caravanName,
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF9E9AC0).withValues(alpha: 0.85),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'چالش $challengeTitle',
                            style: const TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 16.5,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 10),

                // 2. Participants Submissions List
                Expanded(
                  child: _participants.isEmpty
                      ? const Center(
                          child: Text(
                            'هنوز عضوی در این چالش شرکت نکرده است.',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              color: Color(0xFF9E9AC0),
                              fontSize: 13,
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _participants.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final item = _participants[index];
                            final id = item['id']?.toString() ?? 'part_$index';
                            final isExpanded = _expandedParticipantIds.contains(id);

                            return _buildParticipantCard(
                              item: item,
                              id: id,
                              isExpanded: isExpanded,
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildParticipantCard({
    required Map<String, dynamic> item,
    required String id,
    required bool isExpanded,
  }) {
    final name = item['name'] ?? '';
    final status = item['status'] ?? 'pending';
    final typeLabel = item['typeLabel'] ?? 'تستی';
    final createdDate = item['createdDate'] ?? '15/08/1405';
    final answerDate = item['answerDate'] ?? '15/08/1405';
    final questionText = item['questionText'] ?? '';
    final userAnswer = item['userAnswer'] ?? '';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF242042).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isExpanded
              ? const Color(0xFF6B659F).withValues(alpha: 0.7)
              : const Color(0xFF3B3564).withValues(alpha: 0.6),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedParticipantIds.remove(id);
                } else {
                  _expandedParticipantIds.add(id);
                }
              });
            },
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: [
                  // Right side: Avatar + Student Name
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF5B538D),
                        ),
                        child: const Icon(
                          Icons.person,
                          color: Color(0xFFDFDDF2),
                          size: 19,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        name,
                        style: const TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),

                  const Spacer(),

                  // Left side: Actions (نیاز به اصلاح / تایید و اهدای جایزه) or Status badge + Chevron
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (status == 'approved') ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.6)),
                          ),
                          child: const Text(
                            'تایید شده',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF34D399),
                            ),
                          ),
                        ),
                      ] else if (status == 'needs_revision') ...[
                        GestureDetector(
                          onTap: () => _showRevisionDialog(item),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEAB308).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFEAB308).withValues(alpha: 0.6)),
                            ),
                            child: const Text(
                              'نیاز به اصلاح',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFFACC15),
                              ),
                            ),
                          ),
                        ),
                      ] else ...[
                        // 1. نیاز به اصلاح Button
                        GestureDetector(
                          onTap: () => _showRevisionDialog(item),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2C274A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF6B659F).withValues(alpha: 0.7),
                                width: 1.0,
                              ),
                            ),
                            child: const Text(
                              'نیاز به اصلاح',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFC7C5DD),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // 2. تایید و اهدای جایزه Button
                        GestureDetector(
                          onTap: () => _approveParticipant(item),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2C274A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFFC09268).withValues(alpha: 0.8),
                                width: 1.0,
                              ),
                            ),
                            child: const Text(
                              'تایید و اهدای جایزه',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFDFB690),
                              ),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(width: 6),

                      Icon(
                        isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                        color: const Color(0xFFB5B0DF),
                        size: 22,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Expanded Content Area
          if (isExpanded)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF1B1733),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(15),
                  bottomRight: Radius.circular(15),
                ),
                border: Border(
                  top: BorderSide(
                    color: const Color(0xFF4C4578).withValues(alpha: 0.5),
                    width: 1.0,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Row 1: نوع چالش | تاریخ ایجاد | تاریخ پاسخ
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildDetailItem('نوع چالش:', typeLabel),
                      _buildDetailItem('تاریخ ایجاد:', createdDate),
                      _buildDetailItem('تاریخ پاسخ:', answerDate),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Row 2: متن سوال
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 12,
                        color: Color(0xFFC7C5DD),
                        height: 1.5,
                      ),
                      children: [
                        const TextSpan(
                          text: 'متن سوال: ',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFDFB690),
                          ),
                        ),
                        TextSpan(text: questionText),
                      ],
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Row 3: پاسخ کاربر
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 12,
                        color: Colors.white,
                        height: 1.5,
                      ),
                      children: [
                        const TextSpan(
                          text: 'پاسخ کاربر: ',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFDFB690),
                          ),
                        ),
                        TextSpan(text: userAnswer),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailItem(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Color(0xFF9E9AC0),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}
