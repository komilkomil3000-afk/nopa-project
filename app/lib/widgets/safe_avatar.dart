import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/avatar_catalog.dart';
import '../core/constants/api_constants.dart';

/// Round profile picture. Resolution order:
///  1. bundled avatar (`asset:boy_2`) – always available offline,
///  2. mentor default picture by [gender] when [isMentor] and nothing was chosen,
///  3. network image (disk-cached by CachedNetworkImage, shown offline once downloaded once),
///  4. initial letter of the name.
class SafeAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final Color? backgroundColor;
  final String? gender;
  final bool isMentor;

  const SafeAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.radius = 20,
    this.backgroundColor,
    this.gender,
    this.isMentor = false,
  });

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isNotEmpty ? name.trim()[0] : '؟';

    final assetPath = (isMentor ? AvatarCatalog.mentorDefault(gender) : null) ?? AvatarCatalog.assetFor(imageUrl);
    if (assetPath != null) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: backgroundColor ?? Colors.indigo.shade800,
        child: ClipOval(
          child: Image.asset(
            assetPath,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            cacheWidth: 160,
            errorBuilder: (_, _, _) => _buildFallback(initial),
          ),
        ),
      );
    }

    final resolvedUrl = ApiConstants.resolveImageUrl(imageUrl);
    final hasValidUrl = resolvedUrl.isNotEmpty && resolvedUrl.startsWith('http');

    if (!hasValidUrl) {
      return _buildFallback(initial);
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? Colors.indigo.shade800,
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: resolvedUrl,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          memCacheWidth: 160,
          memCacheHeight: 160,
          placeholder: (context, url) => _buildFallback(initial),
          errorWidget: (context, url, error) => _buildFallback(initial),
        ),
      ),
    );
  }

  Widget _buildFallback(String initial) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? const Color(0xFF334155),
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: radius * 0.9,
          fontWeight: FontWeight.bold,
          fontFamily: 'YekanBakh',
        ),
      ),
    );
  }
}
