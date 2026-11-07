import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nopa_app/core/avatar_catalog.dart';
import 'package:nopa_app/core/constants/api_constants.dart';

/// Pictures the admin sets in the panel («تصاویر اپلیکیشن»), read once at start with the asset names.
/// Chat pictures need nothing here: the server already puts the default picture in each space's coverImageUrl.
class AppImages {
  static final Map<String, String> _assets = {};

  /// Applies GET /app-images ({assets: {key: url}, chat: {...}, avatars: {group: [value]}}).
  static void apply(Map<String, dynamic> data) {
    AvatarCatalog.apply(data['avatars']);
    final assets = data['assets'];
    _assets.clear();
    if (assets is Map) {
      assets.forEach((k, v) {
        final url = v?.toString() ?? '';
        if (url.isNotEmpty) _assets[k.toString()] = url;
      });
    }
  }

  /// The uploaded picture of an asset key ('zarik', 'nakh', 'farsh', 'derafsh', 'derafsh_gold', ...), or null.
  static String? asset(String key) {
    final url = _assets[key] ?? (key.startsWith('derafsh_') ? _assets['derafsh'] : null);
    return url == null ? null : ApiConstants.resolveImageUrl(url);
  }
}

/// The icon of an asset: the picture set in the panel, otherwise the built-in icon drawn in the bottom bar's style
/// (two-tone, tinted with [color]).
class AssetIcon extends StatelessWidget {
  /// 'zarik' | 'nakh' | 'farsh' | 'derafsh' | 'derafsh_gold' | 'derafsh_silver' | 'derafsh_bronze' | 'derafsh_cloth'
  final String assetKey;
  final double size;
  final Color color;

  /// A panel picture is cropped to a rounded square (fills it, never stretched) instead of being fitted inside.
  final bool square;

  const AssetIcon(this.assetKey, {super.key, this.size = 22, this.color = const Color(0xFFDFB690), this.square = false});

  static const Map<String, Color> _bannerTints = {
    'derafsh_gold': Color(0xFFFFD580),
    'derafsh_silver': Color(0xFFCBD5E1),
    'derafsh_bronze': Color(0xFFC8824C),
    'derafsh_cloth': Color(0xFF9292E2),
  };

  /// Asset key of a screen's default label ('زریک', 'کلاف', 'درفش طلایی', ...).
  static String keyOfLabel(String label) => switch (label) {
        'زریک' => 'zarik',
        'کلاف' => 'nakh',
        'قالیچه' => 'farsh',
        'درفش طلایی' => 'derafsh_gold',
        'درفش نقره‌ای' || 'درفش نقره ای' => 'derafsh_silver',
        'درفش برنزی' => 'derafsh_bronze',
        'درفش پارچه‌ای' => 'derafsh_cloth',
        _ => 'derafsh',
      };

  @override
  Widget build(BuildContext context) {
    final url = AppImages.asset(assetKey);
    final svg = 'assets/svg_icons/asset_${assetKey.startsWith('derafsh') ? 'derafsh' : assetKey}.svg';
    final tint = _bannerTints[assetKey] ?? color;
    final fallback = SvgPicture.asset(
      svg,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
      placeholderBuilder: (_) => SizedBox(width: size, height: size),
    );
    if (url == null) return fallback;
    final image = CachedNetworkImage(
      imageUrl: url,
      width: size,
      height: size,
      fit: square ? BoxFit.cover : BoxFit.contain,
      memCacheWidth: (size * 3).round(),
      placeholder: (_, _) => fallback,
      errorWidget: (_, _, _) => fallback,
    );
    if (!square) return image;
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(borderRadius: BorderRadius.circular(size * 0.2), child: image),
    );
  }
}
