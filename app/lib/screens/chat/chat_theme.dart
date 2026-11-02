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

  /// Dark ink on the golden header and on the light composer and menus.
  static const Color ink = Color(0xFF23223D);
  /// Light surface of the composer, the filter bar and the message menu.
  static const Color paper = text;
  /// Fill of one's own bubble, a step lighter than the cards.
  static const Color mineFill = Color(0xFF3B3870);
  static const Color online = AppColors.emerald;

  /// Side margin every chat element keeps from the screen edges.
  static const double gutter = 16;

  /// The golden header of every chat screen, rounded at the bottom.
  static BoxDecoration get header => BoxDecoration(
        gradient: const RadialGradient(
          center: Alignment(0, -1.6),
          radius: 1.6,
          colors: [AppColors.accentGoldEnd, AppColors.buttonCamel],
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 6))],
      );

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

  /// One's own bubble is the deep lavender of the cards; other people's the gold of the accent.
  static Color bubbleFill({required bool mine}) => mine ? mineFill : accent;
  static Color bubbleText({required bool mine}) => mine ? text : ink;
  static Color bubbleMuted({required bool mine}) => mine ? muted : ink.withValues(alpha: 0.6);

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
