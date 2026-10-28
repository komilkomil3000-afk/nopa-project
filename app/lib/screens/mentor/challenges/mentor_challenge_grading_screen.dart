import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';

class MentorChallengeGradingScreen extends StatefulWidget {
  final Map<String, dynamic> challenge;
  final UserModel? user;

  const MentorChallengeGradingScreen({
    super.key,
    required this.challenge,
    this.user,
  });

  @override
  State<MentorChallengeGradingScreen> createState() => _MentorChallengeDetailsScreenState();
}

class _MentorChallengeDetailsScreenState extends State<MentorChallengeGradingScreen> {
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
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF2C274A),
                borderRadius: BorderRadius.circular(20),
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
                            width: 36,
                            height: 36,
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
                              size: 20,
                            ),
                          ),
                        ),
                        const Text(
                          'پیام به دانش آموز',
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 15.5,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Field 1: نام و نام خانوادگی
                    _buildDialogRow('نام و نام خانوادگی', name),
                    const SizedBox(height: 10),

                    // Field 2: تاریخ
                    _buildDialogRow('تاریخ', dateStr),
                    const SizedBox(height: 10),

                    // Field 3: موضوع:
                    _buildDialogRow('موضوع:', subjectCtrl.text),
                    const SizedBox(height: 10),

                    // Field 4: شرح دهید: (Multiline)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(
                          width: 80,
                          child: Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text(
                              'شرح دهید:',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 11.5,
                                color: Color(0xFFC7C5DD),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Container(
                            height: 95,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E1A38),
                              borderRadius: BorderRadius.circular(10),
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
                                fontSize: 11.5,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              decoration: const InputDecoration(
                                isDense: true,
                                hintText: 'توضیحات تان درمورد تصمیم تان را برای عضو بنویسید',
                                hintStyle: TextStyle(
                                  color: Color(0xFF8882A8),
                                  fontSize: 11,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                                border: InputBorder.none,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

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
                              fontSize: 14,
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
                              fontSize: 14,
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
          width: 80,
          child: Text(
            label,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 11.5,
              color: Color(0xFFC7C5DD),
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 35,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A38),
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: const Color(0xFF4C4578)),
            ),
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 12,
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
    final challengeType = widget.challenge['typeLabel']?.toString() ?? 'چند گزینه‌ای';
    final challengeReward = widget.challenge['reward']?.toString() ?? '100';
    final challengeDescription = widget.challenge['description']?.toString() ??
        'پوستر مربوط به جلسه آموزش طراحی کاروان را آماده و ارسال نمایید.';

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 2,
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. اطلاعات چالش در بالا بدون باکس (بصورت کاملاً متنی و خوانا)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Caravan Subtitle
                    Text(
                      caravanName,
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF9E9AC0).withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Challenge Title & Reward Row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            'چالش $challengeTitle',
                            style: const TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 16.5,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'جایزه: ',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 11.5,
                                color: Color(0xFFB5B0DF),
                              ),
                            ),
                            Text(
                              '$challengeReward زریک',
                              style: const TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFDFB690),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Type & Info row
                    Wrap(
                      spacing: 14,
                      runSpacing: 4,
                      children: [
                        RichText(
                          text: TextSpan(
                            style: const TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 11,
                              color: Color(0xFF9E9AC0),
                            ),
                            children: [
                              const TextSpan(text: 'نوع چالش: '),
                              TextSpan(
                                text: challengeType,
                                style: const TextStyle(
                                  color: Color(0xFFDDD9EE),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        RichText(
                          text: TextSpan(
                            style: const TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 11,
                              color: Color(0xFF9E9AC0),
                            ),
                            children: [
                              const TextSpan(text: 'تعداد ارسال‌ها: '),
                              TextSpan(
                                text: '${_participants.length}'.toPersian(),
                                style: const TextStyle(
                                  color: Color(0xFFDDD9EE),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Challenge Description
                    if (challengeDescription.isNotEmpty)
                      Text(
                        challengeDescription,
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 11.5,
                          color: Colors.white.withValues(alpha: 0.75),
                          height: 1.4,
                        ),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Title: اعضای ارسال کننده
              Row(
                children: [
                  Container(
                    width: 3,
                    height: 14,
                    decoration: BoxDecoration(
                      color: const Color(0xFFC09268),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'گزارش ارسال‌های اعضا',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFDDD9EE),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // Participants Submissions List (Styled like گزارش آموزشی اعضا در آموزگاه راهبران)
              if (_participants.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: Text(
                      'هنوز عضوی پاسخی برای این چالش ارسال نکرده است.',
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        color: Color(0xFF9E9AC0),
                        fontSize: 12,
                      ),
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _participants.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = _participants[index];
                    final id = item['id']?.toString() ?? 'part_$index';
                    final isExpanded = _expandedParticipantIds.contains(id);

                    return _buildMemberCard(
                      item: item,
                      id: id,
                      isExpanded: isExpanded,
                    );
                  },
                ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  /// Member Card matching Class2 / Mentor Station Educational Report Card style
  Widget _buildMemberCard({
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
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border matching Class2
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Member Header (Capsule gradient surface matching Class2)
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
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.vertical(top: Radius.circular(14.8))
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
                  border: isExpanded
                      ? const Border(
                          bottom: BorderSide(
                            color: Color(0xFF282542),
                            width: 1.0,
                          ),
                        )
                      : null,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right Side in RTL: Avatar + Name
                      Flexible(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF534C82),
                                border: Border.all(
                                  color: const Color(0xFF837CB7).withValues(alpha: 0.5),
                                  width: 1,
                                ),
                              ),
                              child: const Icon(
                                Icons.person_rounded,
                                color: Color(0xFFEDE9F6),
                                size: 17,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(width: 8),

                      // 2. Left Side in RTL: Actions / Status Badge + Chevron Arrow
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (status == 'approved') ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(7),
                                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.6)),
                              ),
                              child: const Text(
                                'تایید شده',
                                style: TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF34D399),
                                ),
                              ),
                            ),
                          ] else if (status == 'needs_revision') ...[
                            GestureDetector(
                              onTap: () => _showRevisionDialog(item),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEAB308).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(7),
                                  border: Border.all(color: const Color(0xFFEAB308).withValues(alpha: 0.6)),
                                ),
                                child: const Text(
                                  'نیاز به اصلاح',
                                  style: TextStyle(
                                    fontFamily: AppTheme.fontFamily,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFFACC15),
                                  ),
                                ),
                              ),
                            ),
                          ] else ...[
                            // Button 1: نیاز به اصلاح
                            GestureDetector(
                              onTap: () => _showRevisionDialog(item),
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: AppColors.strokeGradient,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                padding: const EdgeInsets.all(AppColors.borderWidth),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                                  decoration: BoxDecoration(
                                    gradient: AppColors.darkSurfaceGradient,
                                    borderRadius: BorderRadius.circular(7),
                                  ),
                                  child: const Text(
                                    'نیاز به اصلاح',
                                    style: TextStyle(
                                      color: Color(0xFFB5B0DF),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),

                            // Button 2: تایید و اهدای جایزه
                            GestureDetector(
                              onTap: () => _approveParticipant(item),
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: AppColors.strokeGradient,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                padding: const EdgeInsets.all(AppColors.borderWidth),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                                  decoration: BoxDecoration(
                                    gradient: AppColors.darkSurfaceGradient,
                                    borderRadius: BorderRadius.circular(7),
                                  ),
                                  child: const Text(
                                    'تایید و جایزه',
                                    style: TextStyle(
                                      color: Color(0xFFDFB690),
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],

                          const SizedBox(width: 6),

                          Icon(
                            isExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: const Color(0xFFDDD9EE),
                            size: 20,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Expanded Content Area
            if (isExpanded)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFF2B284B),
                      Color(0xFF221E3E),
                    ],
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(14.8),
                    bottomRight: Radius.circular(14.8),
                  ),
                ),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Row 1: نوع چالش | تاریخ ایجاد | تاریخ پاسخ
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          _buildDetailItem('نوع چالش:', typeLabel),
                          _buildDetailItem('تاریخ ایجاد:', createdDate),
                          _buildDetailItem('تاریخ پاسخ:', answerDate),
                        ],
                      ),

                      const SizedBox(height: 8),

                      // Row 2: متن سوال
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 11,
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

                      const SizedBox(height: 6),

                      // Row 3: پاسخ کاربر
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 11,
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
              ),
          ],
        ),
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
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: Color(0xFF9E9AC0),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}


typedef MentorChallengeDetailsScreen = MentorChallengeGradingScreen;
