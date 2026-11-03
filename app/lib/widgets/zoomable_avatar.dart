import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'safe_avatar.dart';

/// A [SafeAvatar] that opens its picture full screen on tap, with pinch-to-zoom and pan.
/// Works for bundled (`asset:`) and uploaded pictures; with no picture to show (initial letter only)
/// a tap does nothing.
class ZoomableAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final String? gender;
  final bool isMentor;
  final int cacheSize;

  const ZoomableAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.radius = 20,
    this.gender,
    this.isMentor = false,
    this.cacheSize = 160,
  });

  @override
  Widget build(BuildContext context) {
    final source = SafeAvatar.sourceFor(imageUrl: imageUrl, gender: gender, isMentor: isMentor);
    final avatar = SafeAvatar(imageUrl: imageUrl, name: name, radius: radius, gender: gender, isMentor: isMentor, cacheSize: cacheSize);
    if (source.asset == null && source.url == null) return avatar;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => AvatarViewer.open(context, asset: source.asset, url: source.url, title: name),
      child: avatar,
    );
  }
}

/// Full-screen picture: pinch to zoom, drag to pan, double-tap to zoom in and out.
class AvatarViewer extends StatefulWidget {
  final String? asset;
  final String? url;
  final String title;
  const AvatarViewer({super.key, this.asset, this.url, this.title = ''});

  /// Opens the viewer over the current screen.
  static Future<void> open(BuildContext context, {String? asset, String? url, String title = ''}) {
    return Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black,
        transitionDuration: const Duration(milliseconds: 180),
        reverseTransitionDuration: const Duration(milliseconds: 150),
        pageBuilder: (_, _, _) => AvatarViewer(asset: asset, url: url, title: title),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  State<AvatarViewer> createState() => _AvatarViewerState();
}

class _AvatarViewerState extends State<AvatarViewer> with SingleTickerProviderStateMixin {
  static const double _doubleTapScale = 2.5;

  final TransformationController _controller = TransformationController();
  late final AnimationController _animation = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
  Animation<Matrix4>? _tween;
  Offset _lastTap = Offset.zero;

  @override
  void initState() {
    super.initState();
    _animation.addListener(() {
      final value = _tween?.value;
      if (value != null) _controller.value = value;
    });
  }

  @override
  void dispose() {
    _animation.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _toggleZoom() {
    final zoomedIn = _controller.value.getMaxScaleOnAxis() > 1.01;
    final end = zoomedIn
        ? Matrix4.identity()
        : (Matrix4.identity()
          ..translateByDouble(-_lastTap.dx * (_doubleTapScale - 1), -_lastTap.dy * (_doubleTapScale - 1), 0, 1)
          ..scaleByDouble(_doubleTapScale, _doubleTapScale, 1, 1));
    _tween = Matrix4Tween(begin: _controller.value, end: end).animate(CurvedAnimation(parent: _animation, curve: Curves.easeOut));
    _animation.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final image = widget.asset != null
        ? Image.asset(widget.asset!, fit: BoxFit.contain)
        : CachedNetworkImage(
            imageUrl: widget.url!,
            fit: BoxFit.contain,
            placeholder: (_, _) => const Center(child: CircularProgressIndicator(color: Colors.white54)),
            errorWidget: (_, _, _) => const Icon(Icons.broken_image_rounded, color: Colors.white38, size: 48),
          );
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onDoubleTapDown: (d) => _lastTap = d.localPosition,
              onDoubleTap: _toggleZoom,
              child: InteractiveViewer(
                transformationController: _controller,
                minScale: 1,
                maxScale: 5,
                child: Center(child: image),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                tooltip: 'بستن',
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
