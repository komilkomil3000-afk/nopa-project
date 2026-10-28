import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import 'nopa_dialog_container.dart';

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
        child: NopaDialogContainer(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
          radius: 24,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Header: Right-aligned Icon + Centered Title in RTL Stack
              Stack(
                alignment: Alignment.center,
                children: [
                  // Icon on Right in RTL
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
                        Icons.check_circle_outline_rounded,
                        color: AppColors.buttonCamel,
                        size: 22,
                      ),
                    ),
                  ),

                  // Title in Center
                  const Text(
                    'خوش آمدید',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Welcome Body Message
              const Text(
                'ورود شما با موفقیت انجام شد خوش آمدید.',
                style: TextStyle(
                  color: Color(0xFFE2E0F0),
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  fontFamily: AppTheme.fontFamily,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Bottom Actions: ادامه on Right (camel color)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Right in RTL: ادامه (Camel color)
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      if (onContinue != null) {
                        onContinue!();
                      }
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                    child: const Text(
                      'ادامه',
                      style: TextStyle(
                        color: AppColors.buttonCamel,
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),

                  // Left in RTL: Empty spacer or placeholder
                  const SizedBox(),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

