import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../services/api_service.dart';

class CertificateViewScreen extends StatefulWidget {
  final Map<String, dynamic> certificate;
  final String userName;

  const CertificateViewScreen({
    super.key,
    required this.certificate,
    required this.userName,
  });

  @override
  State<CertificateViewScreen> createState() => _CertificateViewScreenState();
}

class _CertificateViewScreenState extends State<CertificateViewScreen> {
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'گواهی «${widget.certificate['title']}» با موفقیت دانلود و در گالری ذخیره شد 📥',
              style: const TextStyle(fontFamily: AppTheme.fontFamily),
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
  }

  void _showPhysicalOrderModal() {
    final nameCtrl = TextEditingController(text: widget.userName);
    final addressCtrl = TextEditingController();
    final postalCodeCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    bool isProcessing = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Directionality(
            textDirection: TextDirection.rtl,
            child: Dialog(
              backgroundColor: Colors.transparent,
              insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 440),
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
                      // Header
                      const Stack(
                        alignment: Alignment.center,
                        children: [
                          Align(
                            alignment: Alignment.centerRight,
                            child: Icon(
                              Icons.card_membership_rounded,
                              color: Color(0xFF9E9CD6),
                              size: 32,
                            ),
                          ),
                          Text(
                            'درخواست نسخه فیزیکی گواهی',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16.5,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

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
                      const SizedBox(height: 22),

                      // Action Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton(
                            onPressed: isProcessing
                                ? null
                                : () async {
                                    if (nameCtrl.text.isEmpty || addressCtrl.text.isEmpty) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('لطفاً همه فیلدهای آدرس را تکمیل فرمایید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                          backgroundColor: Colors.redAccent,
                                        ),
                                      );
                                      return;
                                    }
                                    final messenger = ScaffoldMessenger.of(context);
                                    setModalState(() => isProcessing = true);
                                    try {
                                      final api = HttpApiService();
                                      await api.createTicket(
                                        category: 'درخواست گواهی فیزیکی',
                                        subject: 'درخواست نسخه چاپی ${widget.certificate['title']} - گیرنده: ${nameCtrl.text} - آدرس: ${addressCtrl.text}',
                                      );
                                      if (ctx.mounted) Navigator.pop(ctx);
                                      messenger.showSnackBar(
                                        const SnackBar(
                                          content: Text('درخواست نسخه چاپی با موفقیت ثبت شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                          backgroundColor: Color(0xFF10B981),
                                        ),
                                      );
                                    } catch (_) {
                                      setModalState(() => isProcessing = false);
                                    }
                                  },
                            child: isProcessing
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFE1BC96)),
                                  )
                                : const Text(
                                    'پرداخت و ثبت نهایی',
                                    style: TextStyle(
                                      color: Color(0xFFE1BC96),
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx),
                            child: const Text(
                              'انصراف',
                              style: TextStyle(
                                color: Color(0xFF9E9CD6),
                                fontSize: 14.5,
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
            style: const TextStyle(color: Color(0xFFE1BC96), fontSize: 13, fontWeight: FontWeight.w500, fontFamily: AppTheme.fontFamily),
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
              style: const TextStyle(color: Color(0xFFE1BC96), fontSize: 12.5, fontFamily: AppTheme.fontFamily),
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

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
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
                // Top Bar matching HomeScreen / CertificatesScreen
                _buildTopBar(),

                // Scrollable Content
                Expanded(
                  child: SingleChildScrollView(
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
                                'گواهی معتبر دیجیتال شما با موفقیت صادر شد ✨',
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
                                color: const Color(0xFFC09268).withValues(alpha: 0.4),
                                width: 1.0,
                              ),
                            ),
                            child: Column(
                              children: [
                                // Top Certificate Header: Golden NOPA Logo & Ribbon
                                ShaderMask(
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
                                    color: Color(0xFFE1BC96),
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
                                  color: const Color(0xFFC09268).withValues(alpha: 0.5),
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
                                    color: Color(0xFFE1BC96),
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
                                            color: Color(0xFF9E9CD6),
                                            fontSize: 9.5,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                        SizedBox(height: 4),
                                        Icon(Icons.draw_rounded, color: Color(0xFFC09268), size: 22),
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
                                          color: const Color(0xFFC09268),
                                          width: 1.5,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFFC09268).withValues(alpha: 0.25),
                                            blurRadius: 10,
                                          ),
                                        ],
                                      ),
                                      alignment: Alignment.center,
                                      child: const Icon(
                                        Icons.verified_user_rounded,
                                        color: Color(0xFFE1BC96),
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
                                            color: Color(0xFF9E9CD6),
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
                        InkWell(
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
                                  color: const Color(0xFFC09268),
                                  width: 1.1,
                                ),
                              ),
                              child: _isDownloading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Color(0xFFE1BC96),
                                      ),
                                    )
                                  : const Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.download_rounded, color: Color(0xFFE1BC96), size: 18),
                                        SizedBox(width: 8),
                                        Text(
                                          'دانلود مستقیم گواهی (PDF / تصویر)',
                                          style: TextStyle(
                                            color: Color(0xFFE1BC96),
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            fontFamily: AppTheme.fontFamily,
                                          ),
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Action 2: درخواست نسخه فیزیکی گواهی Button
                        InkWell(
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
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Top Bar matching HomeScreen
  Widget _buildTopBar() {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: NOPA Logo + Back Icon
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 42,
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
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: SvgPicture.asset(
                    'assets/svg_icons/back01.svg',
                    width: 28,
                    height: 28,
                    colorFilter: const ColorFilter.mode(
                      Color(0xFFC7B299),
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ],
            ),

            // Right: Screen Title
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'مشاهده و دانلود گواهی',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
