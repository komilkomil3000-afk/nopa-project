import 'package:flutter/material.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/services/api_service.dart';
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
  final Set<String> _expandedParticipantIds = {};

  List<Map<String, dynamic>> _participants = [];
  bool _loading = true;
  bool _loadFailed = false;

  @override
  void initState() {
    super.initState();
    _loadParticipants();
  }

  String _jalali(dynamic value) {
    final dt = value is DateTime ? value : DateTime.tryParse(value?.toString() ?? '');
    if (dt == null) return '';
    final j = Jalali.fromDateTime(dt.toLocal());
    return '${j.year}/${j.month.toString().padLeft(2, '0')}/${j.day.toString().padLeft(2, '0')}'.toPersianDigits();
  }

  /// The server keeps 'pending' / 'approved' / 'rejected'; the card uses 'needs_revision' for the last one.
  String _uiStatus(dynamic raw) {
    switch (raw?.toString().toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'approved';
      case 'rejected':
        return 'needs_revision';
      default:
        return 'pending';
    }
  }

  Future<void> _loadParticipants() async {
    final challengeId = widget.challenge['id']?.toString() ?? '';
    final typeLabel = widget.challenge['typeLabel']?.toString() ?? '';
    final createdDate = widget.challenge['createdDate']?.toString() ?? '';
    final question = (widget.challenge['desc'] ?? widget.challenge['description'] ?? '').toString();

    try {
      final list = await HttpApiService().getChallengeSubmissions(challengeId);
      if (!mounted) return;
      setState(() {
        _participants = list.map((sub) {
          final answer = (sub['answerText'] ?? '').toString();
          final fileUrl = (sub['fileUrl'] ?? '').toString();
          return <String, dynamic>{
            'id': sub['id']?.toString() ?? '',
            'name': sub['student']?['name']?.toString() ?? 'عضو کاروان',
            'typeLabel': typeLabel,
            'createdDate': createdDate,
            'answerDate': _jalali(sub['submittedAt']),
            'questionText': question,
            'userAnswer': answer.isNotEmpty ? answer : (fileUrl.isNotEmpty ? 'فایل پیوست' : ''),
            'status': _uiStatus(sub['status']),
            'feedback': sub['mentorFeedback']?.toString() ?? '',
            'score': sub['score'],
          };
        }).toList();
        _loading = false;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadFailed = true;
      });
    }
  }

  void _showRevisionDialog(Map<String, dynamic> participant) {
    final name = participant['name']?.toString() ?? '';
    final subjectCtrl = TextEditingController(text: 'اصلاح پاسخ چالش');
    final explanationCtrl = TextEditingController();
    final dateStr = _jalali(DateTime.now());

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
                          onPressed: () async {
                            final feedback = explanationCtrl.text.trim();
                            if (feedback.isEmpty) {
                              AppToast.error(ctx, 'لطفاً توضیح اصلاح را بنویسید.');
                              return;
                            }
                            Navigator.pop(ctx);
                            final res = await HttpApiService().reviewSubmission(
                              participant['id'].toString(),
                              status: 'rejected',
                              mentorFeedback: feedback,
                            );
                            if (!mounted) return;
                            if (res['success'] == true) {
                              setState(() {
                                participant['status'] = 'needs_revision';
                                participant['feedback'] = feedback;
                              });
                              AppToast.info(context, 'پاسخ برای اصلاح به $name بازگردانده شد');
                            } else {
                              AppToast.error(context, res['error']?.toString() ?? 'ثبت انجام نشد');
                            }
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

  int get _rewardMin => int.tryParse(widget.challenge['rewardMin']?.toString() ?? '') ?? 0;
  int get _rewardMax => int.tryParse(widget.challenge['rewardMax']?.toString() ?? '') ?? 0;
  String get _assetLabel => widget.challenge['rewardAsset']?.toString() == 'nakh' ? 'نخ' : 'زریک';

  bool get _canEditReward => widget.challenge['isByAdmin'] != true;

  Future<void> _editReward() async {
    final int fixed = int.tryParse(widget.challenge['reward']?.toString() ?? '') ?? 0;
    final minCtrl = TextEditingController(text: (_rewardMax > 0 ? _rewardMin : 0).toString());
    final maxCtrl = TextEditingController(text: (_rewardMax > 0 ? _rewardMax : fixed).toString());
    String asset = widget.challenge['rewardAsset']?.toString() == 'nakh' ? 'nakh' : 'zarik';

    InputDecoration deco(String label) => InputDecoration(
          isDense: true,
          labelText: label,
          labelStyle: const TextStyle(color: Color(0xFFC7C5DD), fontFamily: AppTheme.fontFamily, fontSize: 12),
          enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF4C4578))),
          focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFC09268))),
        );

    final bool? saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF2C274A),
            title: const Text(
              'ویرایش پاداش چالش',
              style: TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 14, color: Colors.white),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    for (final opt in const [['zarik', 'زریک'], ['nakh', 'نخ']]) ...[
                      Expanded(
                        child: ChoiceChip(
                          label: Center(child: Text(opt[1], style: const TextStyle(fontFamily: AppTheme.fontFamily))),
                          selected: asset == opt[0],
                          onSelected: (_) => setDialogState(() => asset = opt[0]),
                        ),
                      ),
                      if (opt[0] == 'zarik') const SizedBox(width: 8),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: minCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                  decoration: deco('حداقل'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: maxCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                  decoration: deco('حداکثر'),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () async {
                  final min = int.tryParse(minCtrl.text.trim().toEnglishDigits());
                  final max = int.tryParse(maxCtrl.text.trim().toEnglishDigits());
                  if (min == null || max == null || min < 0 || max <= 0) {
                    AppToast.error(ctx, 'حداقل و حداکثر را به صورت عدد وارد کنید.');
                    return;
                  }
                  if (min > max) {
                    AppToast.error(ctx, 'حداقل پاداش نمی‌تواند از حداکثر بیشتر باشد.');
                    return;
                  }
                  final error = await HttpApiService().updateChallengeReward(
                    widget.challenge['id'].toString(),
                    assetType: asset,
                    min: min,
                    max: max,
                  );
                  if (!ctx.mounted) return;
                  if (error != null) {
                    AppToast.error(ctx, error);
                    return;
                  }
                  setState(() {
                    widget.challenge['rewardAsset'] = asset;
                    widget.challenge['rewardMin'] = min;
                    widget.challenge['rewardMax'] = max;
                    widget.challenge['reward'] = max;
                  });
                  Navigator.pop(ctx, true);
                },
                child: const Text('ذخیره', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFFE5A855))),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('لغو', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFF9E9CD6))),
              ),
            ],
          ),
        ),
      ),
    );
    if (saved == true && mounted) {
      AppToast.success(context, 'پاداش چالش ویرایش شد');
      await Provider.of<AppRepository>(context, listen: false).refreshChallenges();
    }
  }

  Future<void> _approveParticipant(Map<String, dynamic> participant) async {
    final name = participant['name']?.toString() ?? '';
    final int min = _rewardMin;
    final int max = _rewardMax;
    final bool hasRange = max > 0;
    final int fixedReward = int.tryParse(widget.challenge['reward']?.toString() ?? '') ?? 0;
    final rewardCtrl = TextEditingController(text: (hasRange ? max : fixedReward).toString());
    final String asset = _assetLabel;

    final int? reward = await showDialog<int>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF2C274A),
          title: Text(
            'تایید پاسخ $name',
            style: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 14, color: Colors.white),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                hasRange
                    ? 'مقدار $asset را بین ${min.toPersianDigits()} و ${max.toPersianDigits()} تعیین کنید:'
                    : 'مقدار $asset که به حساب این عضو اضافه می‌شود را تعیین کنید:',
                style: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 11.5, color: Color(0xFFC7C5DD)),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: rewardCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                decoration: InputDecoration(
                  isDense: true,
                  suffixText: asset,
                  suffixStyle: const TextStyle(color: Color(0xFFDFB690), fontFamily: AppTheme.fontFamily),
                  enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF4C4578))),
                  focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFC09268))),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                final v = int.tryParse(rewardCtrl.text.trim().toEnglishDigits());
                if (v == null || v < 0) {
                  AppToast.error(ctx, 'مقدار نامعتبر است.');
                  return;
                }
                if (hasRange && (v < min || v > max)) {
                  AppToast.error(ctx, 'مقدار باید بین ${min.toPersianDigits()} و ${max.toPersianDigits()} باشد.');
                  return;
                }
                Navigator.pop(ctx, v);
              },
              child: const Text('ادامه', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFFE5A855))),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('لغو', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFF9E9CD6))),
            ),
          ],
        ),
      ),
    );
    if (reward == null || !mounted) return;

    // Final confirmation: nothing is credited until the mentor explicitly agrees
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF2C274A),
          title: const Text(
            'تایید نهایی',
            style: TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 14, color: Colors.white),
          ),
          content: Text(
            'با تایید شما ${reward.toPersianDigits()} $asset به حساب $name اضافه می‌شود و این کار قابل بازگشت نیست. ادامه می‌دهید؟',
            style: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 12, height: 1.6, color: Color(0xFFC7C5DD)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('تایید و ثبت', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFFE5A855))),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('بازگشت', style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFF9E9CD6))),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    final res = await HttpApiService().reviewSubmission(
      participant['id'].toString(),
      status: 'approved',
      score: reward,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        participant['status'] = 'approved';
        participant['score'] = reward;
      });
      AppToast.success(context, '${reward.toPersianDigits()} $asset به حساب $name اضافه شد');
    } else {
      AppToast.error(context, res['error']?.toString() ?? 'ثبت انجام نشد');
    }
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
    final caravanName = currentUser.caravanName ?? '';
    final challengeTitle = widget.challenge['title']?.toString() ?? '';
    final challengeType = widget.challenge['typeLabel']?.toString() ?? '';
    final challengeReward = _rewardMax > 0
        ? '${_rewardMin.toPersianDigits()} تا ${_rewardMax.toPersianDigits()}'
        : (widget.challenge['reward'] ?? 0).toString().toPersianDigits();
    final challengeDescription = (widget.challenge['desc'] ?? widget.challenge['description'] ?? '').toString();

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
                              '$challengeReward $_assetLabel',
                              style: const TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFDFB690),
                              ),
                            ),
                            if (_canEditReward)
                              GestureDetector(
                                onTap: _editReward,
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6),
                                  child: Icon(Icons.edit_rounded, size: 15, color: Color(0xFF9E92E8)),
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
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(child: CircularProgressIndicator(color: Color(0xFFCD8449))),
                )
              else if (_loadFailed)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: TextButton(
                      onPressed: () {
                        setState(() {
                          _loading = true;
                          _loadFailed = false;
                        });
                        _loadParticipants();
                      },
                      child: const Text('دریافت پاسخ‌ها ناموفق بود؛ تلاش دوباره',
                          style: TextStyle(fontFamily: AppTheme.fontFamily, color: Color(0xFFDFB690))),
                    ),
                  ),
                )
              else if (_participants.isEmpty)
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
    final typeLabel = item['typeLabel'] ?? '';
    final createdDate = item['createdDate'] ?? '';
    final answerDate = item['answerDate'] ?? '';
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
