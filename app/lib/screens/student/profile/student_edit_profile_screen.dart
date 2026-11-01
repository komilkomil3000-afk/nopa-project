import 'package:nopa_app/widgets/tap_expander.dart';
import 'dart:io' as io;
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:flutter/cupertino.dart' show CupertinoPicker;
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/avatar_picker_sheet.dart';

import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';

class StudentEditProfileScreen extends StatefulWidget {
  final UserModel user;

  const StudentEditProfileScreen({super.key, required this.user});

  @override
  State<StudentEditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<StudentEditProfileScreen> {
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
    _emailCtrl = TextEditingController(text: widget.user.email ?? '');
    _dobCtrl = TextEditingController(text: widget.user.dateOfBirth ?? '');
    _nationalIdCtrl = TextEditingController(text: widget.user.nationalId ?? '');
    _addressCtrl = TextEditingController(text: widget.user.city ?? '');

    _educationCtrl = TextEditingController(text: 'کارشناسی ارشد مدیریت آموزشی');
    _jobCtrl = TextEditingController(text: 'مدرس و راهبر کاروان');
    _resumeCtrl = TextEditingController(text: 'دارای سابقه فعالیت و راهبری در حوزه‌های آموزشی و مهارتی');

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
    io.File? pickedFile;
    String? pickedFileName;
    bool isUploading = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => Directionality(
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
                  TapExpander(child: GestureDetector(
                    onTap: isUploading
                        ? null
                        : () async {
                            try {
                              final result = await FilePicker.platform.pickFiles(
                                type: FileType.any,
                                allowMultiple: false,
                              );
                              if (result != null && result.files.isNotEmpty) {
                                final firstFile = result.files.first;
                                if (firstFile.path != null) {
                                  setDialogState(() {
                                    pickedFileName = firstFile.name;
                                    pickedFile = io.File(firstFile.path!);
                                  });
                                }
                              }
                            } catch (e) {
                              debugPrint('Profile file pick error: $e');
                            }
                          },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1D36),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: pickedFileName != null
                              ? const Color(0xFF10B981)
                              : const Color(0xFFC09268).withValues(alpha: 0.5),
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            pickedFileName != null ? Icons.check_circle_outline : Icons.cloud_upload_outlined,
                            color: pickedFileName != null ? const Color(0xFF10B981) : const Color(0xFFC09268),
                            size: 34,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            pickedFileName ?? 'برای انتخاب فایل مدرک یا سند کلیک کنید (PDF / تصویر)',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: pickedFileName != null ? Colors.white : const Color(0xFFC7C5DD),
                              fontSize: 11.5,
                              fontWeight: pickedFileName != null ? FontWeight.bold : FontWeight.normal,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: isUploading ? null : () => Navigator.pop(ctx),
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
                          onPressed: (pickedFile == null || isUploading)
                              ? null
                              : () async {
                                  setDialogState(() => isUploading = true);
                                  try {
                                    final res = await HttpApiService().uploadMediaFile(
                                      pickedFile!,
                                      assetType: 'user_document',
                                      title: title,
                                    );
                                    if (ctx.mounted) {
                                      Navigator.pop(ctx);
                                    }
                                    if (context.mounted) {
                                      final isSuccess = res != null;
                                      if (isSuccess) {
      AppToast.info(context, 'فایل $title با موفقیت بارگذاری و ضمیمه شد 📎');
    } else {
      AppToast.error(context, 'خطایی رخ داده است. خطا در بارگذاری فایل. لطفاً مجدداً تلاش کنید.');
    }
                                    }
                                  } catch (e) {
                                    setDialogState(() => isUploading = false);
                                    if (context.mounted) {
                                      AppToast.error(context, 'خطایی رخ داده است. خطا در ارتباط با سرور');
                                    }
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFC09268),
                            disabledBackgroundColor: const Color(0xFF454270),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: isUploading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('آپلود فایل', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily, fontSize: 12)),
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
    );
  }

  Future<void> _saveChanges() async {
    final first = _firstNameCtrl.text.trim();
    final last = _lastNameCtrl.text.trim();
    final combinedName = [first, last].where((s) => s.isNotEmpty).join(' ');

    if (combinedName.isEmpty) {
      AppToast.error(context, 'لطفاً نام خود را وارد کنید');
      return;
    }

    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)) {
      AppToast.error(context, 'آدرس ایمیل معتبر نیست');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final api = HttpApiService();
      final saveError = await api.completeProfile({
        'name': combinedName,
        'nationalId': _nationalIdCtrl.text.trim(),
        'dateOfBirth': _dobCtrl.text.trim(),
        'email': email,
        'city': _addressCtrl.text.trim(),
      });
      if (saveError != null) {
        if (!mounted) return;
        setState(() => _isSaving = false);
        AppToast.error(context, saveError);
        return;
      }

      if (!mounted) return;
      await Provider.of<AppRepository>(context, listen: false).refreshUser();

      if (!mounted) return;
      AppToast.info(context, 'تغییرات با موفقیت ذخیره شد ✅');
      Navigator.pop(context);
    } catch (e) {
      setState(() => _isSaving = false);
      if (!mounted) return;
      AppToast.error(context, 'خطایی رخ داده است. خطا در ذخیره تغییرات');
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
                                readOnly: true,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: _buildFormField(
                                label: 'نام خانوادگی',
                                controller: _lastNameCtrl,
                                hintText: 'عباس',
                                readOnly: true,
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
                                readOnly: true,
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
                                hintText: 'انتخاب تاریخ',
                                onTap: _pickBirthDate,
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
                              child: TapExpander(child: InkWell(
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
                              )),
                            ),
                            const SizedBox(width: 14),

                            // 2. لغو Button (Purple border & text)
                            Expanded(
                              child: TapExpander(child: InkWell(
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
                              )),
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
                child: ListenableBuilder(
                  listenable: AppRepository(),
                  builder: (context, _) {
                    final u = AppRepository().currentUser;
                    final hasPic = (u.avatarUrl != null && u.avatarUrl!.isNotEmpty);
                    return hasPic
                        ? SafeAvatar(
                            radius: 43,
                            imageUrl: u.avatarUrl,
                            name: u.name,
                            gender: u.gender,
                            isMentor: false,
                            backgroundColor: Colors.transparent,
                          )
                        : _buildAvatarPlaceholder();
                  },
                ),
              ),
            ),
          ),

          // Pencil Edit Badge at bottom left in RTL (bottom right in LTR)
          Positioned(
            bottom: 2,
            left: 2,
            child: GestureDetector(
             onTap: () => showAvatarPicker(context),
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
    bool readOnly = false,
    VoidCallback? onTap,
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
            readOnly: readOnly || onTap != null,
            onTap: onTap,
            enableInteractiveSelection: !readOnly && onTap == null,
            style: TextStyle(
              color: readOnly ? const Color(0xFF8E889D) : const Color(0xFFEAE8F8),
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
              TapExpander(child: GestureDetector(
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
              )),
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
              TapExpander(child: GestureDetector(
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
              )),
            ],
          ),
        ),
      ],
    );
  }

  static const List<String> _monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];

  static String _fa(int n) {
    const d = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return n.toString().split('').map((c) => d[int.parse(c)]).join();
  }

  static String _enDigits(String s) {
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    const ar = '٠١٢٣٤٥٦٧٨٩';
    final b = StringBuffer();
    for (final ch in s.split('')) {
      final i = fa.indexOf(ch);
      final j = ar.indexOf(ch);
      b.write(i >= 0 ? i : (j >= 0 ? j : ch));
    }
    return b.toString();
  }

  /// Birth date chosen from year / month / day wheels (Iranian calendar), saved as yyyy/mm/dd.
  Future<void> _pickBirthDate() async {
    final nowYear = Jalali.now().year;
    int year = nowYear - 18;
    int month = 1;
    int day = 1;
    final parts = _enDigits(_dobCtrl.text.trim()).split(RegExp(r'[/\-]'));
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      final d = int.tryParse(parts[2]);
      if (y != null && m != null && d != null && y >= nowYear - 100 && y <= nowYear && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        year = y;
        month = m;
        day = d;
      }
    }
    final firstYear = nowYear - 100;
    final yearCtrl = FixedExtentScrollController(initialItem: year - firstYear);
    final monthCtrl = FixedExtentScrollController(initialItem: month - 1);
    var dayCtrl = FixedExtentScrollController(initialItem: day - 1);

    final picked = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: const Color(0xFF1E1A33),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final maxDay = Jalali(year, month, 1).monthLength;
          if (day > maxDay) day = maxDay;

          Widget wheel(FixedExtentScrollController c, int count, String Function(int) label, ValueChanged<int> onChanged, {Key? key}) {
            return Expanded(
              child: CupertinoPicker(
                key: key,
                scrollController: c,
                itemExtent: 36,
                magnification: 1.1,
                useMagnifier: true,
                selectionOverlay: Container(
                  decoration: BoxDecoration(
                    border: Border.symmetric(
                      horizontal: BorderSide(color: const Color(0xFFC09268).withValues(alpha: 0.6)),
                    ),
                  ),
                ),
                onSelectedItemChanged: onChanged,
                children: List.generate(
                  count,
                  (i) => Center(
                    child: Text(
                      label(i),
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontFamily: AppTheme.fontFamily),
                    ),
                  ),
                ),
              ),
            );
          }

          return SafeArea(
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'تاریخ تولد',
                      style: TextStyle(color: Color(0xFFE1BC96), fontSize: 14, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
                    ),
                    SizedBox(
                      height: 170,
                      child: Row(
                        children: [
                          wheel(yearCtrl, 101, (i) => _fa(firstYear + i), (i) => setSheet(() => year = firstYear + i)),
                          wheel(monthCtrl, 12, (i) => _monthNames[i], (i) => setSheet(() => month = i + 1)),
                          wheel(dayCtrl, maxDay, (i) => _fa(i + 1), (i) => day = i + 1, key: ValueKey('day$maxDay')),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _buildPwActionButton('تایید', () => Navigator.pop(ctx, true)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildPwActionButton('انصراف', () => Navigator.pop(ctx, false)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
    yearCtrl.dispose();
    monthCtrl.dispose();
    dayCtrl.dispose();
    if (picked == true && mounted) {
      final maxDay = Jalali(year, month, 1).monthLength;
      if (day > maxDay) day = maxDay;
      setState(() {
        _dobCtrl.text = '$year/${month.toString().padLeft(2, '0')}/${day.toString().padLeft(2, '0')}';
      });
    }
  }

  Widget _buildPwActionButton(String label, VoidCallback? onTap) {
    return TapExpander(child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFF1B192A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFC09268), width: 1.0),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFFE1BC96),
            fontSize: 13,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
      ),
    ));
  }

  /// Section for creating/updating the fixed password: one button that opens a dialog.
  Widget _buildPasswordSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
        const SizedBox(height: 6),
        _buildPwActionButton(
          'تغییر رمز عبور',
          () => showDialog(
            context: context,
            barrierDismissible: true,
            builder: (_) => _PasswordChangeDialog(phoneNumber: widget.user.phoneNumber),
          ),
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
      AppToast.error(context, 'لطفاً شرح درخواست خود را بنویسید');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = HttpApiService();
      final ticket = await api.createTicket(
        category: 'تغییر کاروان/راهبر',
        subject: '${widget.requestType} - $text',
      );

      if (!mounted) return;
      if (ticket == null) {
        setState(() => _isSubmitting = false);
        AppToast.error(context, 'ارسال درخواست انجام نشد. دوباره تلاش کنید');
        return;
      }
      Navigator.pop(context);

      AppToast.info(context, 'درخواست شما با موفقیت برای پشتیبانی ارسال شد ✅');
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (!mounted) return;
      AppToast.error(context, 'خطایی رخ داده است. خطا در ارسال درخواست');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: NopaDialogContainer(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.all(20),
          radius: 20,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Row: Profile Icon on top right in RTL & Title in center
              Stack(
                alignment: Alignment.center,
                children: [
                  // Profile icon on right in RTL
                  Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF3F3765).withValues(alpha: 0.6),
                        border: Border.all(
                          color: AppColors.buttonCamel.withValues(alpha: 0.85),
                          width: 1.2,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.person_outline_rounded,
                        color: AppColors.buttonCamel,
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

              // Bottom Actions: ارسال (Right in RTL - Camel) & لغو (Left in RTL - Purple)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // ارسال on Right in RTL
                  _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.buttonCamel,
                          ),
                        )
                      : TextButton(
                          onPressed: _submitRequest,
                          child: const Text(
                            'ارسال',
                            style: TextStyle(
                              color: AppColors.buttonCamel,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),

                  // لغو on Left in RTL
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'لغو',
                      style: TextStyle(
                        color: AppColors.buttonCancelPurple,
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


typedef EditProfileScreen = StudentEditProfileScreen;

/// Modal for changing the fixed password.
/// Remembers the old one: old password -> confirm -> new password twice.
/// Forgot it: SMS code -> new password twice.
class _PasswordChangeDialog extends StatefulWidget {
  final String phoneNumber;
  const _PasswordChangeDialog({required this.phoneNumber});

  @override
  State<_PasswordChangeDialog> createState() => _PasswordChangeDialogState();
}

enum _PwStep { choose, oldPassword, smsCode, newPassword }

class _PasswordChangeDialogState extends State<_PasswordChangeDialog> {
  _PwStep _step = _PwStep.choose;
  bool _forgot = false;
  bool _busy = false;
  String? _error;

  final _oldCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _repeatCtrl = TextEditingController();
  bool _showOld = false;
  bool _showNew = false;
  bool _showRepeat = false;

  @override
  void dispose() {
    _oldCtrl.dispose();
    _codeCtrl.dispose();
    _newCtrl.dispose();
    _repeatCtrl.dispose();
    super.dispose();
  }

  void _fail(String msg) => setState(() {
        _busy = false;
        _error = msg;
      });

  Future<void> _sendSms() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().requestPasswordResetCode(widget.phoneNumber);
    if (!mounted) return;
    if (err != null) return _fail(err);
    setState(() {
      _busy = false;
      _forgot = true;
      _step = _PwStep.smsCode;
    });
  }

  Future<void> _verifyOld() async {
    final old = _oldCtrl.text.trim();
    if (old.isEmpty) return _fail('رمز قبلی را وارد کنید');
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().verifyCurrentPassword(old);
    if (!mounted) return;
    if (err != null) return _fail(err);
    setState(() {
      _busy = false;
      _step = _PwStep.newPassword;
    });
  }

  void _acceptCode() {
    if (_codeCtrl.text.trim().isEmpty) return _fail('کد ارسال‌شده به پیامک را وارد کنید');
    setState(() {
      _error = null;
      _step = _PwStep.newPassword;
    });
  }

  Future<void> _submitNew() async {
    final pass = _newCtrl.text.trim();
    if (pass.length < 4) return _fail('رمز عبور باید حداقل ۴ کاراکتر باشد');
    if (pass != _repeatCtrl.text.trim()) return _fail('رمز جدید و تکرار آن یکسان نیستند');
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await HttpApiService().setNewPassword(
      pass,
      smsCode: _forgot ? _codeCtrl.text.trim() : null,
      currentPassword: _forgot ? null : _oldCtrl.text.trim(),
    );
    if (!mounted) return;
    if (err != null) {
      // A wrong / expired SMS code is fixed on the code step
      setState(() {
        _busy = false;
        _error = err;
        if (_forgot && err.contains('کد')) _step = _PwStep.smsCode;
      });
      return;
    }
    Navigator.pop(context);
    AppToast.info(context, 'رمز عبور با موفقیت تغییر کرد ✅');
  }

  Widget _field(String label, TextEditingController c,
      {bool obscure = false, VoidCallback? toggle, bool visible = false, TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 4),
          child: Text(label,
              style: const TextStyle(color: Color(0xFF9E9BB8), fontSize: 12, fontFamily: AppTheme.fontFamily)),
        ),
        Container(
          decoration: BoxDecoration(gradient: AppColors.strokeGradient, borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.all(AppColors.borderWidth),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            decoration: BoxDecoration(gradient: AppColors.darkSurfaceGradient, borderRadius: BorderRadius.circular(9)),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: c,
                    obscureText: obscure && !visible,
                    keyboardType: keyboard,
                    style: const TextStyle(color: Color(0xFFEAE8F8), fontSize: 13, fontFamily: AppTheme.fontFamily),
                    decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                  ),
                ),
                if (obscure)
                  TapExpander(
                    child: GestureDetector(
                      onTap: toggle,
                      child: Icon(
                        visible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: const Color(0xFF8E889D),
                        size: 18,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _button(String label, VoidCallback? onTap, {bool primary = true}) {
    return TapExpander(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _busy ? null : onTap,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF1B192A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: primary ? const Color(0xFFC09268) : const Color(0xFF5A4D80), width: 1.0),
          ),
          child: _busy && primary
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFCD8449)))
              : Text(label,
                  style: TextStyle(
                    color: primary ? const Color(0xFFE1BC96) : const Color(0xFFB5B0D8),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  )),
        ),
      ),
    );
  }

  List<Widget> _body() {
    switch (_step) {
      case _PwStep.choose:
        return [
          const Text('رمز قبلی خود را به یاد دارید؟',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFFE2E0F0), fontSize: 13, fontFamily: AppTheme.fontFamily)),
          const SizedBox(height: 16),
          _button('بله، یادم هست', () => setState(() {
                _forgot = false;
                _error = null;
                _step = _PwStep.oldPassword;
              })),
          const SizedBox(height: 10),
          _button('نه، یادم نیست (ارسال پیامک)', _sendSms),
        ];
      case _PwStep.oldPassword:
        return [
          _field('رمز قبلی', _oldCtrl, obscure: true, visible: _showOld, toggle: () => setState(() => _showOld = !_showOld)),
          const SizedBox(height: 14),
          _button('تایید', _verifyOld),
        ];
      case _PwStep.smsCode:
        return [
          const Text('کد تایید برای شماره شما پیامک شد',
              style: TextStyle(color: Color(0xFF9E9BB8), fontSize: 11.5, fontFamily: AppTheme.fontFamily)),
          const SizedBox(height: 10),
          _field('کد پیامک‌شده', _codeCtrl, keyboard: TextInputType.number),
          const SizedBox(height: 6),
          TapExpander(
            child: GestureDetector(
              onTap: _busy ? null : _sendSms,
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                child: Text('ارسال دوباره کد',
                    style: TextStyle(color: Color(0xFFC09268), fontSize: 11.5, fontFamily: AppTheme.fontFamily)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          _button('تایید', _acceptCode),
        ];
      case _PwStep.newPassword:
        return [
          _field('رمز جدید', _newCtrl, obscure: true, visible: _showNew, toggle: () => setState(() => _showNew = !_showNew)),
          const SizedBox(height: 12),
          _field('تکرار رمز جدید', _repeatCtrl,
              obscure: true, visible: _showRepeat, toggle: () => setState(() => _showRepeat = !_showRepeat)),
          const SizedBox(height: 14),
          _button('ثبت رمز جدید', _submitNew),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: NopaDialogContainer(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.all(20),
          radius: 20,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('تغییر رمز عبور',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                const SizedBox(height: 18),
                ..._body(),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFFFF8A80), fontSize: 11.5, fontFamily: AppTheme.fontFamily)),
                ],
                const SizedBox(height: 12),
                _button('انصراف', () => Navigator.pop(context), primary: false),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
