import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';

/// One entry of a station's gallery: a picture (tap to enlarge) or a video, decided by the file extension.
class StationGalleryItem extends StatelessWidget {
  final String url;
  final String title;
  final String? coverImageUrl;
  final void Function(Duration position, Duration duration)? onProgress;

  const StationGalleryItem({
    super.key,
    required this.url,
    required this.title,
    this.coverImageUrl,
    this.onProgress,
  });

  static const _imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'];

  static bool isImageUrl(String url) {
    final path = Uri.tryParse(url)?.path ?? url;
    final dot = path.lastIndexOf('.');
    if (dot < 0) return false;
    return _imageExts.contains(path.substring(dot + 1).toLowerCase());
  }

  void _showFull(BuildContext context, String resolved) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            InteractiveViewer(
              child: Center(child: CachedNetworkImage(imageUrl: resolved, fit: BoxFit.contain)),
            ),
            Positioned(
              top: 4,
              left: 4,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!isImageUrl(url)) {
      return NopaInlineVideoPlayer(
        videoUrl: url,
        title: title,
        coverImageUrl: coverImageUrl,
        onProgress: onProgress,
      );
    }
    final resolved = ApiConstants.resolveImageUrl(url);
    return TapExpander(child: GestureDetector(
      onTap: () => _showFull(context, resolved),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          color: const Color(0xFF1E1D38),
          child: CachedNetworkImage(
            imageUrl: resolved,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            placeholder: (_, _) => const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFC7B299))),
            errorWidget: (_, _, _) => const Center(child: Icon(Icons.broken_image_outlined, color: Colors.white38, size: 36)),
          ),
        ),
      ),
    ));
  }
}
