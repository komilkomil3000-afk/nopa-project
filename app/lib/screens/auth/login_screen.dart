import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import '../../widgets/nopa_modal_shell.dart';
import '../shell/app_shell.dart' show mainTabNotifier;
import '../../widgets/nopa_dialog_container.dart';
import 'dart:async';
import 'package:nopa_app/widgets/app_toast.dart';
import 'dart:convert';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/auth_service.dart';
import 'package:nopa_app/widgets/welcome_dialog.dart';

enum AuthLoginMode { otp, password }

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
  AuthLoginMode _loginMode = AuthLoginMode.password;

  // Animation controller for smooth logo entrance & float
  late final AnimationController _logoAnimCtrl;
  late final Animation<double> _logoScaleAnim;
  late final Animation<double> _logoFadeAnim;
  late final Animation<Offset> _logoFloatAnim;

  // Controllers
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _secretCtrl = TextEditingController();
  final FocusNode _phoneFocus = FocusNode();
  final FocusNode _secretFocus = FocusNode();
  final TextEditingController _honeypotCtrl = TextEditingController();

  _CountryOption _selectedCountry = _availableCountries.first;
  bool _isPasswordVisible = false;
  bool _isLoading = false;
  // True while we look for a saved session on startup; shows a loading screen instead of the form.
  bool _checkingSession = true;

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
    _phoneFocus.dispose();
    _secretFocus.dispose();
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
    try {
      await _apiService.loadSavedTokens();
      if (_apiService.hasSession) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt('last_app_exit_timestamp', DateTime.now().millisecondsSinceEpoch);
        AppRepository().recordActivity();

        final user = await _apiService.getMe();
        if (user != null && mounted) {
          final appRepo = Provider.of<AppRepository>(context, listen: false);
          appRepo.updateUser(user);
          if (user.isDualRole || user.role == UserRole.admin) {
            setState(() => _checkingSession = false);
            _showDualRoleSelectionDialog(user);
          } else {
            AuthService.selectedRole = user.role;
            await _enterApp(user.role);
          }
          return;
        }
      }
    } catch (e) {
      debugPrint('Auto-login check failed: $e');
    }
    if (mounted) setState(() => _checkingSession = false);
  }

  Future<void> _navigateToDashboardWithWelcome(UserRole role) async {
    AuthService.selectedRole = role;
    if (!mounted) return;
    await WelcomeDialog.show(context);
    if (!mounted) return;
    await _enterApp(role);
  }

  /// Loads the first page's data behind the loading screen, then opens the app on the home tab
  /// (so no stale tab such as the profile flashes before the real page).
  Future<void> _enterApp(UserRole role) async {
    if (!mounted) return;
    setState(() => _checkingSession = true);
    final repo = Provider.of<AppRepository>(context, listen: false);
    final api = HttpApiService();
    final minDelay = Future.delayed(const Duration(milliseconds: 2200));
    try {
      final jobs = <Future<dynamic>>[
        api.getStations(),
        api.getBanners(position: 'home_top'),
        if (role.isMentorLike) repo.fetchCaravans(),
        repo.refreshChallenges(),
        repo.fetchNotifications(),
      ];
      await Future.wait(jobs.map((f) => f.catchError((_) => null)))
          .timeout(const Duration(seconds: 8), onTimeout: () => <dynamic>[]);
    } catch (e) {
      debugPrint('Home preload failed: $e');
    }
    await minDelay;
    if (!mounted) return;
    mainTabNotifier.value = 0;
    Navigator.pushReplacementNamed(context, AppRoutes.dashboard, arguments: role);
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

  /// The typed number in the form the server stores: 09xxxxxxxxx (accepts 9xxxxxxxxx, 09xxxxxxxxx, +989..., 00989...).
  String _normalizedPhone(String raw) {
    var p = _toEnglishDigits(raw).replaceAll(RegExp(r'[^0-9]'), '');
    if (p.startsWith('0098')) {
      p = p.substring(4);
    } else if (p.startsWith('98') && p.length >= 12) {
      p = p.substring(2);
    }
    if (p.startsWith('0')) p = p.substring(1);
    return p.isEmpty ? '' : '0$p';
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
    showNopaSheet(
      context,
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
                  style: AppTypography.h2,
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
                          style: AppTypography.bodyLarge.copyWith(color: isSelected ? AppColors.accentGoldEnd : Colors.white),
                        ),
                        trailing: Text(
                          item.code,
                          textDirection: TextDirection.ltr,
                          style: AppTypography.h3Strong.copyWith(color: isSelected ? AppColors.accentGoldEnd : const Color(0xFF8E889D)),
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
    final phone = _normalizedPhone(_phoneCtrl.text);
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
      AppToast.info(context, res['message'] ?? 'کد تأیید برای شماره شما ارسال شد.');
    } else if (res['status'] == 'rate_limited') {
      final retryAfter = (res['retryAfter'] as num?)?.toInt() ?? 119;
      _startCountdownTimer(retryAfter);
      AppToast.error(context, res['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.');
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

  /// Blocking step shown right after an SMS-code login: the user must choose a
  /// new fixed password before entering the app.
  Future<void> _requireNewPassword() async {
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    String? errorText;
    bool saving = false;
    bool obscure = true;

    await showNopaDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return PopScope(
          canPop: false,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: StatefulBuilder(
              builder: (ctx, setDialogState) {
                InputDecoration deco(String label) => InputDecoration(
                      labelText: label,
                      labelStyle: const TextStyle(color: Color(0xFF8E889D), fontFamily: AppTheme.fontFamily),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Colors.white24),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.accentGoldEnd),
                      ),
                    );

                Future<void> submit() async {
                  final pass = newCtrl.text.trim();
                  if (pass.length < 4) {
                    setDialogState(() => errorText = 'رمز عبور باید حداقل ۴ کاراکتر باشد');
                    return;
                  }
                  if (pass != confirmCtrl.text.trim()) {
                    setDialogState(() => errorText = 'رمز عبور و تکرار آن یکسان نیستند');
                    return;
                  }
                  setDialogState(() {
                    errorText = null;
                    saving = true;
                  });
                  final ok = await _apiService.changePassword(null, pass);
                  if (!ctx.mounted) return;
                  if (ok) {
                    Navigator.pop(ctx);
                  } else {
                    setDialogState(() {
                      saving = false;
                      errorText = 'ذخیره رمز عبور ناموفق بود. دوباره تلاش کنید';
                    });
                  }
                }

                return Dialog(
                  backgroundColor: Colors.transparent,
                  insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: NopaDialogContainer(
                    maxWidth: 420,
                    radius: 24,
                    padding: const EdgeInsets.all(22),
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'تعیین رمز عبور جدید',
                            textAlign: TextAlign.center,
                            style: AppTypography.h2,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'برای ورود به برنامه ابتدا یک رمز عبور ثابت جدید تعیین کنید. دفعات بعد می‌توانید با همین رمز وارد شوید.',
                            textAlign: TextAlign.center,
                            style: AppTypography.bodyMedium.copyWith(color: Colors.white70),
                          ),
                          const SizedBox(height: 18),
                          TextField(
                            controller: newCtrl,
                            obscureText: obscure,
                            style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                            decoration: deco('رمز عبور جدید').copyWith(
                              suffixIcon: IconButton(
                                icon: Icon(
                                  obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  color: const Color(0xFF8E889D),
                                  size: 20,
                                ),
                                onPressed: () => setDialogState(() => obscure = !obscure),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: confirmCtrl,
                            obscureText: obscure,
                            style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily),
                            decoration: deco('تکرار رمز عبور'),
                          ),
                          if (errorText != null) ...[
                            const SizedBox(height: 10),
                            Text(
                              errorText!,
                              style: AppTypography.bodyMedium.copyWith(color: Colors.redAccent),
                            ),
                          ],
                          const SizedBox(height: 18),
                          TapExpander(child: GestureDetector(
                            onTap: saving ? null : submit,
                            child: Container(
                              height: 44,
                              decoration: BoxDecoration(
                                gradient: AppColors.accentGradient,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: saving
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Text(
                                        'ثبت رمز و ورود',
                                        style: AppTypography.h3,
                                      ),
                              ),
                            ),
                          )),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );

    newCtrl.dispose();
    confirmCtrl.dispose();
  }

  Future<void> _processLoginResponse(dynamic response) async {
    if (response == null) {
      _showError('ارتباط با سرور برقرار نشد. اگر فیلترشکن شما روشن است، لطفاً آن را خاموش کنید.');
      return;
    }

    if (response['status'] == 'rate_limited') {
      final retryAfter = (response['retryAfter'] as num?)?.toInt() ?? 119;
      _startCountdownTimer(retryAfter);
      AppToast.error(context, response['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.');
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
      } else if (userRoleStr == 'channel_manager') {
        resolvedRole = UserRole.channelManager;
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

      // Logged in via SMS code (forgot password): force a new fixed password first.
      if (_loginMode == AuthLoginMode.otp) {
        await _requireNewPassword();
        if (!mounted) return;
      }

      if (isDualRole) {
        _showDualRoleSelectionDialog(loggedInUser);
      } else {
        _navigateToDashboardWithWelcome(resolvedRole);
      }
    }
  }

  void _showDualRoleSelectionDialog(UserModel user) {
    showNopaDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: NopaDialogContainer(
              maxWidth: 420,
              radius: 24,
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
                    style: AppTypography.h2,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${user.name} عزیز، شما دارای دسترسی چندگانه هستید. مایلید با کدام نقش وارد شوید؟',
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyLarge.copyWith(color: Colors.white70),
                  ),
                  const SizedBox(height: 22),
                  _buildRoleCard(
                    title: 'ورود به عنوان راهبر (مربی)',
                    description: 'مشاهده اعضا، مدیریت تکالیف و چالش‌ها، ارزیابی‌ها و گزارش‌ها',
                    icon: Icons.supervisor_account_rounded,
                    gradientColors: const [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                    onTap: () async {
                      Navigator.pop(ctx);
                      final appRepo = Provider.of<AppRepository>(context, listen: false);
                      appRepo.setActiveRole(UserRole.mentor);
                      await _navigateToDashboardWithWelcome(UserRole.mentor);
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildRoleCard(
                    title: 'ورود به عنوان دانش‌آموز',
                    description: 'مشاهده جلسات آموزشی، ثبت تکالیف، نقشه پیشرفت و بازارچه',
                    icon: Icons.school_rounded,
                    gradientColors: const [Color(0xFFCD8449), AppColors.accentGoldEnd],
                    onTap: () async {
                      Navigator.pop(ctx);
                      final appRepo = Provider.of<AppRepository>(context, listen: false);
                      appRepo.setActiveRole(UserRole.member);
                      await _navigateToDashboardWithWelcome(UserRole.member);
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
      child: TapExpander(child: InkWell(
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
                      style: AppTypography.h3,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: AppTypography.caption.copyWith(color: Colors.white60),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 16),
            ],
          ),
        ),
      )),
    );
  }

  void _showProfileSwitcher(List<dynamic> profiles) {
    showNopaSheet(
      context,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('انتخاب حساب کاربری', style: AppTypography.h2),
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
    String phone = _normalizedPhone(_phoneCtrl.text);
    String password = _secretCtrl.text.trim();
    final response = await _apiService.login(phone, password: password, role: role, otp: _loginMode == AuthLoginMode.otp);
    _processLoginResponse(response);
  }

  void _showError(String message) {
    AppToast.error(context, message);
  }

  void _showWarning(String message) {
    AppToast.error(context, message);
  }

  Future<void> _handleLogin() async {
    String phone = _normalizedPhone(_phoneCtrl.text);
    if (phone.isEmpty) {
      _showError('لطفاً شماره تلفن همراه را وارد کنید');
      return;
    }

    String password;
    if (_loginMode == AuthLoginMode.otp) {
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
    final response = await _apiService.login(phone, password: password, otp: _loginMode == AuthLoginMode.otp);
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
            image: DecorationImage(
              image: AssetImage('assets/images/login_bg.png'),
              fit: BoxFit.cover,
            ),
          ),
          child: _checkingSession
              ? const _SessionLoading()
              : SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                      maxWidth: 420,
                    ),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(height: 28),

                                // 1. Top Header: SVG Logo (nopa_logo.svg) above Persian Poetry
                                _buildTopHeader(),

                                const SizedBox(height: 24),

                                // 3. Login Form
                                _buildLoginForm(),
                              ],
                            ),

                            // 4. Bottom Footer: Campaign & Version pinned to bottom
                            Padding(
                              padding: const EdgeInsets.only(top: 24.0, bottom: 12.0),
                              child: _buildBottomFooter(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
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
                  Text(
                    'گر چه راهیست پر از بیم ز ما تا بر دوست\nرفتن آسان بود ار واقف منزل باشی',
                    textAlign: TextAlign.center,
                    style: AppTypography.caption.copyWith(color: Color(0xFFC7B299)),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Input Container with Gradient Border
  Widget _buildDecoratedInputBox({required Widget child, EdgeInsetsGeometry? padding, FocusNode? focusNode}) {
    // Tapping anywhere in the box (not only on the text) puts the cursor in the field
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: focusNode?.requestFocus,
      child: _decoratedInputBoxBody(child: child, padding: padding),
    );
  }

  Widget _decoratedInputBoxBody({required Widget child, EdgeInsetsGeometry? padding}) {
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
      focusNode: _phoneFocus,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Right in RTL: Phone Text Field
          Expanded(
            child: TextField(
              controller: _phoneCtrl,
              focusNode: _phoneFocus,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.right,
              style: AppTypography.h2.copyWith(letterSpacing: 1.0),
              decoration: InputDecoration(
                hintText: '9123456789',
                hintStyle: AppTypography.bodyLarge.copyWith(color: Colors.white24),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),

          Container(
            width: 1,
            height: 24,
            margin: const EdgeInsets.symmetric(horizontal: 8),
            color: const Color(0xFF6C6C63).withValues(alpha: 0.35),
          ),

          // Left of the number: Clickable Country Selector (Flag + Code + Dropdown Chevron)
          TapExpander(child: InkWell(
            onTap: _openCountryPickerModal,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 2.0),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _selectedCountry.code,
                    // LTR so the plus sits on the left: +98, not 98+
                    textDirection: TextDirection.ltr,
                    style: AppTypography.h3,
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
                ],
              ),
            ),
          )),

          // Left Side in RTL: Inline "ارسال کد" / Countdown Button
          if (_loginMode == AuthLoginMode.otp) ...[
            const SizedBox(width: 8),
            _buildOtpDispatchInlineButton(),
          ],
        ],
      ),
    );
  }

  /// Inline OTP Dispatch Button inside Phone Input (Camel color and stroke matching Create Message)
  Widget _buildOtpDispatchInlineButton() {
    final bool isTimerActive = _cooldownRemainingSeconds > 0;
    final String buttonLabel = isTimerActive
        ? _formatTimer(_cooldownRemainingSeconds)
        : (_hasSentOnce ? 'ارسال مجدد' : 'ارسال کد');

    return TapExpander(child: GestureDetector(
      onTap: (_isSendingCode || isTimerActive) ? null : _handleSendVerificationCode,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: AppColors.buttonCamel,
            width: 1.0,
          ),
        ),
        child: _isSendingCode
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.buttonCamel),
              )
            : Text(
                buttonLabel,
                style: AppTypography.caption.copyWith(color: isTimerActive ? const Color(0xFFC7B299) : AppColors.accentGoldEnd),
              ),
      ),
    ));
  }

  /// Secret / Password Input Widget:
  /// - In OTP mode: NO three dots / bullets, clean empty text box.
  /// - In Password mode: Eye toggle icon placed at the FAR LEFT of the box.
  Widget _buildSecretInput() {
    final bool isOtp = _loginMode == AuthLoginMode.otp;

    return _buildDecoratedInputBox(
      focusNode: _secretFocus,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Text Input (Starts on the Right in RTL)
          Expanded(
            child: TextField(
              controller: _secretCtrl,
              focusNode: _secretFocus,
              obscureText: !isOtp && !_isPasswordVisible,
              keyboardType: isOtp ? TextInputType.number : TextInputType.text,
              textDirection: isOtp ? TextDirection.ltr : TextDirection.rtl,
              textAlign: isOtp ? TextAlign.right : TextAlign.right,
              style: AppTypography.bodyLarge,
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
            TapExpander(child: GestureDetector(
              onTap: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
              child: Padding(
                padding: const EdgeInsets.only(right: 6.0),
                child: Icon(
                  _isPasswordVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  color: const Color(0xFF8E889D),
                  size: 20,
                ),
              ),
            )),
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
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            'شماره همراه خود را وارد کنید',
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFF8E889D)),
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
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFF8E889D)),
          ),
        ),
        const SizedBox(height: 8),
        _buildSecretInput(),

        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerRight,
          child: TapExpander(child: GestureDetector(
            onTap: () {
              setState(() {
                _loginMode = isOtp ? AuthLoginMode.password : AuthLoginMode.otp;
                _secretCtrl.clear();
                _isPasswordVisible = false;
              });
            },
            child: Text(
              isOtp ? 'بازگشت به ورود با رمز عبور' : 'رمز عبور را فراموش کرده‌ام (ورود با کد پیامکی)',
              style: AppTypography.bodyLarge.copyWith(color: AppColors.accentGoldEnd),
            ),
          )),
        ),

        const SizedBox(height: 18),

        // 3. Centered Golden Submit CTA: "تایید و ورود"
        Center(
          child: TapExpander(child: GestureDetector(
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
                        style: AppTypography.h3,
                      ),
              ),
            ),
          )),
        ),
      ],
    );
  }

  /// Bottom Footer: Campaign Name + Version Tag
  Widget _buildBottomFooter() {
    return Column(
      children: [
        Text(
          'پویش خانواده انقلابی',
          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7B299)),
        ),
        const SizedBox(height: 4),
        Text(
          'komeil 1.01.01',
          style: AppTypography.caption.copyWith(color: Colors.white.withValues(alpha: 0.35)),
        ),
      ],
    );
  }
}


/// Shown on startup while a saved session is being verified.
class _SessionLoading extends StatelessWidget {
  const _SessionLoading();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset('assets/images/nopa_logo.svg', height: 110),
          const SizedBox(height: 32),
          const SizedBox(
            width: 34,
            height: 34,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFCD8449)),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'در حال ورود به نپا',
            style: AppTypography.bodyLarge,
          ),
        ],
      ),
    );
  }
}
