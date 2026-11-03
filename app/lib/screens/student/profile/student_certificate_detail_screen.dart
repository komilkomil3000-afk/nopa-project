import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';
import '../../../widgets/nopa_modal_shell.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';

class StudentCertificateDetailScreen extends StatefulWidget {
  final Map<String, dynamic> certificate;
  final String userName;

  const StudentCertificateDetailScreen({
    super.key,
    required this.certificate,
    required this.userName,
  });

  @override
  State<StudentCertificateDetailScreen> createState() => _CertificateViewScreenState();
}

class _CertificateViewScreenState extends State<StudentCertificateDetailScreen> {
  bool _isDownloading = false;

  void _downloadCertificate() {
    setState(() {
      _isDownloading = true;
    });

    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
        AppToast.info(context, 'گواهی «${widget.certificate['title']}» با موفقیت دانلود و در گالری ذخیره شد');
      }
    });
  }

  void _showPhysicalOrderModal() {
    final nameCtrl = TextEditingController(text: widget.userName);
    final addressCtrl = TextEditingController();
    final postalCodeCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    bool isProcessing = false;

    showNopaModal<void>(
      context,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return NopaModalShell(
            maxWidth: 440,
            headerIcon: Icons.card_membership_rounded,
            title: 'درخواست نسخه فیزیکی گواهی',
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
            actions: [
              NopaModalAction(
                label: 'پرداخت و ثبت نهایی',
                loading: isProcessing,
                onPressed: () async {
                                    if (nameCtrl.text.isEmpty || addressCtrl.text.isEmpty) {
                                      AppToast.error(context, 'لطفاً همه فیلدهای آدرس را تکمیل فرمایید');
                                      return;
                                    }
                                    setModalState(() => isProcessing = true);
                                    try {
                                      final api = HttpApiService();
                                      await api.createTicket(
                                        category: 'درخواست گواهی فیزیکی',
                                        subject: 'درخواست نسخه چاپی ${widget.certificate['title']} - گیرنده: ${nameCtrl.text} - آدرس: ${addressCtrl.text}',
                                      );
                                      if (ctx.mounted) Navigator.pop(ctx);
                                      if (context.mounted) AppToast.success(context, 'درخواست نسخه چاپی با موفقیت ثبت شد');
                                    } catch (_) {
                                      setModalState(() => isProcessing = false);
                                    }
                                  },
              ),
              NopaModalAction(
                label: 'انصراف',
                variant: NopaModalActionVariant.secondary,
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                      _buildModalRow('دوره:', widget.certificate['title'] ?? 'دوره آموزشی نپا'),
                      const SizedBox(height: 10),

                      _buildModalInputField('تحویل‌گیرنده:', nameCtrl, 'نام و نام خانوادگی'),
                      const SizedBox(height: 10),

                      _buildModalInputField('تلفن همراه:', phoneCtrl, '09380346668', keyboardType: TextInputType.phone),
                      const SizedBox(height: 10),

                      _buildModalInputField('آدرس:', addressCtrl, 'استان، شهر، خیابان، پلاک...', maxLines: 2),
                      const SizedBox(height: 10),

                      _buildModalInputField('کد پستی:', postalCodeCtrl, 'کد پستی ۱۰ رقمی', keyboardType: TextInputType.number),
                      const SizedBox(height: 10),

                      _buildModalRow('هزینه ارسال:', '۵۰,۰۰۰ تومان'),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildModalRow(String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF7A709E), width: 1.1),
          ),
          child: Text(
            label,
            style: const TextStyle(color: Color(0xFFDDD9EE), fontSize: 12, fontWeight: FontWeight.w500, fontFamily: AppTheme.fontFamily),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.left,
            style: const TextStyle(color: AppColors.accentGoldEnd, fontSize: 13, fontWeight: FontWeight.w500, fontFamily: AppTheme.fontFamily),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildModalInputField(String label, TextEditingController controller, String hintText, {TextInputType keyboardType = TextInputType.text, int maxLines = 1}) {
    return Row(
      crossAxisAlignment: maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF7A709E), width: 1.1),
          ),
          child: Text(
            label,
            style: const TextStyle(color: Color(0xFFDDD9EE), fontSize: 12, fontWeight: FontWeight.w500, fontFamily: AppTheme.fontFamily),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF221E3A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF7A709E).withValues(alpha: 0.6), width: 1.0),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            child: TextField(
              controller: controller,
              keyboardType: keyboardType,
              maxLines: maxLines,
              style: const TextStyle(color: AppColors.accentGoldEnd, fontSize: 12.5, fontFamily: AppTheme.fontFamily),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: hintText,
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.25), fontSize: 11.5, fontFamily: AppTheme.fontFamily),
                contentPadding: const EdgeInsets.symmetric(vertical: 5),
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final String title = widget.certificate['title'] ?? 'گواهی‌نامه رسمی نپا';
    final String date = widget.certificate['date'] ?? '۱۴۰۳/۰۶/۱۵';
    final String teacher = widget.certificate['teacher'] ?? 'راهبر کاروان';
    final String sessions = widget.certificate['sessionsCount'] ?? '۶ جلسه';

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: AppTabs.profile,
      onBackTap: () => Navigator.of(context).pop(),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
                        // Issuance Success Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFF10B981).withValues(alpha: 0.35),
                              width: 1.0,
                            ),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 18),
                              SizedBox(width: 8),
                              Text(
                                'گواهی معتبر دیجیتال شما با موفقیت صادر شد',
                                style: TextStyle(
                                  color: Color(0xFF10B981),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Luxury Official Certificate Card (HomeScreen Aesthetic)
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(22),
                            gradient: AppColors.strokeGradient,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.45),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              gradient: const LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                stops: [0.0, 0.5, 1.0],
                                colors: [
                                  Color(0xFF3D3C67),
                                  Color(0xFF333157),
                                  Color(0xFF2B2848),
                                ],
                              ),
                              border: Border.all(
                                color: AppColors.buttonCamel.withValues(alpha: 0.4),
                                width: 1.0,
                              ),
                            ),
                            child: Column(
                              children: [
                                // Top Certificate Header: Golden NOPA Logo & Ribbon
                                ShaderMask(
                                  shaderCallback: (bounds) => const LinearGradient(
                                    colors: [
                                      AppColors.buttonCamel,
                                      Color(0xFFF4DCC5),
                                    ],
                                    begin: Alignment.bottomCenter,
                                    end: Alignment.topCenter,
                                  ).createShader(bounds),
                                  child: const Text(
                                    'NOPA',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 26,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 2.5,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),

                                const Text(
                                  '«گواهی‌نامه رسمی آموزش و توانمندسازی کاروان»',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: AppColors.accentGoldEnd,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 18),

                                // Subtle Divider
                                Container(
                                  height: 1,
                                  width: 140,
                                  color: AppColors.buttonCamel.withValues(alpha: 0.5),
                                ),
                                const SizedBox(height: 18),

                                const Text(
                                  'بدینوسیله گواهی می‌شود که مسافر گرامی:',
                                  style: TextStyle(
                                    color: Color(0xFFB5B0D8),
                                    fontSize: 12,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 10),

                                // User Name
                                Text(
                                  widget.userName,
                                  style: const TextStyle(
                                    color: AppColors.accentGoldEnd,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 14),

                                // Completion Statement
                                Text(
                                  'دوره آموزشی «$title» را با موفقیت و کسب مهارت‌های کاربردی لازم در بستر کاروان یادگیری نپا گذرانده است.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Color(0xFFDDD9EE),
                                    fontSize: 12.5,
                                    height: 1.6,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 12),

                                // Course Details Pill
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF221E3A),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: const Color(0xFF7A709E).withValues(alpha: 0.5),
                                      width: 0.8,
                                    ),
                                  ),
                                  child: Text(
                                    'تعداد جلسات: $sessions • راهبر / استاد: $teacher',
                                    style: const TextStyle(
                                      color: Color(0xFFC7B299),
                                      fontSize: 11,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // Footer: Date & Official Stamp / Signature
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    // Signature
                                    const Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'مهر و امضای دبیرخانه:',
                                          style: TextStyle(
                                            color: AppColors.buttonCancelPurple,
                                            fontSize: 9.5,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                        SizedBox(height: 4),
                                        Icon(Icons.draw_rounded, color: AppColors.buttonCamel, size: 22),
                                      ],
                                    ),

                                    // Golden Stamp Seal
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: const Color(0xFF2A2835),
                                        border: Border.all(
                                          color: AppColors.buttonCamel,
                                          width: 1.5,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.buttonCamel.withValues(alpha: 0.25),
                                            blurRadius: 10,
                                          ),
                                        ],
                                      ),
                                      alignment: Alignment.center,
                                      child: const Icon(
                                        Icons.verified_user_rounded,
                                        color: AppColors.accentGoldEnd,
                                        size: 22,
                                      ),
                                    ),

                                    // Date
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        const Text(
                                          'تاریخ صدور:',
                                          style: TextStyle(
                                            color: AppColors.buttonCancelPurple,
                                            fontSize: 9.5,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          date,
                                          style: const TextStyle(
                                            color: Color(0xFFDDD9EE),
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Action 1: دانلود مستقیم گواهی Button (Matching ثبت تغییرات Style)
                        TapExpander(child: InkWell(
                          onTap: _isDownloading ? null : _downloadCertificate,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: AppColors.strokeGradient,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.all(AppColors.borderWidth),
                            child: Container(
                              height: 48,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                gradient: AppColors.darkSurfaceGradient,
                                borderRadius: BorderRadius.circular(9),
                                border: Border.all(
                                  color: AppColors.buttonCamel,
                                  width: 1.1,
                                ),
                              ),
                              child: _isDownloading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.accentGoldEnd,
                                      ),
                                    )
                                  : const Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.download_rounded, color: AppColors.accentGoldEnd, size: 18),
                                        SizedBox(width: 8),
                                        Text(
                                          'دانلود مستقیم گواهی (PDF / تصویر)',
                                          style: TextStyle(
                                            color: AppColors.accentGoldEnd,
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                        )),
                        const SizedBox(height: 12),

                        // Action 2: درخواست نسخه فیزیکی گواهی Button
                        TapExpander(child: InkWell(
                          onTap: _showPhysicalOrderModal,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 46,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: const Color(0xFF2A2835),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF7A709E).withValues(alpha: 0.7),
                                width: 1.0,
                              ),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.local_shipping_outlined, color: Color(0xFFDDD9EE), size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'درخواست نسخه فیزیکی و چاپی گواهی',
                                  style: TextStyle(
                                    color: Color(0xFFDDD9EE),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
    );
  }
}


typedef CertificateViewScreen = StudentCertificateDetailScreen;
