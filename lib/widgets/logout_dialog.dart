import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';

class LogoutDialog extends StatefulWidget {
  const LogoutDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => const LogoutDialog(),
    );
  }

  @override
  State<LogoutDialog> createState() => _LogoutDialogState();
}

class _LogoutDialogState extends State<LogoutDialog> {
  bool _isLoading = false;

  Future<void> _handleLogout() async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    try {
      final appRepo = Provider.of<AppRepository>(context, listen: false);
      final phone = appRepo.currentUser.phoneNumber;
      if (phone.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('saved_login_phone', phone);
      }

      await appRepo.logout();

      if (mounted) {
        Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
          '/auth',
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'خطا در خروج از حساب: $e',
              style: const TextStyle(fontFamily: AppTheme.fontFamily),
            ),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
          decoration: BoxDecoration(
            color: const Color(0xFF2C2849),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 24,
                spreadRadius: 2,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Title Question
              const Text(
                'واقعا میخواهید از برنامه خارج شوید؟',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),

              // Action Buttons Row
              Row(
                children: [
                  // 1. Right Button (in RTL): نه، دستم خورد
                  Expanded(
                    child: InkWell(
                      onTap: _isLoading ? null : () => Navigator.pop(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFF7A709E),
                            width: 1.1,
                          ),
                        ),
                        child: const Text(
                          'نه، دستم خورد',
                          style: TextStyle(
                            color: Color(0xFFDDD9EE),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // 2. Left Button (in RTL): آره ولی زود برمیگردم
                  Expanded(
                    child: InkWell(
                      onTap: _isLoading ? null : _handleLogout,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFC09268),
                            width: 1.1,
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFE5A855),
                                ),
                              )
                            : const Text(
                                'آره ولی زود برمیگردم',
                                style: TextStyle(
                                  color: Color(0xFFE5A855),
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                                textAlign: TextAlign.center,
                              ),
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
}
