import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Wraps a picture so it can be enlarged: the first tap dims it and shows a zoom icon,
/// a second tap (within a few seconds) opens it full screen.
class ZoomableImage extends StatefulWidget {
  final Widget child;
  final String imageUrl;
  final bool enabled;

  const ZoomableImage({
    super.key,
    required this.child,
    required this.imageUrl,
    this.enabled = true,
  });

  @override
  State<ZoomableImage> createState() => _ZoomableImageState();
}

class _ZoomableImageState extends State<ZoomableImage> {
  bool _armed = false;
  Timer? _disarmTimer;

  @override
  void dispose() {
    _disarmTimer?.cancel();
    super.dispose();
  }

  void _onTap() {
    if (!widget.enabled) return;
    if (!_armed) {
      setState(() => _armed = true);
      _disarmTimer?.cancel();
      _disarmTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _armed = false);
      });
      return;
    }
    _disarmTimer?.cancel();
    setState(() => _armed = false);
    _showFullScreen();
  }

  void _showFullScreen() {
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: true,
        barrierColor: Colors.black,
        pageBuilder: (ctx, _, _) => Scaffold(
          backgroundColor: Colors.black,
          body: Stack(
            children: [
              Positioned.fill(
                child: InteractiveViewer(
                  minScale: 1,
                  maxScale: 5,
                  child: Center(
                    child: CachedNetworkImage(imageUrl: widget.imageUrl, fit: BoxFit.contain),
                  ),
                ),
              ),
              SafeArea(
                child: Align(
                  alignment: Alignment.topLeft,
                  child: IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _onTap,
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          AnimatedOpacity(
            duration: const Duration(milliseconds: 180),
            opacity: _armed ? 0.45 : 1,
            child: widget.child,
          ),
          if (_armed)
            const Positioned.fill(
              child: Center(
                child: Icon(Icons.zoom_in_rounded, color: Colors.white, size: 40),
              ),
            ),
        ],
      ),
    );
  }
}
