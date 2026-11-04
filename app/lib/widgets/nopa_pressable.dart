import 'package:flutter/widgets.dart';
import '../core/theme/app_motion.dart';

/// Tap-down feedback: the child shrinks slightly while a finger is on it and springs back on release.
///
/// Only a transform changes (no layout, no shadow animation), and the child subtree is the same widget
/// instance on every press, so only this small wrapper rebuilds. It listens to raw pointer events, so it
/// never competes with the child's own tap / scroll gestures. If the finger moves away (a scroll), the
/// press state is released.
class NopaPressable extends StatefulWidget {
  final Widget child;
  final double pressedScale;

  const NopaPressable({super.key, required this.child, this.pressedScale = 0.96});

  @override
  State<NopaPressable> createState() => _NopaPressableState();
}

class _NopaPressableState extends State<NopaPressable> {
  static const double _slop = 12;
  bool _down = false;
  Offset _start = Offset.zero;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = AppMotion.reduced(context);
    return Listener(
      onPointerDown: (e) {
        _start = e.position;
        _set(true);
      },
      onPointerMove: (e) {
        if (_down && (e.position - _start).distance > _slop) _set(false);
      },
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down && !reduced ? widget.pressedScale : 1.0,
        duration: _down ? AppMotion.press : AppMotion.pressRelease,
        curve: _down ? Curves.easeOut : Curves.easeOutBack,
        child: widget.child,
      ),
    );
  }
}
