import 'package:flutter/material.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/app_state_repository.dart';
import 'nopa_modal_shell.dart';

class LogoutDialog extends StatefulWidget {
  const LogoutDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showNopaDialog(
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
          AppRoutes.auth,
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        AppToast.error(context, 'خطایی رخ داده است. خطا در خروج از حساب');
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
        child: NopaModalShell(
          maxWidth: 400,
          headerIcon: Icons.logout_rounded,
          title: 'واقعا میخواهید از برنامه خارج شوید؟',
          actions: [
            NopaModalAction(
              label: 'آره ولی زود برمیگردم',
              variant: NopaModalActionVariant.primary,
              loading: _isLoading,
              onPressed: _handleLogout,
            ),
            NopaModalAction(
              label: 'نه، دستم خورد',
              variant: NopaModalActionVariant.secondary,
              onPressed: _isLoading ? null : () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }
}
