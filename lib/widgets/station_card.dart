import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/station.dart';
import '../core/constants/api_constants.dart';
import '../core/theme/app_theme.dart';

class StationCard extends StatelessWidget {
  final Station station;
  final VoidCallback onTap;

  const StationCard({
    super.key,
    required this.station,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final String resolvedImg = ApiConstants.resolveImageUrl(station.imageUrl);
    final bool hasValidImg = resolvedImg.isNotEmpty && resolvedImg.startsWith('http') && !resolvedImg.contains('placeholder');

    return AspectRatio(
      aspectRatio: 0.65,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(left: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              stops: [0.0, 0.5, 1.0],
              colors: [
                Color(0xFF3A3A6A),
                Color(0xFF9292E2),
                Color(0xFF3A3A6A),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          padding: const EdgeInsets.all(1.2), // Gradient border width
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20.8),
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.53, 1.0],
                colors: [
                  Color(0xFF3D3C67),
                  Color(0xFF36345C),
                  Color(0xFF333359),
                ],
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20.8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. Upper Expanded Area: Station Cover Image
                  Expanded(
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Container(
                          color: const Color(0xFF2E2E50),
                          child: hasValidImg
                              ? CachedNetworkImage(
                                  imageUrl: resolvedImg,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: const Color(0xFF2E2E50),
                                    alignment: Alignment.center,
                                    child: const Icon(
                                      Icons.image_rounded,
                                      color: Color(0xFF686690),
                                      size: 44,
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => Container(
                                    color: const Color(0xFF2E2E50),
                                    alignment: Alignment.center,
                                    child: const Icon(
                                      Icons.image_rounded,
                                      color: Color(0xFF686690),
                                      size: 44,
                                    ),
                                  ),
                                )
                              : const Center(
                                  child: Icon(
                                    Icons.image_rounded,
                                    color: Color(0xFF686690),
                                    size: 44,
                                  ),
                                ),
                        ),
                        if (station.isLocked)
                          Container(
                            color: Colors.black.withValues(alpha: 0.45),
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.lock_rounded,
                              color: Colors.white70,
                              size: 32,
                            ),
                          ),
                      ],
                    ),
                  ),

                  // 2. Subtle horizontal divider line
                  Container(
                    height: 1,
                    color: Colors.white.withValues(alpha: 0.08),
                  ),

                  // 3. Bottom Info Bar: Number & Title in RTL
                  Container(
                    height: 50,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Directionality(
                      textDirection: TextDirection.rtl,
                      child: Row(
                        children: [
                          // Station Number (Right in RTL)
                          Text(
                            '${station.orderIndex + 1}',
                            style: const TextStyle(
                              color: Color(0xFF9292E2),
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Station Title (Left in RTL)
                          Expanded(
                            child: Text(
                              station.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Color(0xFFF4EFEA),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                fontFamily: AppTheme.fontFamily,
                                fontFamilyFallback: AppTheme.fontFamilyFallback,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
