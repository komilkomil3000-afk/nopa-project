import 'package:flutter/material.dart';

/// Design System Typography Tokens for NOPA App
/// Font Family: Strictly 'YekanBakh'
class AppTypography {
  static const String fontFamily = 'YekanBakh';
  static const List<String> fontFamilyFallback = ['YekanBakh', 'Tahoma', 'sans-serif'];

  // ==========================================
  // Unified hierarchy (h1/h2/h3/body/caption).
  // Each base token is white; use the Gold / Muted / Dark variants or
  // `.copyWith(color: ...)` for other colors. Do not override size/weight
  // at call sites; pick the right token instead.
  // ==========================================
  static const Color colorWhite = Color(0xFFFFFFFF);
  static const Color colorGold = Color(0xFFF4DCC5);
  static const Color colorMuted = Color(0xFFB5B3C8);
  static const Color colorDark = Color(0xFF1B1730);

  /// English brand wordmark "NOPA" — Chocho font only (no YekanBakh / fallbacks).
  /// Colour is applied by the surrounding ShaderMask / copyWith.
  static const String logoFontFamily = 'ChochoAura';
  static const TextStyle logo = TextStyle(fontFamily: logoFontFamily, fontSize: 21.0, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: colorWhite);

  // Heading 1 — 18sp, w800
  static const TextStyle h1 = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 18.0, fontWeight: FontWeight.w800, height: 1.3, color: colorWhite);
  static const TextStyle h1Gold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 18.0, fontWeight: FontWeight.w800, height: 1.3, color: colorGold);
  static const TextStyle h1Muted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 18.0, fontWeight: FontWeight.w800, height: 1.3, color: colorMuted);
  static const TextStyle h1Dark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 18.0, fontWeight: FontWeight.w800, height: 1.3, color: colorDark);

  // Heading 2 — 15sp, w700
  static const TextStyle h2 = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 15.0, fontWeight: FontWeight.w700, height: 1.3, color: colorWhite);
  static const TextStyle h2Gold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 15.0, fontWeight: FontWeight.w700, height: 1.3, color: colorGold);
  static const TextStyle h2Muted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 15.0, fontWeight: FontWeight.w700, height: 1.3, color: colorMuted);
  static const TextStyle h2Dark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 15.0, fontWeight: FontWeight.w700, height: 1.3, color: colorDark);

  // Heading 3 — 12.5sp, w400 (same look as station names on home)
  static const TextStyle h3 = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.3, color: colorWhite);
  static const TextStyle h3Gold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.3, color: colorGold);
  static const TextStyle h3Muted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.3, color: colorMuted);
  static const TextStyle h3Dark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.3, color: colorDark);

  // Heading 3 Strong — previous h3 look (13sp, w600): section headers inside dialogs, numbered badges, "نگارستان" header
  static const TextStyle h3Strong = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 13.0, fontWeight: FontWeight.w600, height: 1.3, color: colorWhite);

  // Body 1 — 13.5sp, w500
  static const TextStyle bodyLarge = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.4, color: colorWhite);
  static const TextStyle bodyLargeGold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.4, color: colorGold);
  static const TextStyle bodyLargeMuted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.4, color: colorMuted);
  static const TextStyle bodyLargeDark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.4, color: colorDark);

  // Body 2 — 12.5sp, w400
  static const TextStyle bodyMedium = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.4, color: colorWhite);
  static const TextStyle bodyMediumGold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.4, color: colorGold);
  static const TextStyle bodyMediumMuted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.4, color: colorMuted);
  static const TextStyle bodyMediumDark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 12.5, fontWeight: FontWeight.w400, height: 1.4, color: colorDark);

  // Caption — 10.5sp, w400
  static const TextStyle caption = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 10.5, fontWeight: FontWeight.w400, height: 1.3, color: colorWhite);
  static const TextStyle captionGold = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 10.5, fontWeight: FontWeight.w400, height: 1.3, color: colorGold);
  static const TextStyle captionMuted = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 10.5, fontWeight: FontWeight.w400, height: 1.3, color: colorMuted);
  static const TextStyle captionDark = TextStyle(fontFamily: fontFamily, fontFamilyFallback: fontFamilyFallback, fontSize: 10.5, fontWeight: FontWeight.w400, height: 1.3, color: colorDark);

  // ==========================================
  // Legacy tokens (kept for existing usages)
  // ==========================================

  // ==========================================
  // 1. الف) تیتر01 (Header Large - Size 20-22, w800/w700)
  // ==========================================
  static const TextStyle title01 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 21.0,
    fontWeight: FontWeight.w800,
    color: Colors.white,
    letterSpacing: 0.5,
  );

  static const TextStyle title01White = TextStyle(
    fontFamily: fontFamily,
    fontSize: 21.0,
    fontWeight: FontWeight.w800,
    color: Color(0xFFFFFFFF),
  );

  static const TextStyle title01Gold = TextStyle(
    fontFamily: fontFamily,
    fontSize: 21.0,
    fontWeight: FontWeight.w800,
    color: Color(0xFFF4DCC5),
  );

  // Gradient helper for title01 NOPA logo
  static const LinearGradient title01LogoGradient = LinearGradient(
    colors: [
      Color(0xFFC09268),
      Color(0xFFF4DCC5),
    ],
    begin: Alignment.bottomCenter,
    end: Alignment.topCenter,
  );

  // ==========================================
  // 2. ب) تیتر02 (Header Medium - Size 16-17.5, w800)
  // ==========================================
  static const TextStyle title02 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 17.5,
    fontWeight: FontWeight.w800,
    color: Colors.white,
  );

  static const TextStyle title02White = TextStyle(
    fontFamily: fontFamily,
    fontSize: 17.5,
    fontWeight: FontWeight.w800,
    color: Color(0xFFFFFFFF),
  );

  static const TextStyle title02Gold = TextStyle(
    fontFamily: fontFamily,
    fontSize: 17.5,
    fontWeight: FontWeight.w800,
    color: Color(0xFFF4DCC5),
  );

  // ==========================================
  // 3. ج) تیتر03 (Header Small - Size 14-14.5, w700/w600)
  // ==========================================
  static const TextStyle title03 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14.5,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  static const TextStyle title03White = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14.5,
    fontWeight: FontWeight.w700,
    color: Color(0xFFFFFFFF),
  );

  static const TextStyle title03Lilac = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14.5,
    fontWeight: FontWeight.w600,
    color: Color(0xFFEDE8F5),
  );

  static const TextStyle title03Gold = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14.5,
    fontWeight: FontWeight.w700,
    color: Color(0xFFF4DCC5),
  );

  // ==========================================
  // 4. د) متن معمولی01 (Body Bold - Size 12-12.5, w600/Bold)
  // ==========================================
  static const TextStyle bodyBold01 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.w600,
    color: Colors.white,
  );

  static const TextStyle bodyBold01White = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.bold,
    color: Color(0xFFFFFFFF),
  );

  static const TextStyle bodyBold01Gray = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.w600,
    color: Color(0xFFB5B3C8),
  );

  static const TextStyle bodyBold01Gold = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.bold,
    color: Color(0xFFC7B299),
  );

  // ==========================================
  // 5. ه) متن معمولی02 (Body Regular - Size 10.5-11, w400, height 1.38)
  // ==========================================
  static const TextStyle bodyRegular02 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.5,
    fontWeight: FontWeight.w400,
    height: 1.38,
    color: Color(0xFFD3D0E3),
  );

  static const TextStyle bodyRegular02Lilac = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.5,
    fontWeight: FontWeight.w400,
    height: 1.38,
    color: Color(0xFFD3D0E3),
  );

  static const TextStyle bodyRegular02Muted = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.5,
    fontWeight: FontWeight.w400,
    height: 1.38,
    color: Color(0xFF9D99B8),
  );

  static const TextStyle bodyRegular02Gold = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.5,
    fontWeight: FontWeight.bold,
    height: 1.38,
    color: Color(0xFFF4DCC5),
  );

  // ==========================================
  // 6. و) متن کوچک (Caption Small - Size 9.5-10, w600/w400)
  // ==========================================
  static const TextStyle captionSmall = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.0,
    fontWeight: FontWeight.w600,
    color: Color(0xFFC7B299),
  );

  static const TextStyle captionSmallBronze = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.0,
    fontWeight: FontWeight.w600,
    color: Color(0xFFC7B299),
  );

  static const TextStyle captionSmallInactive = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10.0,
    fontWeight: FontWeight.w600,
    color: Color(0xFF787886),
  );

  static const TextStyle captionSmallWhite = TextStyle(
    fontFamily: fontFamily,
    fontSize: 9.5,
    fontWeight: FontWeight.bold,
    color: Color(0xFFFFFFFF),
  );
}
