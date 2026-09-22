import 'package:flutter/material.dart';
import 'app_colors.dart';
export 'app_typography.dart';

class AppTheme {
  static const String fontFamily = 'YekanBakh';
  static const List<String> fontFamilyFallback = ['YekanBakh', 'IranYekan', 'Tahoma', 'sans-serif'];

  static TextTheme buildTextTheme(TextTheme base, [double scale = 1.0]) {
    return base.copyWith(
      displayLarge: (base.displayLarge ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 57 * scale),
      displayMedium: (base.displayMedium ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 45 * scale),
      displaySmall: (base.displaySmall ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 36 * scale),
      headlineLarge: (base.headlineLarge ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 32 * scale),
      headlineMedium: (base.headlineMedium ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 28 * scale),
      headlineSmall: (base.headlineSmall ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 24 * scale),
      titleLarge: (base.titleLarge ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 22 * scale),
      titleMedium: (base.titleMedium ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 16 * scale),
      titleSmall: (base.titleSmall ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 14 * scale),
      bodyLarge: (base.bodyLarge ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 16 * scale),
      bodyMedium: (base.bodyMedium ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 14 * scale),
      bodySmall: (base.bodySmall ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12 * scale),
      labelLarge: (base.labelLarge ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 14 * scale),
      labelMedium: (base.labelMedium ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12 * scale),
      labelSmall: (base.labelSmall ?? const TextStyle()).copyWith(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 11 * scale),
    );
  }

  static ThemeData lightTheme([double fontScale = 1.0]) {
    return ThemeData(
      useMaterial3: true,
      fontFamily: fontFamily,
      fontFamilyFallback: fontFamilyFallback,
      brightness: Brightness.light,
      primaryColor: AppColors.purple,
      scaffoldBackgroundColor: const Color(0xFFF8F9FA),
      textTheme: buildTextTheme(ThemeData.light().textTheme, fontScale).apply(
        fontFamily: fontFamily,
      ),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.purple,
        brightness: Brightness.light,
        surface: Colors.white,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        hintStyle: TextStyle(fontFamily: fontFamily),
        labelStyle: TextStyle(fontFamily: fontFamily),
      ),
    );
  }

  static ThemeData darkTheme([double fontScale = 1.0]) {
    return ThemeData(
      useMaterial3: true,
      fontFamily: fontFamily,
      fontFamilyFallback: fontFamilyFallback,
      brightness: Brightness.dark,
      primaryColor: AppColors.purple,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: buildTextTheme(ThemeData.dark().textTheme, fontScale).apply(
        fontFamily: fontFamily,
      ),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.purple,
        brightness: Brightness.dark,
        surface: AppColors.cardBackground,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        hintStyle: TextStyle(fontFamily: fontFamily),
        labelStyle: TextStyle(fontFamily: fontFamily),
      ),
    );
  }
}
