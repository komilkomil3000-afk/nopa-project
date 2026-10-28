import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class AssetPrecacheHelper {
  static bool _hasPrecached = false;

  static Future<void> precacheCoreAssets(BuildContext context) async {
    if (_hasPrecached) return;
    _hasPrecached = true;

    // 1. Precache background and brand images
    try {
      await precacheImage(const AssetImage('assets/images/login_bg.png'), context);
    } catch (_) {}

    // 2. Precache core vector SVGs
    const svgList = [
      'assets/svg_icons/home01.svg',
      'assets/svg_icons/classes01.svg',
      'assets/svg_icons/challeng01.svg',
      'assets/svg_icons/stor01.svg',
      'assets/svg_icons/profile01.svg',
      'assets/svg_icons/lock01.svg',
      'assets/svg_icons/lock02.svg',
      'assets/svg_icons/fir01.svg',
      'assets/svg_icons/fir02.svg',
      'assets/svg_icons/fir03.svg',
      'assets/svg_icons/champun01.svg',
      'assets/svg_icons/imagenot01.svg',
      'assets/images/nopa_logo.svg',
    ];

    for (final svgPath in svgList) {
      try {
        final loader = SvgAssetLoader(svgPath);
        await vg.loadPicture(loader, null);
      } catch (_) {
        // Safe fallback
      }
    }
  }
}
