import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Makes a small tappable widget easier to hit without changing the layout: the area around [child] that
/// is needed to reach [minSize] (a 44 logical-pixel target by default) also forwards taps to it.
/// Widgets that are already large enough are not affected.
class TapExpander extends SingleChildRenderObjectWidget {
  final double minSize;

  const TapExpander({super.key, super.child, this.minSize = 44});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderTapExpander(minSize);

  @override
  void updateRenderObject(BuildContext context, RenderObject renderObject) {
    (renderObject as _RenderTapExpander).minSize = minSize;
  }
}

class _RenderTapExpander extends RenderProxyBox {
  _RenderTapExpander(this.minSize);

  double minSize;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    final extraX = size.width < minSize ? (minSize - size.width) / 2 : 0.0;
    final extraY = size.height < minSize ? (minSize - size.height) / 2 : 0.0;
    final inside = position.dx >= -extraX &&
        position.dx <= size.width + extraX &&
        position.dy >= -extraY &&
        position.dy <= size.height + extraY;
    if (!inside) return false;
    // A tap in the extra area is handed to the child as if it had landed on its nearest edge
    final clamped = Offset(position.dx.clamp(0.0, size.width), position.dy.clamp(0.0, size.height));
    return child?.hitTest(result, position: clamped) ?? false;
  }
}
