import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';

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
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 26),
          decoration: AppColors.loginDialogDecoration(radius: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Icon / Badge
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFC09268).withValues(alpha: 0.2),
                  border: Border.all(
                    color: const Color(0xFFC09268).withValues(alpha: 0.6),
                    width: 1.2,
                  ),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.check_circle_outline_rounded,
                  color: Color(0xFFE5A855),
                  size: 28,
                ),
              ),
              const SizedBox(height: 18),

              // Title Message
              const Text(
                'ورود شما با موفقیت انجام شد خوش آمدید.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Action Button: ادامه
              SizedBox(
                width: double.infinity,
                child: InkWell(
                  onTap: () {
                    Navigator.of(context).pop();
                    if (onContinue != null) {
                      onContinue!();
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFFC09268),
                        width: 1.2,
                      ),
                    ),
                    child: const Text(
                      'ادامه',
                      style: TextStyle(
                        color: Color(0xFFE5A855),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
