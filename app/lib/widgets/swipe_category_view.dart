import 'package:flutter/material.dart';

/// Moves between category tabs with a sideways swipe anywhere in [child], like the chat tab does.
/// The tabs read right to left, so a swipe to the right goes to the next one and a swipe to the left to the previous.
///
/// It watches raw pointers instead of joining the gesture arena, so cards, lists and scroll views inside
/// cannot swallow the swipe. A swipe that starts inside [excludeKey]'s widget (e.g. a banner carousel) is ignored.
class SwipeCategoryView extends StatefulWidget {
  final int index;
  final int count;
  final ValueChanged<int> onChanged;
  final GlobalKey? excludeKey;
  final Widget child;

  const SwipeCategoryView({super.key, required this.index, required this.count, required this.onChanged, this.excludeKey, required this.child});

  @override
  State<SwipeCategoryView> createState() => _SwipeCategoryViewState();
}

class _SwipeCategoryViewState extends State<SwipeCategoryView> {
  Offset? _start;
  int? _pointer;

  bool _inExcluded(Offset global) {
    final box = widget.excludeKey?.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.attached || !box.hasSize) return false;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    return rect.contains(global);
  }

  void _down(PointerDownEvent e) {
    if (_pointer != null) {
      _start = null; // a second finger: not a swipe
      return;
    }
    _pointer = e.pointer;
    _start = _inExcluded(e.position) ? null : e.position;
  }

  void _up(PointerUpEvent e) {
    if (e.pointer != _pointer) return;
    final start = _start;
    _pointer = null;
    _start = null;
    if (start == null) return;
    final dx = e.position.dx - start.dx;
    final dy = e.position.dy - start.dy;
    // A clearly sideways move, longer than a tap's wobble and not a vertical scroll
    if (dx.abs() < 60 || dx.abs() < dy.abs() * 1.6) return;
    if (dx > 0 && widget.index < widget.count - 1) {
      widget.onChanged(widget.index + 1);
    } else if (dx < 0 && widget.index > 0) {
      widget.onChanged(widget.index - 1);
    }
  }

  void _cancel(PointerCancelEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    _start = null;
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: _down,
      onPointerUp: _up,
      onPointerCancel: _cancel,
      child: widget.child,
    );
  }
}

/// Fades and slides the content in from the side the new tab lies on when [index] changes.
class CategorySlide extends StatefulWidget {
  final int index;
  final Widget child;

  const CategorySlide({super.key, required this.index, required this.child});

  @override
  State<CategorySlide> createState() => _CategorySlideState();
}

class _CategorySlideState extends State<CategorySlide> {
  bool _forward = true;

  @override
  void didUpdateWidget(CategorySlide old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index) _forward = widget.index > old.index;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOutCubic,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        // The next tab (to the left in right-to-left order) arrives from the left
        final from = Offset(_forward ? -0.12 : 0.12, 0);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: Tween(begin: from, end: Offset.zero).animate(animation), child: child),
        );
      },
      child: KeyedSubtree(key: ValueKey(widget.index), child: widget.child),
    );
  }
}
