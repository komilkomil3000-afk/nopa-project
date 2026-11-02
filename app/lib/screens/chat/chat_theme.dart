import 'package:flutter/material.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';

/// Chat's look, taken from the app's own tokens and the values of the bottom bar.
class ChatTheme {
  ChatTheme._();

  static const Color surfaceTop = Color(0xFF282548);
  static const Color surfaceBottom = Color(0xFF1B1834);
  static const Color stroke = Color(0xFF656196);
  static const Color accent = Color(0xFFDFB690);
  static const Color lavender = Color(0xFF9292E2);
  static const Color text = Color(0xFFEDE9F6);
  static const Color muted = Color(0xFF8B88A8);
  static const Color danger = Color(0xFFEF4444);

  static const double radius = AppColors.borderRadiusValue;

  static BoxDecoration card({bool highlighted = false}) => BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [surfaceTop, surfaceBottom],
        ),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: (highlighted ? accent : stroke).withValues(alpha: 0.55), width: 1.2),
      );

  /// One's own bubble carries the gold edge of the app's accent; other people's the plain stroke.
  static BoxDecoration bubble({required bool mine}) => BoxDecoration(
        color: mine ? surfaceTop : surfaceBottom,
        borderRadius: BorderRadius.circular(radius + 2),
        border: Border.all(color: (mine ? accent : stroke).withValues(alpha: mine ? 0.45 : 0.55), width: 1.2),
      );

  static const TextStyle body = TextStyle(color: text, fontFamily: AppTheme.fontFamily, fontSize: 13.5, height: 1.6);
  static const TextStyle title = TextStyle(color: text, fontFamily: AppTheme.fontFamily, fontSize: 14, fontWeight: FontWeight.bold);
  static const TextStyle caption = TextStyle(color: muted, fontFamily: AppTheme.fontFamily, fontSize: 11);

  static const Map<String, ({IconData icon, String label})> reactions = {
    'bravo': (icon: Icons.auto_awesome_rounded, label: 'آفرین'),
    'agree': (icon: Icons.check_circle_rounded, label: 'موافقم'),
    'idea': (icon: Icons.lightbulb_rounded, label: 'ایده‌ی خوب'),
    'question': (icon: Icons.help_rounded, label: 'سؤال دارم'),
    'confused': (icon: Icons.psychology_alt_rounded, label: 'متوجه نشدم'),
  };
}
