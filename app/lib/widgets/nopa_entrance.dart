import 'package:flutter/widgets.dart';
import '../core/theme/app_motion.dart';

/// Staggered arrival for list/grid items: the item fades in while rising 8 px.
///
/// Guardrails so it never hurts scrolling or feels repetitive:
/// * only the first [maxStagger] items of a list animate (later ones appear instantly);
/// * each item animates once per app session, identified by [entranceKey] (rebuilds, scrolling an item
///   back into view, or revisiting the tab do not replay it);
/// * uses FadeTransition / SlideTransition (compositor only) and drops the wrappers when finished;
/// * does nothing when the system has animations turned off.
class NopaEntrance extends StatefulWidget {
  /// Stable identity of this item, e.g. `'home-station:42'`.
  final Object entranceKey;
  final int index;
  final Widget child;

  static const int maxStagger = 6;
  static const Duration _step = Duration(milliseconds: 35);
  static final Set<Object> _played = <Object>{};

  const NopaEntrance({super.key, required this.entranceKey, required this.index, required this.child});

  @override
  State<NopaEntrance> createState() => _NopaEntranceState();
}

class _NopaEntranceState extends State<NopaEntrance> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  late final Animation<double> _curve;
  late final Animation<Offset> _slide;
  bool _done = true;

  @override
  void initState() {
    super.initState();
    final bool animate = widget.index < NopaEntrance.maxStagger && NopaEntrance._played.add(widget.entranceKey);
    if (!animate) return;
    final Duration delay = NopaEntrance._step * widget.index;
    final Duration total = AppMotion.base + delay;
    _done = false;
    _controller = AnimationController(vsync: this, duration: total);
    _curve = CurvedAnimation(
      parent: _controller!,
      curve: Interval(delay.inMilliseconds / total.inMilliseconds, 1.0, curve: AppMotion.enter),
    );
    _slide = Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(_curve);
    _controller!.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) setState(() => _done = true);
    });
    _controller!.forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done || AppMotion.reduced(context)) return widget.child;
    return FadeTransition(
      opacity: _curve,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}
