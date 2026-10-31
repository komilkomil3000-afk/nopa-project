import 'package:flutter/material.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// Single entry point for every feedback message in the app.
///
/// Only one message is ever on screen: a new one replaces the current one
/// immediately, and repeating the same text while it is still visible is
/// ignored, so tapping a button many times can't queue up messages.
class AppToast {
  AppToast._();

  static const Color textColor = Color(0xFFE4E4FF);
  static const Color infoColor = Color(0xFF3D3C67);
  static const Color successColor = Color(0xFF266C3A);
  static const Color errorColor = Color(0xFF7B3334);

  static const Duration _visible = Duration(milliseconds: 2500);
  static const Duration _errorVisible = Duration(milliseconds: 3500);

  static String? _lastMessage;
  static DateTime _lastUntil = DateTime.fromMillisecondsSinceEpoch(0);

  /// Neutral / informational message.
  static void info(BuildContext context, String message) =>
      _show(context, message, infoColor, _visible);

  /// Confirmation of a completed action (green).
  static void success(BuildContext context, String message) =>
      _show(context, message, successColor, _visible);

  /// Warning or error (red).
  static void error(BuildContext context, String message) =>
      _show(context, message, errorColor, _errorVisible);

  static void _show(BuildContext context, String message, Color color, Duration duration) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    final now = DateTime.now();
    if (message == _lastMessage && now.isBefore(_lastUntil)) return;
    _lastMessage = message;
    _lastUntil = now.add(duration);

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Text(
            message,
            style: const TextStyle(
              color: textColor,
              fontSize: 12.5,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: duration,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      snackBarAnimationStyle: AnimationStyle(
        duration: const Duration(milliseconds: 120),
        reverseDuration: const Duration(milliseconds: 100),
      ),
    );
  }
}
