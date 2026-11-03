import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/theme/app_typography.dart';
import 'nopa_modal_shell.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/constants/api_constants.dart';

class JarchiItem extends StatelessWidget {
  final String title;
  final String date;
  final String imageUrl;
  final String content;
  final String? link;

  const JarchiItem({
    super.key,
    required this.title,
    required this.date,
    required this.imageUrl,
    required this.content,
    this.link,
  });

  static void showNewsDialog(
    BuildContext context, {
    required String title,
    required String date,
    required String imageUrl,
    required String content,
    String? link,
  }) {
    showNopaModal<void>(
      context,
      builder: (BuildContext context) {
        return NopaModalShell(
          maxWidth: 420,
          headerIcon: Icons.campaign_rounded,
          title: 'جزئیات اطلاعیه نپا',
          padding: const EdgeInsets.all(20),
          actions: [
            if (link != null)
              NopaModalAction(
                label: 'مشاهده منبع خبر',
                onPressed: () {
                  Navigator.pop(context);
                  AppToast.info(context, 'در حال باز کردن لینک: $link');
                },
              ),
            NopaModalAction(
              label: 'بستن',
              variant: NopaModalActionVariant.secondary,
              onPressed: () => Navigator.pop(context),
            ),
          ],
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: CachedNetworkImage(
                        imageUrl: ApiConstants.resolveImageUrl(imageUrl),
                        width: double.infinity,
                        height: 140,
                        fit: BoxFit.cover,
                        memCacheWidth: 600,
                        memCacheHeight: 300,
                        placeholder: (context, url) => Container(
                          width: double.infinity,
                          height: 140,
                          color: const Color(0xFF160E2A),
                          alignment: Alignment.center,
                          child: const CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6)),
                        ),
                        errorWidget: (context, url, error) => Container(
                          width: double.infinity,
                          height: 140,
                          color: const Color(0xFF160E2A),
                          child: const Icon(Icons.broken_image_rounded, color: Colors.white30, size: 40),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      title, 
                      style: AppTypography.h3Strong,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      date, 
                      style: AppTypography.caption.copyWith(color: Colors.white38),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      content,
                      style: AppTypography.bodyMedium.copyWith(color: Colors.white70),
                    ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return TapExpander(child: GestureDetector(
      onTap: () => showNewsDialog(
        context,
        title: title,
        date: date,
        imageUrl: imageUrl,
        content: content,
        link: link,
      ),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1435),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
          ),
          child: Row(
            children: [
              // Right: Image (renders first on the right in RTL)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: CachedNetworkImage(
                  imageUrl: ApiConstants.resolveImageUrl(imageUrl),
                  width: 52,
                  height: 52,
                  fit: BoxFit.cover,
                  memCacheWidth: 150,
                  memCacheHeight: 150,
                  placeholder: (context, url) => Container(
                    width: 52,
                    height: 52,
                    color: const Color(0xFF160E2A),
                  ),
                  errorWidget: (context, url, error) => Container(
                    width: 52,
                    height: 52,
                    color: const Color(0xFF160E2A),
                    child: const Icon(Icons.broken_image_rounded, color: Colors.white30, size: 20),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Middle: Title details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.h3,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Left: Date info (renders on the leftmost side in RTL)
              Text(
                date,
                style: AppTypography.caption.copyWith(color: Colors.white38),
              ),
            ],
          ),
        ),
      ),
    ));
  }
}
