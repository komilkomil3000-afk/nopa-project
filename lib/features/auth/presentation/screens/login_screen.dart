import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/user_model.dart';
import '../../../../services/api_service.dart';
import '../../../../services/app_state_repository.dart';
import '../../../../services/auth_service.dart';

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
  _CountryOption(name: 'افغانستان', code: '+93', flag: '🇦🇫'),
  _CountryOption(name: 'تاجیکستان', code: '+992', flag: '🇹🇯'),
  _CountryOption(name: 'عراق', code: '+964', flag: '🇮🇶'),
  _CountryOption(name: 'ترکیه', code: '+90', flag: '🇹🇷'),
  _CountryOption(name: 'امارات متحده عربی', code: '+971', flag: '🇦🇪'),
  _CountryOption(name: 'عمان', code: '+968', flag: '🇴🇲'),
  _CountryOption(name: 'عربستان سعودی', code: '+966', flag: '🇸🇦'),
  _CountryOption(name: 'قطر', code: '+974', flag: '🇶🇦'),
  _CountryOption(name: 'کویت', code: '+965', flag: '🇰🇼'),
  _CountryOption(name: 'بحرین', code: '+973', flag: '🇧🇭'),
  _CountryOption(name: 'لبنان', code: '+961', flag: '🇱🇧'),
  _CountryOption(name: 'سوریه', code: '+963', flag: '🇸🇾'),
  _CountryOption(name: 'یمن', code: '+967', flag: '🇾🇪'),
  _CountryOption(name: 'اردن', code: '+962', flag: '🇯🇴'),
  _CountryOption(name: 'پاکستان', code: '+92', flag: '🇵🇰'),
  _CountryOption(name: 'ترکمنستان', code: '+993', flag: '🇹🇲'),
  _CountryOption(name: 'ازبکستان', code: '+998', flag: '🇺🇿'),
  _CountryOption(name: 'آذربایجان', code: '+994', flag: '🇦🇿'),
  _CountryOption(name: 'ارمنستان', code: '+374', flag: '🇦🇲'),
  _CountryOption(name: 'گرجستان', code: '+995', flag: '🇬🇪'),
  _CountryOption(name: 'قزاقستان', code: '+7', flag: '🇰🇿'),
  _CountryOption(name: 'روسیه', code: '+7', flag: '🇷🇺'),
  _CountryOption(name: 'آلمان', code: '+49', flag: '🇩🇪'),
  _CountryOption(name: 'بریتانیا (انگلستان)', code: '+44', flag: '🇬🇧'),
  _CountryOption(name: 'فرانسه', code: '+33', flag: '🇫🇷'),
  _CountryOption(name: 'ایتالیا', code: '+39', flag: '🇮🇹'),
  _CountryOption(name: 'کانادا', code: '+1', flag: '🇨🇦'),
  _CountryOption(name: 'ایالات متحده آمریکا', code: '+1', flag: '🇺🇸'),
  _CountryOption(name: 'سوئد', code: '+46', flag: '🇸🇪'),
  _CountryOption(name: 'سوئیس', code: '+41', flag: '🇨🇭'),
  _CountryOption(name: 'نروژ', code: '+47', flag: '🇳🇴'),
  _CountryOption(name: 'هلند', code: '+31', flag: '🇳🇱'),
  _CountryOption(name: 'دانمارک', code: '+45', flag: '🇩🇰'),
  _CountryOption(name: 'اتریش', code: '+43', flag: '🇦🇹'),
  _CountryOption(name: 'بلژیک', code: '+32', flag: '🇧🇪'),
  _CountryOption(name: 'اسپانیا', code: '+34', flag: '🇪🇸'),
  _CountryOption(name: 'پرتغال', code: '+351', flag: '🇵🇹'),
  _CountryOption(name: 'یونان', code: '+30', flag: '🇬🇷'),
  _CountryOption(name: 'فنلاند', code: '+358', flag: '🇫🇮'),
  _CountryOption(name: 'لهستان', code: '+48', flag: '🇵🇱'),
  _CountryOption(name: 'اوکراین', code: '+380', flag: '🇺🇦'),
  _CountryOption(name: 'استرالیا', code: '+61', flag: '🇦🇺'),
  _CountryOption(name: 'نیوزیلند', code: '+64', flag: '🇳🇿'),
  _CountryOption(name: 'هند', code: '+91', flag: '🇮🇳'),
  _CountryOption(name: 'چین', code: '+86', flag: '🇨🇳'),
  _CountryOption(name: 'ژاپن', code: '+81', flag: '🇯🇵'),
  _CountryOption(name: 'کره جنوبی', code: '+82', flag: '🇰🇷'),
  _CountryOption(name: 'مالزی', code: '+60', flag: '🇲🇾'),
  _CountryOption(name: 'اندونزی', code: '+62', flag: '🇮🇩'),
  _CountryOption(name: 'تایلند', code: '+66', flag: '🇹🇭'),
  _CountryOption(name: 'سنگاپور', code: '+65', flag: '🇸🇬'),
  _CountryOption(name: 'برزیل', code: '+55', flag: '🇧🇷'),
  _CountryOption(name: 'آرژانتین', code: '+54', flag: '🇦🇷'),
  _CountryOption(name: 'مصر', code: '+20', flag: '🇪🇬'),
  _CountryOption(name: 'آفریقای جنوبی', code: '+27', flag: '🇿🇦'),
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

    _phoneCtrl.addListener(_onPhoneChanged);
    _loadSavedPhone();
    _checkAutoLogin();
  }

  void _onPhoneChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  bool get _isPhoneComplete {
    final raw = _toEnglishDigits(_phoneCtrl.text).replaceAll(RegExp(r'\D'), '');
    if (_selectedCountry.code == '+98') {
      return raw.length >= 10;
    }
    return raw.length >= 7;
  }

  @override
  void dispose() {
    _phoneCtrl.removeListener(_onPhoneChanged);
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
    String searchQuery = '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filteredCountries = _availableCountries.where((c) {
              final q = searchQuery.trim().toLowerCase();
              if (q.isEmpty) return true;
              return c.name.toLowerCase().contains(q) ||
                  c.code.replaceAll('+', '').contains(q.replaceAll('+', ''));
            }).toList();

            return Directionality(
              textDirection: TextDirection.rtl,
              child: Container(
                height: MediaQuery.of(context).size.height * 0.72,
                decoration: const BoxDecoration(
                  gradient: AppColors.screenBackgroundGradient,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  image: DecorationImage(
                    image: AssetImage('assets/images/login_bg.png'),
                    fit: BoxFit.cover,
                  ),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                child: Column(
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'انتخاب کشور و پیش‌شماره',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Search Bar
                    Container(
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: const Color(0xFF6C6C63).withValues(alpha: 0.35),
                          width: 0.8,
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Row(
                        children: [
                          const Icon(Icons.search, color: Color(0xFF8E889D), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              onChanged: (val) {
                                setModalState(() {
                                  searchQuery = val;
                                });
                              },
                              style: const TextStyle(
                                color: Colors.white,
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'جستجوی نام کشور یا پیش‌شماره...',
                                hintStyle: TextStyle(
                                  color: Color(0xFF8E889D),
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 12,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: ListView.separated(
                        itemCount: filteredCountries.length,
                        separatorBuilder: (_, _) => Divider(
                          color: Colors.white.withValues(alpha: 0.07),
                          height: 1,
                        ),
                        itemBuilder: (context, idx) {
                          final item = filteredCountries[idx];
                          final isSelected = item.code == _selectedCountry.code && item.name == _selectedCountry.name;

                          return ListTile(
                            leading: Text(item.flag, style: const TextStyle(fontSize: 22)),
                            title: Text(
                              item.name,
                              style: TextStyle(
                                color: isSelected ? AppColors.accentGoldEnd : Colors.white,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13.5,
                              ),
                            ),
                            trailing: Text(
                              item.code,
                              style: TextStyle(
                                color: isSelected ? AppColors.accentGoldEnd : const Color(0xFF8E889D),
                                fontWeight: FontWeight.w600,
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13.5,
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

      _showLoginSuccessDialog(
        user: loggedInUser,
        resolvedRole: resolvedRole,
        isDualRole: isDualRole,
      );
    }
  }

  void _showLoginSuccessDialog({
    required UserModel user,
    required UserRole resolvedRole,
    required bool isDualRole,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 440),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 30),
              decoration: BoxDecoration(
                color: const Color(0xFF2D2E4B),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 28,
                    spreadRadius: 2,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text(
                    'ورود موفق',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'باموفقیت احراز هویت شدید. خوش آمدید!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF9EA1BA),
                      fontSize: 15,
                      fontWeight: FontWeight.w400,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Center(
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          Navigator.pop(ctx);
                          if (isDualRole) {
                            _showDualRoleSelectionDialog(user);
                          } else {
                            AuthService.selectedRole = resolvedRole;
                            Navigator.pushReplacementNamed(context, '/dashboard', arguments: resolvedRole);
                          }
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF282842),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: const Color(0xFF8B6343),
                              width: 1.1,
                            ),
                          ),
                          child: const Text(
                            'ادامه',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFD6D7E5),
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ),
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
  }

  void _showDualRoleSelectionDialog(UserModel user) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 440),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
              decoration: BoxDecoration(
                color: const Color(0xFF2D2E4B),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 28,
                    spreadRadius: 2,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text(
                    'با کدام نقش‌تان می‌خواهید وارد شوید؟',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 12,
                    runSpacing: 10,
                    children: [
                      _buildRoleActionButton(
                        text: 'ورود به عنوان راهبر',
                        borderColor: const Color(0xFF6E688E),
                        onTap: () {
                          Navigator.pop(ctx);
                          final appRepo = Provider.of<AppRepository>(context, listen: false);
                          appRepo.setActiveRole(UserRole.mentor);
                          AuthService.selectedRole = UserRole.mentor;
                          Navigator.pushReplacementNamed(context, '/dashboard', arguments: UserRole.mentor);
                        },
                      ),
                      _buildRoleActionButton(
                        text: 'ورود به عنوان دانش آموز',
                        borderColor: const Color(0xFF8B6343),
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
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildRoleActionButton({
    required String text,
    required Color borderColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF282842),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: borderColor,
              width: 1.1,
            ),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFFD6D7E5),
              fontSize: 14.5,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
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
    final mediaQuery = MediaQuery.of(context);
    final screenHeight = mediaQuery.size.height;
    final screenWidth = mediaQuery.size.width;
    final double topSpacing = (screenHeight * 0.065).clamp(20.0, 64.0);
    final double horizontalPadding = (screenWidth * 0.06).clamp(16.0, 26.0);

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
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: screenHeight - mediaQuery.padding.top - mediaQuery.padding.bottom,
                ),
                child: IntrinsicHeight(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: horizontalPadding, vertical: 8.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SizedBox(height: topSpacing),

                        // 1. Top Header: SVG Logo (nopa_logo.svg) above Persian Poetry
                        _buildTopHeader(),

                        const SizedBox(height: 14),

                        // 2. Segmented Mode Switcher: OTP vs Password + Test badge (Responsive & Zero Overflow)
                        _buildSegmentedModeSwitcher(),

                        const SizedBox(height: 14),

                        // 3. Login Form
                        _buildLoginForm(),

                        const Spacer(),

                        // 4. Bottom Footer: Campaign & Version
                        _buildBottomFooter(),

                        const SizedBox(height: 10),
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
                    height: 126,
                    child: SvgPicture.asset(
                      'assets/images/nopa_logo.svg',
                      fit: BoxFit.contain,
                      placeholderBuilder: (BuildContext context) => const Center(
                        child: SizedBox(
                          width: 26,
                          height: 26,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFFCD8449),
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Persian Poetry Subtitle
                  const Text(
                    'گر چه راهیست پر از بیم ز ما تا بر دوست\nرفتن آسان بود ار واقف منزل باشی',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFC7B299),
                      fontSize: 11,
                      height: 1.5,
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

  /// Segmented Mode Switcher (Wrapped in FittedBox to guarantee 0px overflow on all screen sizes)
  Widget _buildSegmentedModeSwitcher() {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
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
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6.5),
                decoration: BoxDecoration(
                  gradient: _loginMode == AuthLoginMode.testBypass ? AppColors.accentGradient : AppColors.darkSurfaceGradient,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  'آزمایشی',
                  style: TextStyle(
                    color: _loginMode == AuthLoginMode.testBypass ? Colors.white : const Color(0xFFC7B299),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          gradient: isSelected ? AppColors.accentGradient : null,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF8E889D),
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontFamily: AppTheme.fontFamily,
          ),
        ),
      ),
    );
  }

  /// Input Container with Gradient Border and Responsive MinHeight
  Widget _buildDecoratedInputBox({required Widget child, EdgeInsetsGeometry? padding}) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(9),
        ),
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
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
                      fontSize: 14,
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
                    height: 22,
                    color: const Color(0xFF6C6C63).withValues(alpha: 0.35),
                  ),
                  const SizedBox(width: 6),
                ],
              ),
            ),
          ),

          // Center: Phone Text Field (Reactive onChange updates "ارسال کد" instantly, max 10 chars)
          Expanded(
            child: TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.right,
              inputFormatters: [
                LengthLimitingTextInputFormatter(10),
              ],
              onChanged: (_) => setState(() {}),
              style: const TextStyle(
                color: Colors.white,
                fontFamily: AppTheme.fontFamily,
                fontSize: 15.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.0,
              ),
              decoration: const InputDecoration(
                hintText: '9380346668',
                hintStyle: TextStyle(color: Colors.white24, fontFamily: AppTheme.fontFamily, fontSize: 14),
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
  /// Enabled ONLY when a valid full phone number (>= 10 digits) is entered
  Widget _buildOtpDispatchInlineButton() {
    final bool isTimerActive = _cooldownRemainingSeconds > 0;
    final bool isEnabled = _isPhoneComplete && !isTimerActive && !_isSendingCode;
    final String buttonLabel = isTimerActive
        ? _formatTimer(_cooldownRemainingSeconds)
        : (_hasSentOnce ? 'ارسال مجدد' : 'ارسال کد');

    return GestureDetector(
      onTap: isEnabled ? _handleSendVerificationCode : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(7),
          border: Border.all(
            color: isTimerActive
                ? const Color(0xFF6C6C63).withValues(alpha: 0.35)
                : (isEnabled
                    ? const Color(0xFFCD8449).withValues(alpha: 0.6)
                    : const Color(0xFF6C6C63).withValues(alpha: 0.2)),
            width: 0.8,
          ),
        ),
        child: _isSendingCode
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFCD8449)),
              )
            : Text(
                buttonLabel,
                style: TextStyle(
                  color: isTimerActive
                      ? const Color(0xFFC7B299)
                      : (isEnabled
                          ? const Color(0xFFCD8449)
                          : const Color(0xFF8E889D).withValues(alpha: 0.45)),
                  fontWeight: isEnabled ? FontWeight.bold : FontWeight.w500,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                  fontSize: 11,
                ),
              ),
      ),
    );
  }

  /// Secret / Password Input Widget:
  /// - In OTP mode: NO three dots / bullets, clean empty text box, max 10 chars.
  /// - In Password mode: Eye toggle icon placed at the FAR LEFT of the box, max 10 chars.
  Widget _buildSecretInput() {
    final bool isOtp = _loginMode == AuthLoginMode.otp;

    return _buildDecoratedInputBox(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Text Input (Starts on the Right in RTL, limited to 10 chars)
          Expanded(
            child: TextField(
              controller: _secretCtrl,
              obscureText: !isOtp && !_isPasswordVisible,
              keyboardType: isOtp ? TextInputType.number : TextInputType.text,
              textDirection: isOtp ? TextDirection.ltr : TextDirection.rtl,
              textAlign: isOtp ? TextAlign.right : TextAlign.right,
              inputFormatters: [
                LengthLimitingTextInputFormatter(10),
              ],
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
        // 1. Phone Label (Concise)
        const Align(
          alignment: Alignment.centerRight,
          child: Text(
            'شماره همراه',
            style: TextStyle(
              color: Color(0xFF8E889D),
              fontSize: 12,
              fontWeight: FontWeight.w400,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
        const SizedBox(height: 6),
        _buildPhoneNumberInput(),

        const SizedBox(height: 12),

        // 2. Secret Label (Concise)
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            isOtp ? 'کد تایید' : 'رمز عبور',
            style: const TextStyle(
              color: Color(0xFF8E889D),
              fontSize: 12,
              fontWeight: FontWeight.w400,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
        const SizedBox(height: 6),
        _buildSecretInput(),

        const SizedBox(height: 18),

        // 3. Centered Golden Submit CTA: "تایید و ورود"
        Center(
          child: GestureDetector(
            onTap: _isLoading ? null : _handleLogin,
            child: Container(
              width: 170,
              height: 42,
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
                          fontSize: 13.5,
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
    final footerColor = Colors.white.withValues(alpha: 0.35);

    return Column(
      children: [
        Text(
          'پویش خانواده انقلابی',
          style: TextStyle(
            color: footerColor,
            fontSize: 11.5,
            fontWeight: FontWeight.w400,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'komeil 1.01.01',
          style: TextStyle(
            color: footerColor,
            fontSize: 10.5,
            fontWeight: FontWeight.w400,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
        ),
      ],
    );
  }
}
