import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';

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
                // Top Bar identical to ProfileScreen
                _buildTopBar(),

                // Scrollable Form Body
                Expanded(
                  child: SingleChildScrollView(
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

                        // Form Row 4 (Full-width): نام کاروان + دکمه درخواست تغییر کاروان
                        _buildSpecialRequestField(
                          label: 'نام کاروان',
                          valueText: caravanName,
                          buttonLabel: 'درخواست تغییر کاروان',
                          onButtonPressed: () => _openChangeRequestDialog(requestType: 'درخواست تغییر کاروان'),
                        ),
                        const SizedBox(height: 16),

                        // Form Row 5 (Full-width): نام راهبر + دکمه درخواست تغییر راهبر
                        _buildSpecialRequestField(
                          label: 'نام راهبر',
                          valueText: mentorName,
                          buttonLabel: 'درخواست تغییر راهبر',
                          onButtonPressed: () => _openChangeRequestDialog(requestType: 'درخواست تغییر راهبر'),
                        ),
                        const SizedBox(height: 16),

                        // Form Row 6 (Full-width): آدرس
                        _buildFormField(
                          label: 'آدرس',
                          controller: _addressCtrl,
                          hintText: 'تهران، خیابان ولیعصر...',
                        ),
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
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Top Bar matching ProfileScreen exactly (Left: NOPA Logo + Back icon; Right: Bell + Drawer Hamburger)
  Widget _buildTopBar() {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: NOPA Logo + Back SVG Icon
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
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 4, right: 8),
                    child: SvgPicture.asset(
                      'assets/svg_icons/back01.svg',
                      width: 20,
                      height: 20,
                      colorFilter: const ColorFilter.mode(
                        Color(0xFFC7B299),
                        BlendMode.srcIn,
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // Right: Notification Bell Button + Drawer Hamburger Menu
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Consumer<AppRepository>(
                  builder: (context, repository, _) {
                    final count = repository.unreadNotificationsCount;
                    final bool hasUnread = count > 0;

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          repository.fetchNotifications();
                          Navigator.pushNamed(context, '/notifications');
                        },
                        borderRadius: BorderRadius.circular(22),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: const BoxDecoration(
                                color: Color(0xFF23223D),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.notifications_none_rounded,
                                  color: Color(0xFFC7B299),
                                  size: 23,
                                ),
                              ),
                            ),
                            if (hasUnread)
                              Positioned(
                                right: 0,
                                top: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEF4444),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF23223D), width: 1.5),
                                  ),
                                  child: Center(
                                    child: Text(
                                      count > 9 ? '+۹' : count.toPersian(),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                        height: 1,
                                        fontFamily: AppTheme.fontFamily,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(width: 10),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.of(context).pop(),
                    borderRadius: BorderRadius.circular(22),
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: const BoxDecoration(
                        color: Color(0xFF23223D),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: SvgPicture.asset(
                          'assets/svg_icons/Manual01.svg',
                          width: 22,
                          height: 22,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFFC7B299),
                            BlendMode.srcIn,
                          ),
                          errorBuilder: (context, error, stackTrace) => const Icon(
                            Icons.menu_rounded,
                            color: Color(0xFFC7B299),
                            size: 22,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
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
