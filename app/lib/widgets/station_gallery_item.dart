import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/widgets/nopa_inline_video_player.dart';
import 'package:nopa_app/services/video_watch_tracker.dart';

/// One entry of a station's gallery: a picture (tap to enlarge) or a video, decided by the file extension.
class StationGalleryItem extends StatelessWidget {
  final String url;
  final String title;
  final String? coverImageUrl;
  final void Function(Duration position, Duration duration)? onProgress;

  /// Which gallery video this is (its watching is tracked, services/video_watch_tracker.dart).
  final VideoWatchInfo? watch;

  /// The share of the video really watched so far (0..1).
  final void Function(double fraction)? onWatchedFraction;

  const StationGalleryItem({
    super.key,
    required this.url,
    required this.title,
    this.coverImageUrl,
    this.onProgress,
    this.watch,
    this.onWatchedFraction,
  });

  static const _imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'];

  static bool isImageUrl(String url) {
    final path = Uri.tryParse(url)?.path ?? url;
    final dot = path.lastIndexOf('.');
    if (dot < 0) return false;
    return _imageExts.contains(path.substring(dot + 1).toLowerCase());
  }

  void _showFull(BuildContext context, String resolved) {
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'بستن',
      barrierColor: Colors.black,
      pageBuilder: (ctx, _, _) => Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            // Pinch to zoom, drag to pan
            InteractiveViewer(
              minScale: 1,
              maxScale: 5,
              child: Center(
                child: CachedNetworkImage(
                  imageUrl: resolved,
                  fit: BoxFit.contain,
                  placeholder: (_, _) => const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFC7B299))),
                  errorWidget: (_, _, _) => const Center(child: Icon(Icons.broken_image_outlined, color: Colors.white38, size: 48)),
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: Colors.black54),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                    tooltip: 'بستن',
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ),
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
        watch: watch,
        onWatchedFraction: onWatchedFraction,
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
