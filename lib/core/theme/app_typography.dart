import 'package:flutter/material.dart';

/// Design System Typography Tokens for NOPA App
/// Font Family: Strictly 'YekanBakh'
class AppTypography {
  static const String fontFamily = 'YekanBakh';

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

/// Backwards-compatible alias
typedef AppTextStyles = AppTypography;
