import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import '../core/theme/app_typography.dart';
import 'nopa_modal_shell.dart';

class WelcomeDialog extends StatelessWidget {
  final VoidCallback? onContinue;

  const WelcomeDialog({super.key, this.onContinue});

  static Future<void> show(BuildContext context, {VoidCallback? onContinue}) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => WelcomeDialog(onContinue: onContinue),
    );
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
          headerIcon: Icons.check_circle_outline_rounded,
          title: 'خوش آمدید',
          actions: [
            NopaModalAction(
              label: 'ادامه',
              onPressed: () {
                Navigator.of(context).pop();
                if (onContinue != null) {
                  onContinue!();
                }
              },
            ),
          ],
          child: const Text(
            'ورود شما با موفقیت انجام شد خوش آمدید.',
            style: AppTypography.bodyBold01White,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
