import 'package:flutter/material.dart';

class AppColors {
  // Legacy / General App Colors
  static const Color purple = Color(0xFF8B5CF6);
  static const Color pink = Color(0xFFEC4899);
  static const Color emerald = Color(0xFF10B981);
  static const Color orange = Color(0xFFF97316);
  static const Color gold = Color(0xFFEAB308);
  static const Color blue = Color(0xFF3B82F6);
  static const Color background = Color(0xFF120C1F);
  static const Color cardBackground = Color(0xFF1E1633);
  static const Color textPrimary = Colors.white;
  static const Color textSecondary = Colors.white70;

  // Login & Figma Design Colors
  static const Color bgGradientTop = Color(0xFF40395F);
  static const Color bgGradientBottom = Color(0xFF1B1829);

  static const Color accentGoldStart = Color(0xFFCD8449);
  static const Color accentGoldEnd = Color(0xFFE1BC96);

  static const Color surfaceDarkStart = Color(0xFF2A2835);
  static const Color surfaceDarkEnd = Color(0xFF161229);

  static const Color strokeGrayLight = Color(0xFF6C6C63);
  static const Color strokeDark = Color(0xFF182025);

  static const Color textPoetry = Color(0xFFC7B299);
  static const Color textInputLabel = Color(0xFF8E889D);
  static const Color textWhite = Colors.white;

  // Gradients
  /// 1. Screen Background Gradient
  static const LinearGradient screenBackgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      bgGradientTop,
      bgGradientBottom,
    ],
  );

  /// 2. Accent Button / Active Tab Gradient (Golden / Bronze)
  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [
      accentGoldStart,
      accentGoldEnd,
    ],
  );

  /// 3. Dark Surface Gradient (Input boxes and selector containers)
  static const LinearGradient darkSurfaceGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      surfaceDarkStart,
      surfaceDarkEnd,
    ],
  );

  /// 4. Container Stroke / Border Gradient
  static const LinearGradient strokeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      strokeGrayLight,
      strokeDark,
      strokeGrayLight,
    ],
  );

  // Border & Radius Constants
  static const double borderRadiusValue = 12.0;
  static final BorderRadius borderRadius = BorderRadius.circular(borderRadiusValue);
  static const double borderWidth = 1.0;
}
