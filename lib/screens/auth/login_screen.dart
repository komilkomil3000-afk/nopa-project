import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/auth_service.dart';

enum AuthLoginMode { otp, password, testBypass }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _CountryOption {
  final String name;
  final String code;
  final String flag;

  const _CountryOption({
    required this.name,
    required this.code,
    required this.flag,
  });
}

const List<_CountryOption> _availableCountries = [
  _CountryOption(name: 'ایران', code: '+98', flag: '🇮🇷'),
  _CountryOption(name: 'عراق', code: '+964', flag: '🇮🇶'),
  _CountryOption(name: 'افغانستان', code: '+93', flag: '🇦🇫'),
  _CountryOption(name: 'ترکیه', code: '+90', flag: '🇹🇷'),
  _CountryOption(name: 'امارات', code: '+971', flag: '🇦🇪'),
  _CountryOption(name: 'عمان', code: '+968', flag: '🇴🇲'),
  _CountryOption(name: 'عربستان', code: '+966', flag: '🇸🇦'),
  _CountryOption(name: 'لبنان', code: '+961', flag: '🇱🇧'),
  _CountryOption(name: 'سوریه', code: '+963', flag: '🇸🇾'),
  _CountryOption(name: 'پاکستان', code: '+92', flag: '🇵🇰'),
  _CountryOption(name: 'آلمان', code: '+49', flag: '🇩🇪'),
  _CountryOption(name: 'بریتانیا', code: '+44', flag: '🇬🇧'),
  _CountryOption(name: 'آمریکا / کانادا', code: '+1', flag: '🇺🇸'),
];

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  AuthLoginMode _loginMode = AuthLoginMode.otp;

  // Animation controller for smooth logo entrance & float
  late final AnimationController _logoAnimCtrl;
  late final Animation<double> _logoScaleAnim;
  late final Animation<double> _logoFadeAnim;
  late final Animation<Offset> _logoFloatAnim;

  // Controllers
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _secretCtrl = TextEditingController();
  final TextEditingController _honeypotCtrl = TextEditingController();

  _CountryOption _selectedCountry = _availableCountries.first;
  bool _isPasswordVisible = false;
  bool _isLoading = false;

  // OTP Countdown Timer (119s -> 01:59)
  Timer? _countdownTimer;
  int _cooldownRemainingSeconds = 0;
  bool _isSendingCode = false;
  bool _hasSentOnce = false;

  final HttpApiService _apiService = HttpApiService();

  @override
  void initState() {
    super.initState();

    _logoAnimCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _logoScaleAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _logoAnimCtrl, curve: Curves.easeOutBack),
    );
    _logoFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoAnimCtrl, curve: const Interval(0.0, 0.8, curve: Curves.easeIn)),
    );
    _logoFloatAnim = Tween<Offset>(
      begin: const Offset(0, 16),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _logoAnimCtrl, curve: Curves.easeOutCubic),
    );
    _logoAnimCtrl.forward();

    _loadSavedPhone();
    _checkAutoLogin();
  }

  @override
  void dispose() {
    _logoAnimCtrl.dispose();
    _countdownTimer?.cancel();
    _phoneCtrl.dispose();
    _secretCtrl.dispose();
    _honeypotCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSavedPhone() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedPhone = prefs.getString('saved_login_phone');
      if (savedPhone != null && savedPhone.isNotEmpty && mounted) {
        setState(() {
          if (_phoneCtrl.text.isEmpty) {
            _phoneCtrl.text = savedPhone;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _checkAutoLogin() async {
    if (_apiService.isAuthenticated) {
      final prefs = await SharedPreferences.getInstance();
      final lastActiveMs = prefs.getInt('last_app_exit_timestamp');
      if (lastActiveMs != null) {
        final lastActive = DateTime.fromMillisecondsSinceEpoch(lastActiveMs);
        final diff = DateTime.now().difference(lastActive);
        if (diff.inMinutes >= 10) {
          debugPrint('⏱️ Inactivity timeout on launch: away for ${diff.inMinutes} minutes. Auto-login blocked.');
          await _apiService.setToken(null);
          await prefs.remove('last_app_exit_timestamp');
          return;
        }
      }

      await prefs.setInt('last_app_exit_timestamp', DateTime.now().millisecondsSinceEpoch);
      AppRepository().recordActivity();

      final user = await _apiService.getMe();
      if (user != null && mounted) {
        final appRepo = Provider.of<AppRepository>(context, listen: false);
        appRepo.updateUser(user);
        if (user.isDualRole || user.role == UserRole.admin) {
          _showDualRoleSelectionDialog(user);
        } else {
          AuthService.selectedRole = user.role;
          Navigator.pushReplacementNamed(context, '/dashboard', arguments: user.role);
        }
      }
    }
  }

  String _toEnglishDigits(String input) {
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    for (int i = 0; i < 10; i++) {
      input = input.replaceAll(farsi[i], english[i]);
      input = input.replaceAll(arabic[i], english[i]);
    }
    return input;
  }

  String _formatTimer(int totalSeconds) {
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  void _startCountdownTimer([int seconds = 119]) {
    _countdownTimer?.cancel();
    setState(() {
      _cooldownRemainingSeconds = seconds;
      _hasSentOnce = true;
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_cooldownRemainingSeconds > 0) {
          _cooldownRemainingSeconds--;
        } else {
          _cooldownRemainingSeconds = 0;
          timer.cancel();
        }
      });
    });
  }

  void _openCountryPickerModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'انتخاب کشور و پیش‌شماره',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: _availableCountries.length,
                    separatorBuilder: (_, _) => Divider(
                      color: Colors.white.withValues(alpha: 0.06),
                      height: 1,
                    ),
                    itemBuilder: (context, idx) {
                      final item = _availableCountries[idx];
                      final isSelected = item.code == _selectedCountry.code;

                      return ListTile(
                        leading: Text(item.flag, style: const TextStyle(fontSize: 22)),
                        title: Text(
                          item.name,
                          style: TextStyle(
                            color: isSelected ? AppColors.accentGoldEnd : Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 14,
                          ),
                        ),
                        trailing: Text(
                          item.code,
                          style: TextStyle(
                            color: isSelected ? AppColors.accentGoldEnd : const Color(0xFF8E889D),
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 14,
                          ),
                        ),
                        onTap: () {
                          setState(() {
                            _selectedCountry = item;
                          });
                          Navigator.pop(ctx);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleSendVerificationCode() async {
    final phone = _toEnglishDigits(_phoneCtrl.text.trim());
    if (phone.isEmpty) {
      _showError('لطفاً شماره تلفن همراه خود را وارد کنید');
      return;
    }

    if (_cooldownRemainingSeconds > 0) {
      _showWarning('لطفاً ${_formatTimer(_cooldownRemainingSeconds)} دیگر دوباره تلاش کنید.');
      return;
    }

    setState(() {
      _isSendingCode = true;
    });

    final res = await _apiService.verifyPhone(
      phone,
      websiteSource: _honeypotCtrl.text.trim(),
    );

    if (!mounted) return;
    setState(() {
      _isSendingCode = false;
    });

    if (res['status'] == 'success') {
      _startCountdownTimer(119);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res['message'] ?? 'کد تأیید برای شماره شما ارسال شد.',
            style: const TextStyle(fontFamily: AppTheme.fontFamily),
          ),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else if (res['status'] == 'rate_limited') {
      final retryAfter = (res['retryAfter'] as num?)?.toInt() ?? 119;
      _startCountdownTimer(retryAfter);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.',
            style: const TextStyle(fontFamily: AppTheme.fontFamily),
          ),
          backgroundColor: const Color(0xFFF59E0B),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      _showError(res['message'] ?? 'خطایی در ارسال کد تایید رخ داد');
    }
  }

  Map<String, dynamic> _decodeJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return {};
      final payload = parts[1];
      var normalized = base64Url.normalize(payload);
      var resp = utf8.decode(base64Url.decode(normalized));
      final decoded = jsonDecode(resp);
      return (decoded is Map<String, dynamic>) ? decoded : {};
    } catch (e) {
      return {};
    }
  }

  void _processLoginResponse(dynamic response) {
    if (response == null) {
      _showError('ارتباط با سرور برقرار نشد');
      return;
    }

    if (response['status'] == 'rate_limited') {
      final retryAfter = (response['retryAfter'] as num?)?.toInt() ?? 119;
      _startCountdownTimer(retryAfter);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.',
            style: const TextStyle(fontFamily: AppTheme.fontFamily),
          ),
          backgroundColor: const Color(0xFFF59E0B),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (response['status'] == 'error') {
      _showError(response['message'] ?? 'عملیات ناموفق بود');
      return;
    }

    if (response['status'] == 'multiple_profiles') {
      _showProfileSwitcher(response['profiles']);
    } else if (response['status'] == 'success') {
      final token = response['data']['token'];
      final decodedToken = _decodeJwt(token);
      final userRoleStr = decodedToken['role'] ?? response['data']['user']['role'];
      final userData = response['data']['user'];

      final bool isDualRole = userData['isDualRole'] == true || userRoleStr == 'admin';

      UserRole resolvedRole = UserRole.member;
      if (userRoleStr == 'admin') {
        resolvedRole = UserRole.admin;
      } else if (userRoleStr == 'SUPER_MENTOR') {
        resolvedRole = UserRole.superMentor;
      } else if (userRoleStr == 'mentor') {
        resolvedRole = UserRole.mentor;
      }

      final userPhone = userData['phoneNumber'] ?? _phoneCtrl.text.trim();
      SharedPreferences.getInstance().then((prefs) {
        if (userPhone != null && userPhone.toString().isNotEmpty) {
          prefs.setString('saved_login_phone', userPhone.toString());
        }
        prefs.setInt('last_app_exit_timestamp', DateTime.now().millisecondsSinceEpoch);
      }).catchError((_) {});
      AppRepository().recordActivity();

      final loggedInUser = UserModel(
        id: userData['id'],
        name: userData['name'] ?? 'کاربر',
        phoneNumber: userData['phoneNumber'] ?? '',
        avatarUrl: userData['avatarUrl'],
        role: resolvedRole,
        isDualRole: isDualRole,
        zarik: userData['zarikBalance'] ?? 0,
        levelFrame: userData['levelFrame'] ?? 1,
      );

      final appRepo = Provider.of<AppRepository>(context, listen: false);
      appRepo.updateUser(loggedInUser);

      if (isDualRole) {
        _showDualRoleSelectionDialog(loggedInUser);
      } else {
        AuthService.selectedRole = resolvedRole;
        Navigator.pushReplacementNamed(context, '/dashboard', arguments: resolvedRole);
      }
    }
  }

  void _showDualRoleSelectionDialog(UserModel user) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: const Color(0xFF160E29),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
              side: const BorderSide(color: Color(0xFF6D28D9), width: 1.5),
            ),
            child: Padding(
              padding: const EdgeInsets.all(22.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: AppColors.accentGradient,
                      ),
                      child: const Icon(
                        Icons.manage_accounts_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'انتخاب نقش ورود به سامانه',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${user.name} عزیز، شما دارای دسترسی چندگانه هستید. مایلید با کدام نقش وارد شوید؟',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      height: 1.5,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 22),
                  _buildRoleCard(
                    title: 'ورود به عنوان راهبر (مربی)',
                    description: 'مشاهده اعضا، مدیریت تکالیف و چالش‌ها، ارزیابی‌ها و گزارش‌ها',
                    icon: Icons.supervisor_account_rounded,
                    gradientColors: const [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                    onTap: () {
                      Navigator.pop(ctx);
                      final appRepo = Provider.of<AppRepository>(context, listen: false);
                      appRepo.setActiveRole(UserRole.mentor);
                      AuthService.selectedRole = UserRole.mentor;
                      Navigator.pushReplacementNamed(context, '/dashboard', arguments: UserRole.mentor);
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildRoleCard(
                    title: 'ورود به عنوان دانش‌آموز',
                    description: 'مشاهده جلسات آموزشی، ثبت تکالیف، نقشه پیشرفت و بازارچه',
                    icon: Icons.school_rounded,
                    gradientColors: const [Color(0xFFCD8449), Color(0xFFE1BC96)],
                    onTap: () {
                      Navigator.pop(ctx);
                      final appRepo = Provider.of<AppRepository>(context, listen: false);
                      appRepo.setActiveRole(UserRole.member);
                      AuthService.selectedRole = UserRole.member;
                      Navigator.pushReplacementNamed(context, '/dashboard', arguments: UserRole.member);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildRoleCard({
    required String title,
    required String description,
    required IconData icon,
    required List<Color> gradientColors,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF221538),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: gradientColors[0].withValues(alpha: 0.4), width: 1.2),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(colors: gradientColors),
                ),
                child: Icon(icon, color: Colors.white, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 11,
                        height: 1.3,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _showProfileSwitcher(List<dynamic> profiles) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('انتخاب حساب کاربری', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
              const SizedBox(height: 16),
              ...profiles.map((profile) {
                return Card(
                  color: const Color(0xFF26123D),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: ListTile(
                    leading: const CircleAvatar(backgroundColor: Color(0xFFCD8449), child: Icon(Icons.person, color: Colors.white)),
                    title: Text(profile['name'], style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily)),
                    subtitle: Text(profile['role'] == 'mentor' ? 'راهبر' : 'دانش‌آموز', style: const TextStyle(color: Colors.white70, fontFamily: AppTheme.fontFamily)),
                    onTap: () {
                      Navigator.pop(context);
                      _handleLoginForRole(profile['role']);
                    },
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handleLoginForRole(String role) async {
    String phone = _toEnglishDigits(_phoneCtrl.text.trim());
    String password = _loginMode == AuthLoginMode.testBypass ? '123456' : _secretCtrl.text;
    final response = await _apiService.login(phone, password: password, role: role);
    _processLoginResponse(response);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontFamily: AppTheme.fontFamily)),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showWarning(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontFamily: AppTheme.fontFamily)),
        backgroundColor: const Color(0xFFF59E0B),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _handleLogin() async {
    String phone = _toEnglishDigits(_phoneCtrl.text.trim());
    if (phone.isEmpty) {
      _showError('لطفاً شماره تلفن همراه را وارد کنید');
      return;
    }

    String password;
    if (_loginMode == AuthLoginMode.testBypass) {
      password = '123456';
    } else if (_loginMode == AuthLoginMode.otp) {
      password = _secretCtrl.text.trim();
      if (password.isEmpty) {
        _showError('لطفاً کد تأیید پیامک‌شده را وارد کنید');
        return;
      }
    } else {
      password = _secretCtrl.text;
      if (password.isEmpty) {
        _showError('لطفاً رمز خود را وارد کنید');
        return;
      }
    }

    setState(() => _isLoading = true);
    final response = await _apiService.login(phone, password: password);
    if (mounted) {
      setState(() => _isLoading = false);
      _processLoginResponse(response);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: AppColors.screenBackgroundGradient,
          ),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 34.0, vertical: 16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 38),

                        // 1. Top Header: SVG Logo (nopa_logo.svg) above Persian Poetry
                        _buildTopHeader(),

                        const SizedBox(height: 26),

                        // 2. Segmented Mode Switcher: OTP vs Password + Test badge
                        _buildSegmentedModeSwitcher(),

                        const SizedBox(height: 24),

                        // 3. Login Form
                        _buildLoginForm(),

                        const SizedBox(height: 28),

                        // 4. Bottom Footer: Campaign & Version
                        _buildBottomFooter(),

                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Top Header: Clean Floating SVG Logo with entrance animation positioned directly ABOVE the poetry text
  Widget _buildTopHeader() {
    return AnimatedBuilder(
      animation: _logoAnimCtrl,
      builder: (context, child) {
        return Transform.translate(
          offset: _logoFloatAnim.value,
          child: Opacity(
            opacity: _logoFadeAnim.value,
            child: Transform.scale(
              scale: _logoScaleAnim.value,
              child: Column(
                children: [
                  // Centered Nopa SVG Logo directly above the Persian Poetry
                  SizedBox(
                    width: 105,
                    height: 125,
                    child: SvgPicture.asset(
                      'assets/images/nopa_logo.svg',
                      fit: BoxFit.contain,
                      placeholderBuilder: (BuildContext context) => const Center(
                        child: SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFFCD8449),
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Persian Poetry Subtitle
                  const Text(
                    'گر چه راهیست پر از بیم ز ما تا بر دوست\nرفتن آسان بود ار واقف منزل باشی',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFC7B299),
                      fontSize: 11.2,
                      height: 1.55,
                      fontWeight: FontWeight.w400,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Segmented Mode Switcher matching screenshot proportions
  Widget _buildSegmentedModeSwitcher() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Mode Switcher Pill Container (Right in RTL)
        Container(
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
            padding: const EdgeInsets.all(3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. OTP Mode Button
                _buildModeItem(
                  title: 'ورود با رمز یکبارمصرف',
                  isSelected: _loginMode == AuthLoginMode.otp,
                  onTap: () {
                    setState(() {
                      _loginMode = AuthLoginMode.otp;
                      _secretCtrl.clear();
                    });
                  },
                ),

                const SizedBox(width: 4),

                // 2. Fixed Password Mode Button
                _buildModeItem(
                  title: 'ورود با رمز عبور ثابت',
                  isSelected: _loginMode == AuthLoginMode.password,
                  onTap: () {
                    setState(() {
                      _loginMode = AuthLoginMode.password;
                      _secretCtrl.clear();
                    });
                  },
                ),
              ],
            ),
          ),
        ),

        const SizedBox(width: 8),

        // "آزمایشی" Test Bypass Pill Badge (Left in RTL)
        GestureDetector(
          onTap: () {
            setState(() {
              _loginMode = AuthLoginMode.testBypass;
              _secretCtrl.clear();
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('حالت آزمایشی (بدون نیاز به دریافت پیامک) فعال شد.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                duration: Duration(seconds: 2),
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
          child: Container(
            decoration: BoxDecoration(
              gradient: _loginMode == AuthLoginMode.testBypass ? AppColors.accentGradient : AppColors.strokeGradient,
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.all(AppColors.borderWidth),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                gradient: _loginMode == AuthLoginMode.testBypass ? AppColors.accentGradient : AppColors.darkSurfaceGradient,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Text(
                'آزمایشی',
                style: TextStyle(
                  color: _loginMode == AuthLoginMode.testBypass ? Colors.white : const Color(0xFFC7B299),
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Individual Segment Item (Clean flat gradient, no glowing shadow)
  Widget _buildModeItem({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: isSelected ? AppColors.accentGradient : null,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF8E889D),
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
      ),
    );
  }

  /// Input Container with Gradient Border
  Widget _buildDecoratedInputBox({required Widget child, EdgeInsetsGeometry? padding}) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(9),
        ),
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        child: child,
      ),
    );
  }

  /// Phone Number Input Widget with functional Country Selection Dropdown
  Widget _buildPhoneNumberInput() {
    return _buildDecoratedInputBox(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Right Side in RTL: Clickable Country Selector (Flag + Code + Dropdown Chevron)
          InkWell(
            onTap: _openCountryPickerModal,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 2.0),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _selectedCountry.code,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _selectedCountry.flag,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Color(0xFF8E889D),
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 1,
                    height: 24,
                    color: const Color(0xFF6C6C63).withValues(alpha: 0.35),
                  ),
                  const SizedBox(width: 6),
                ],
              ),
            ),
          ),

          // Center: Phone Text Field
          Expanded(
            child: TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: Colors.white,
                fontFamily: AppTheme.fontFamily,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.0,
              ),
              decoration: const InputDecoration(
                hintText: '9380346668',
                hintStyle: TextStyle(color: Colors.white24, fontFamily: AppTheme.fontFamily, fontSize: 14.5),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),

          // Left Side in RTL: Inline "ارسال کد" / Countdown Button
          if (_loginMode == AuthLoginMode.otp) ...[
            const SizedBox(width: 8),
            _buildOtpDispatchInlineButton(),
          ],
        ],
      ),
    );
  }

  /// Inline OTP Dispatch Button inside Phone Input
  Widget _buildOtpDispatchInlineButton() {
    final bool isTimerActive = _cooldownRemainingSeconds > 0;
    final String buttonLabel = isTimerActive
        ? _formatTimer(_cooldownRemainingSeconds)
        : (_hasSentOnce ? 'ارسال مجدد' : 'ارسال کد');

    return GestureDetector(
      onTap: (_isSendingCode || isTimerActive) ? null : _handleSendVerificationCode,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(7),
          border: Border.all(
            color: const Color(0xFF6C6C63).withValues(alpha: 0.5),
            width: 0.8,
          ),
        ),
        child: _isSendingCode
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Text(
                buttonLabel,
                style: TextStyle(
                  color: isTimerActive ? const Color(0xFFC7B299) : Colors.white,
                  fontWeight: FontWeight.w500,
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 11.5,
                ),
              ),
      ),
    );
  }

  /// Secret / Password Input Widget:
  /// - In OTP mode: NO three dots / bullets, clean empty text box.
  /// - In Password mode: Eye toggle icon placed at the FAR LEFT of the box.
  Widget _buildSecretInput() {
    final bool isOtp = _loginMode == AuthLoginMode.otp;

    return _buildDecoratedInputBox(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Text Input (Starts on the Right in RTL)
          Expanded(
            child: TextField(
              controller: _secretCtrl,
              obscureText: !isOtp && !_isPasswordVisible,
              keyboardType: isOtp ? TextInputType.number : TextInputType.text,
              textDirection: isOtp ? TextDirection.ltr : TextDirection.rtl,
              textAlign: isOtp ? TextAlign.right : TextAlign.right,
              style: const TextStyle(
                color: Colors.white,
                fontFamily: AppTheme.fontFamily,
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
              decoration: const InputDecoration(
                hintText: '', // No three dots or bullets
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),

          // Eye toggle icon placed at the FAR LEFT (trailing end in RTL)
          if (!isOtp)
            GestureDetector(
              onTap: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
              child: Padding(
                padding: const EdgeInsets.only(right: 6.0),
                child: Icon(
                  _isPasswordVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  color: const Color(0xFF8E889D),
                  size: 20,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Main Login Form
  Widget _buildLoginForm() {
    final bool isOtp = _loginMode == AuthLoginMode.otp;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Phone Label
        const Align(
          alignment: Alignment.centerRight,
          child: Text(
            'شماره همراه خود را وارد کنید',
            style: TextStyle(
              color: Color(0xFF8E889D),
              fontSize: 12,
              fontWeight: FontWeight.w400,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
        const SizedBox(height: 8),
        _buildPhoneNumberInput(),

        const SizedBox(height: 18),

        // 2. Secret Label
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            isOtp ? 'کد تایید پیامک‌شده را وارد کنید' : 'رمز خود را وارد کنید',
            style: const TextStyle(
              color: Color(0xFF8E889D),
              fontSize: 12,
              fontWeight: FontWeight.w400,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
        const SizedBox(height: 8),
        _buildSecretInput(),

        const SizedBox(height: 28),

        // 3. Centered Golden Submit CTA: "تایید و ورود"
        Center(
          child: GestureDetector(
            onTap: _isLoading ? null : _handleLogin,
            child: Container(
              width: 175,
              height: 44,
              decoration: BoxDecoration(
                gradient: AppColors.accentGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        'تایید و ورود',
                        style: TextStyle(
                          color: Colors.white,
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
    );
  }

  /// Bottom Footer: Campaign Name + Version Tag
  Widget _buildBottomFooter() {
    return Column(
      children: [
        const Text(
          'پویش خانواده انقلابی',
          style: TextStyle(
            color: Color(0xFFC7B299),
            fontSize: 14,
            fontWeight: FontWeight.w500,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'komeil 1.01.01',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.35),
            fontSize: 11,
            fontWeight: FontWeight.w400,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
      ],
    );
  }
}


typedef AuthScreen = LoginScreen;
