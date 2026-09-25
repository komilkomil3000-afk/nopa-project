import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';

import '../widgets/app_scaffold.dart';

class EditProfileScreen extends StatefulWidget {
  final UserModel user;

  const EditProfileScreen({super.key, required this.user});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late TextEditingController _firstNameCtrl;
  late TextEditingController _lastNameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _dobCtrl;
  late TextEditingController _nationalIdCtrl;
  late TextEditingController _addressCtrl;

  // Mentor profile fields
  late TextEditingController _educationCtrl;
  late TextEditingController _jobCtrl;
  late TextEditingController _resumeCtrl;

  // Password fields
  late TextEditingController _newPasswordCtrl;
  late TextEditingController _confirmPasswordCtrl;
  bool _isNewPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    // Split name into first and last name if possible
    final fullName = widget.user.name.trim();
    final nameParts = fullName.split(' ');
    if (nameParts.length > 1) {
      _firstNameCtrl = TextEditingController(text: nameParts.first);
      _lastNameCtrl = TextEditingController(text: nameParts.sublist(1).join(' '));
    } else {
      _firstNameCtrl = TextEditingController(text: fullName);
      _lastNameCtrl = TextEditingController(text: '');
    }

    _phoneCtrl = TextEditingController(text: widget.user.phoneNumber);
    _emailCtrl = TextEditingController(text: '');
    _dobCtrl = TextEditingController(text: widget.user.dateOfBirth ?? '');
    _nationalIdCtrl = TextEditingController(text: widget.user.nationalId ?? '');
    _addressCtrl = TextEditingController(text: widget.user.city ?? '');

    _educationCtrl = TextEditingController(text: 'کارشناسی ارشد مدیریت آموزشی');
    _jobCtrl = TextEditingController(text: 'مدرس و راهبر کاروان');
    _resumeCtrl = TextEditingController(text: 'دارای سابقه فعالیت و راهبری در حوزه‌های آموزشی و مهارتی');

    _newPasswordCtrl = TextEditingController();
    _confirmPasswordCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _dobCtrl.dispose();
    _nationalIdCtrl.dispose();
    _addressCtrl.dispose();
    _educationCtrl.dispose();
    _jobCtrl.dispose();
    _resumeCtrl.dispose();
    _newPasswordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  String _getPersianDate() {
    final now = Jalali.now();
    final y = now.year;
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y/$m/$d';
  }

  void _openChangeRequestDialog({required String requestType}) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => _ChangeRequestSupportDialog(
        requestType: requestType,
        currentDate: _getPersianDate(),
      ),
    );
  }

  void _openFileUploadDialog({required String title}) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: const Color(0xFF28274A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF5A588B), width: 1.2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'ارسال فایل $title',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1D36),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFFC09268).withValues(alpha: 0.5),
                    ),
                  ),
                  child: Column(
                    children: const [
                      Icon(Icons.cloud_upload_outlined, color: Color(0xFFC09268), size: 34),
                      SizedBox(height: 8),
                      Text(
                        'برای انتخاب فایل مدرک یا سند کلیک کنید (PDF / تصویر)',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFFC7C5DD),
                          fontSize: 11.5,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF6B68A8)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('انصراف', style: TextStyle(color: Colors.white70, fontFamily: AppTheme.fontFamily, fontSize: 12)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('فایل $title با موفقیت ضمیمه شد 📎', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
                              backgroundColor: const Color(0xFF10B981),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC09268),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('آپلود فایل', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily, fontSize: 12)),
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
  }

  Future<void> _saveChanges() async {
    final first = _firstNameCtrl.text.trim();
    final last = _lastNameCtrl.text.trim();
    final combinedName = [first, last].where((s) => s.isNotEmpty).join(' ');

    if (combinedName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً نام خود را وارد کنید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    // Password validation if entered
    final newPassword = _newPasswordCtrl.text.trim();
    final confirmPassword = _confirmPasswordCtrl.text.trim();

    if (newPassword.isNotEmpty) {
      if (newPassword.length < 4) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('رمز عبور باید حداقل ۴ کاراکتر باشد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
      if (newPassword != confirmPassword) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('رمز عبور جدید و تکرار آن مطابقت ندارند', style: TextStyle(fontFamily: AppTheme.fontFamily)),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
    }

    setState(() => _isSaving = true);

    try {
      final api = HttpApiService();
      await api.completeProfile({
        'name': combinedName,
        'nationalId': _nationalIdCtrl.text.trim(),
        'dateOfBirth': _dobCtrl.text.trim(),
        'city': _addressCtrl.text.trim(),
      });

      if (newPassword.isNotEmpty) {
        await api.changePassword(null, newPassword);
      }

      if (!mounted) return;
      await Provider.of<AppRepository>(context, listen: false).refreshUser();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تغییرات با موفقیت ذخیره شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFF10B981),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      setState(() => _isSaving = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('خطا در ذخیره تغییرات: $e', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final caravanName = (widget.user.caravanName != null && widget.user.caravanName!.isNotEmpty)
        ? widget.user.caravanName!
        : 'کاروان شماره ۵';
    final mentorName = (widget.user.caravanMentor != null && widget.user.caravanMentor!.isNotEmpty)
        ? widget.user.caravanMentor!
        : 'راهبر کاروان';
    final isMentor = widget.user.role == UserRole.mentor || widget.user.role == UserRole.superMentor;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: false,
      showDrawerButton: false,
      showBottomNavBar: false,
      onBackTap: () => Navigator.of(context).pop(),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Large Avatar with Double Ring and Pencil Badge
            _buildAvatarSection(),

                        const SizedBox(height: 24),

                        // Form Row 1: نام (Right) & نام خانوادگی (Left)
                        Row(
                          children: [
                            Expanded(
                              child: _buildFormField(
                                label: 'نام',
                                controller: _firstNameCtrl,
                                hintText: 'کمیل',
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: _buildFormField(
                                label: 'نام خانوادگی',
                                controller: _lastNameCtrl,
                                hintText: 'عباس',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Form Row 2: شماره همراه (Right) & آدرس ایمیل (Left)
                        Row(
                          children: [
                            Expanded(
                              child: _buildFormField(
                                label: 'شماره همراه',
                                controller: _phoneCtrl,
                                hintText: '09120000000',
                                keyboardType: TextInputType.phone,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: _buildFormField(
                                label: 'آدرس ایمیل',
                                controller: _emailCtrl,
                                hintText: 'user@example.com',
                                keyboardType: TextInputType.emailAddress,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Form Row 3: تاریخ تولد (Right) & کدملی (Left)
                        Row(
                          children: [
                            Expanded(
                              child: _buildFormField(
                                label: 'تاریخ تولد',
                                controller: _dobCtrl,
                                hintText: '۱۳۸۵/۰۱/۰۱',
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: _buildFormField(
                                label: 'کدملی',
                                controller: _nationalIdCtrl,
                                hintText: '0012345678',
                                keyboardType: TextInputType.number,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        if (isMentor) ...[
                          // Form Row 4 (Mentor): آدرس (زیر تاریخ تولد)
                          _buildFormField(
                            label: 'آدرس',
                            controller: _addressCtrl,
                            hintText: 'تهران، خیابان ولیعصر...',
                          ),
                          const SizedBox(height: 16),

                          // Form Row 5 (Mentor): تحصیلات + دکمه ارسال فایل
                          _buildFieldWithActionButton(
                            label: 'تحصیلات',
                            controller: _educationCtrl,
                            hintText: 'کارشناسی ارشد مدیریت آموزشی',
                            buttonLabel: 'ارسال فایل',
                            onButtonPressed: () => _openFileUploadDialog(title: 'مدرک تحصیلی'),
                          ),
                          const SizedBox(height: 16),

                          // Form Row 6 (Mentor): شغل + دکمه ارسال فایل
                          _buildFieldWithActionButton(
                            label: 'شغل',
                            controller: _jobCtrl,
                            hintText: 'مدرس و راهبر کاروان',
                            buttonLabel: 'ارسال فایل',
                            onButtonPressed: () => _openFileUploadDialog(title: 'مستندات شغلی'),
                          ),
                          const SizedBox(height: 16),

                          // Form Row 7 (Mentor): رزومه + دکمه ارسال فایل
                          _buildFieldWithActionButton(
                            label: 'رزومه',
                            controller: _resumeCtrl,
                            hintText: 'شرح سوابق و فعالیت‌های علمی و مهارتی...',
                            buttonLabel: 'ارسال فایل',
                            maxLines: 3,
                            onButtonPressed: () => _openFileUploadDialog(title: 'رزومه کاری'),
                          ),
                        ] else ...[
                          // Form Row 4 (Student): نام کاروان + دکمه درخواست تغییر کاروان
                          _buildSpecialRequestField(
                            label: 'نام کاروان',
                            valueText: caravanName,
                            buttonLabel: 'درخواست تغییر کاروان',
                            onButtonPressed: () => _openChangeRequestDialog(requestType: 'درخواست تغییر کاروان'),
                          ),
                          const SizedBox(height: 16),

                          // Form Row 5 (Student): نام راهبر + دکمه درخواست تغییر راهبر
                          _buildSpecialRequestField(
                            label: 'نام راهبر',
                            valueText: mentorName,
                            buttonLabel: 'درخواست تغییر راهبر',
                            onButtonPressed: () => _openChangeRequestDialog(requestType: 'درخواست تغییر راهبر'),
                          ),
                          const SizedBox(height: 16),

                          // Form Row 6 (Student): آدرس
                          _buildFormField(
                            label: 'آدرس',
                            controller: _addressCtrl,
                            hintText: 'تهران، خیابان ولیعصر...',
                          ),
                        ],
                        const SizedBox(height: 22),

                        // Section: ایجاد / تغییر رمز عبور ثابت
                        _buildPasswordSection(),

                        const SizedBox(height: 28),

                        // Bottom Action Buttons: ثبت تغییرات & لغو
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // 1. ثبت تغییرات Button (English NOPA Gold Gradient Style)
                            Expanded(
                              child: InkWell(
                                onTap: _isSaving ? null : _saveChanges,
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: AppColors.strokeGradient,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  padding: const EdgeInsets.all(AppColors.borderWidth),
                                  child: Container(
                                    height: 44,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      gradient: AppColors.darkSurfaceGradient,
                                      borderRadius: BorderRadius.circular(9),
                                      border: Border.all(
                                        color: const Color(0xFFC09268),
                                        width: 1.1,
                                      ),
                                    ),
                                    child: _isSaving
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Color(0xFFCD8449),
                                            ),
                                          )
                                        : const Text(
                                            'ثبت تغییرات',
                                            style: TextStyle(
                                              color: Color(0xFFE1BC96),
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: AppTheme.fontFamily,
                                            ),
                                          ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),

                            // 2. لغو Button (Purple border & text)
                            Expanded(
                              child: InkWell(
                                onTap: () => Navigator.pop(context),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: AppColors.strokeGradient,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  padding: const EdgeInsets.all(AppColors.borderWidth),
                                  child: Container(
                                    height: 44,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      gradient: AppColors.darkSurfaceGradient,
                                      borderRadius: BorderRadius.circular(9),
                                      border: Border.all(
                                        color: const Color(0xFF5A4D80),
                                        width: 1.1,
                                      ),
                                    ),
                                    child: const Text(
                                      'لغو',
                                      style: TextStyle(
                                        color: Color(0xFFB5B0D8),
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: AppTheme.fontFamily,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
    );
  }

  /// Large Profile Avatar with Double Ring Border and Pencil Badge
  Widget _buildAvatarSection() {
    return Center(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Outer subtle ring
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(0xFF6B68A8).withValues(alpha: 0.6),
                width: 1.5,
              ),
            ),
            alignment: Alignment.center,
            child: Container(
              width: 86,
              height: 86,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF4A467D),
              ),
              child: ClipOval(
                child: widget.user.avatarUrl != null && widget.user.avatarUrl!.isNotEmpty
                    ? Image.network(
                        widget.user.avatarUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => _buildAvatarPlaceholder(),
                      )
                    : _buildAvatarPlaceholder(),
              ),
            ),
          ),

          // Pencil Edit Badge at bottom left in RTL (bottom right in LTR)
          Positioned(
            bottom: 2,
            left: 2,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFE5B585),
                border: Border.all(color: const Color(0xFF1E1736), width: 2.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.edit_rounded,
                color: Color(0xFF332014),
                size: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarPlaceholder() {
    return Container(
      color: const Color(0xFF8682C9),
      alignment: Alignment.center,
      child: SvgPicture.asset(
        'assets/svg_icons/profile01.svg',
        width: 46,
        height: 46,
        colorFilter: const ColorFilter.mode(Color(0xFF433F75), BlendMode.srcIn),
        errorBuilder: (context, error, stackTrace) => const Icon(
          Icons.person_rounded,
          color: Color(0xFF433F75),
          size: 46,
        ),
      ),
    );
  }

  /// Decorated Input Box (matching password box in login screen)
  Widget _buildDecoratedInputBox({required Widget child, EdgeInsetsGeometry? padding}) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(9),
        ),
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        alignment: Alignment.center,
        child: child,
      ),
    );
  }

  /// Reusable Form Input Field
  Widget _buildFormField({
    required String label,
    required TextEditingController controller,
    required String hintText,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 4),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF9E9BB8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),

        // Decorated Input Box
        _buildDecoratedInputBox(
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            style: const TextStyle(
              color: Color(0xFFEAE8F8),
              fontSize: 13,
              fontFamily: AppTheme.fontFamily,
            ),
            decoration: InputDecoration(
              isDense: true,
              border: InputBorder.none,
              hintText: hintText,
              hintStyle: TextStyle(
                color: Colors.white.withValues(alpha: 0.25),
                fontSize: 12.5,
                fontFamily: AppTheme.fontFamily,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
      ],
    );
  }

  /// Special full-width field (like Caravan & Mentor) with embedded request button
  Widget _buildSpecialRequestField({
    required String label,
    required String valueText,
    required String buttonLabel,
    required VoidCallback onButtonPressed,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 4),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF9E9BB8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),

        // Decorated Box with text on right and button on left
        _buildDecoratedInputBox(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Value Text (right in RTL)
              Expanded(
                child: Text(
                  valueText,
                  style: const TextStyle(
                    color: Color(0xFFEAE8F8),
                    fontSize: 13,
                    fontFamily: AppTheme.fontFamily,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),

              // Embedded Change Request Button (matching ثبت تغییرات style)
              GestureDetector(
                onTap: onButtonPressed,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2835),
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: const Color(0xFFC09268),
                      width: 1.0,
                    ),
                  ),
                  child: Text(
                    buttonLabel,
                    style: const TextStyle(
                      color: Color(0xFFE1BC96),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Field with Action Button (e.g. ارسال فایل for Education, Job, Resume)
  Widget _buildFieldWithActionButton({
    required String label,
    required TextEditingController controller,
    required String hintText,
    required String buttonLabel,
    required VoidCallback onButtonPressed,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 4),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF9E9BB8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),

        // Decorated Input Box with embedded action button
        _buildDecoratedInputBox(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Row(
            crossAxisAlignment: maxLines > 1 ? CrossAxisAlignment.end : CrossAxisAlignment.center,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  maxLines: maxLines,
                  style: const TextStyle(
                    color: Color(0xFFEAE8F8),
                    fontSize: 13,
                    fontFamily: AppTheme.fontFamily,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: hintText,
                    hintStyle: TextStyle(
                      color: Colors.white.withValues(alpha: 0.25),
                      fontSize: 12.5,
                      fontFamily: AppTheme.fontFamily,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onButtonPressed,
                child: Container(
                  margin: EdgeInsets.only(bottom: maxLines > 1 ? 4 : 0),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2835),
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: const Color(0xFFC09268),
                      width: 1.0,
                    ),
                  ),
                  child: Text(
                    buttonLabel,
                    style: const TextStyle(
                      color: Color(0xFFE1BC96),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Section for creating/updating fixed password
  Widget _buildPasswordSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Row(
            children: [
              const Text(
                'ایجاد / تغییر رمز عبور ثابت',
                style: TextStyle(
                  color: Color(0xFFC09268),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFFC09268).withValues(alpha: 0.5),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Password Inputs Row
        Row(
          children: [
            // New Password Field
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(bottom: 6, right: 4),
                    child: Text(
                      'رمز عبور جدید',
                      style: TextStyle(
                        color: Color(0xFF9E9BB8),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                  _buildDecoratedInputBox(
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _newPasswordCtrl,
                            obscureText: !_isNewPasswordVisible,
                            style: const TextStyle(
                              color: Color(0xFFEAE8F8),
                              fontSize: 13,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            decoration: InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              hintText: 'رمز عبور جدید',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.25),
                                fontSize: 11.5,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              contentPadding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _isNewPasswordVisible = !_isNewPasswordVisible),
                          child: Icon(
                            _isNewPasswordVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: const Color(0xFF8E889D),
                            size: 18,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),

            // Confirm Password Field
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(bottom: 6, right: 4),
                    child: Text(
                      'تکرار رمز عبور',
                      style: TextStyle(
                        color: Color(0xFF9E9BB8),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                  _buildDecoratedInputBox(
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _confirmPasswordCtrl,
                            obscureText: !_isConfirmPasswordVisible,
                            style: const TextStyle(
                              color: Color(0xFFEAE8F8),
                              fontSize: 13,
                              fontFamily: AppTheme.fontFamily,
                            ),
                            decoration: InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              hintText: 'تکرار رمز عبور',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.25),
                                fontSize: 11.5,
                                fontFamily: AppTheme.fontFamily,
                              ),
                              contentPadding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _isConfirmPasswordVisible = !_isConfirmPasswordVisible),
                          child: Icon(
                            _isConfirmPasswordVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            color: const Color(0xFF8E889D),
                            size: 18,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Modal Dialog for Support Change Request
class _ChangeRequestSupportDialog extends StatefulWidget {
  final String requestType;
  final String currentDate;

  const _ChangeRequestSupportDialog({
    required this.requestType,
    required this.currentDate,
  });

  @override
  State<_ChangeRequestSupportDialog> createState() => _ChangeRequestSupportDialogState();
}

class _ChangeRequestSupportDialogState extends State<_ChangeRequestSupportDialog> {
  final TextEditingController _descCtrl = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final text = _descCtrl.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً شرح درخواست خود را بنویسید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = HttpApiService();
      await api.createTicket(
        category: 'تغییر کاروان/راهبر',
        subject: '${widget.requestType} - $text',
      );

      if (!mounted) return;
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('درخواست شما با موفقیت برای پشتیبانی ارسال شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('خطا در ارسال درخواست: $e', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.screenBackgroundGradient,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFF5A4D80),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Row: Shield Profile Icon on top right/left & Title in center
              Stack(
                alignment: Alignment.center,
                children: [
                  // Profile icon on left in RTL
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFC09268).withValues(alpha: 0.8),
                          width: 1.2,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.person_outline_rounded,
                        color: Color(0xFFC09268),
                        size: 22,
                      ),
                    ),
                  ),

                  // Center Title
                  const Text(
                    'پیام به پشتیبانی',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Row 1: موضوع: + Rounded Box
              _buildDialogRow(
                label: 'موضوع:',
                content: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: AppColors.strokeGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.all(AppColors.borderWidth),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.darkSurfaceGradient,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      widget.requestType,
                      style: const TextStyle(
                        color: Color(0xFFE2E0F0),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Row 2: تاریخ: + Rounded Box
              _buildDialogRow(
                label: 'تاریخ:',
                content: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: AppColors.strokeGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.all(AppColors.borderWidth),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.darkSurfaceGradient,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      widget.currentDate,
                      style: const TextStyle(
                        color: Color(0xFFE2E0F0),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Row 3: شرح دهید: + Multi-line Text Field Box
              _buildDialogRow(
                label: 'شرح دهید:',
                crossAxisAlignment: CrossAxisAlignment.start,
                content: Container(
                  height: 110,
                  decoration: BoxDecoration(
                    gradient: AppColors.strokeGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.all(AppColors.borderWidth),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.darkSurfaceGradient,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: TextField(
                      controller: _descCtrl,
                      maxLines: 4,
                      style: const TextStyle(
                        color: Color(0xFFE2E0F0),
                        fontSize: 12.5,
                        fontFamily: AppTheme.fontFamily,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'ما را در جریان قرار دهید',
                        hintStyle: TextStyle(
                          color: Colors.white.withValues(alpha: 0.25),
                          fontSize: 12,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Bottom Actions: ارسال (Gold text) & لغو (Purple text)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // لغو
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'لغو',
                      style: TextStyle(
                        color: Color(0xFF9E9CD6),
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),

                  // ارسال
                  _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFFCD8449),
                          ),
                        )
                      : TextButton(
                          onPressed: _submitRequest,
                          child: const Text(
                            'ارسال',
                            style: TextStyle(
                              color: Color(0xFFE1BC96),
                              fontSize: 14,
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
    );
  }

  Widget _buildDialogRow({
    required String label,
    required Widget content,
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.center,
  }) {
    return Row(
      crossAxisAlignment: crossAxisAlignment,
      children: [
        // Label on Right in RTL
        SizedBox(
          width: 70,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFB5B0D8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
        const SizedBox(width: 8),

        // Content Field
        Expanded(child: content),
      ],
    );
  }
}
