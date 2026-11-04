import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';

/// A reaction's emoji with a small looping motion of its own (Telegram-style): the thumbs bounce and tilt,
/// the idea glows, the flower sways, the hands bob. Set [animate] false for a still one.
class ChatReactionEmoji extends StatefulWidget {
  final String type;
  final double size;
  final bool animate;
  const ChatReactionEmoji({super.key, required this.type, this.size = 24, this.animate = true});

  @override
  State<ChatReactionEmoji> createState() => _ChatReactionEmojiState();
}

class _ChatReactionEmojiState extends State<ChatReactionEmoji> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));

  @override
  void initState() {
    super.initState();
    if (widget.animate) _c.repeat();
  }

  @override
  void didUpdateWidget(ChatReactionEmoji old) {
    super.didUpdateWidget(old);
    if (widget.animate && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.animate && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final emoji = Text(ChatTheme.emojiOf(widget.type), style: TextStyle(fontSize: widget.size, height: 1.1));
    if (!widget.animate) return emoji;
    return AnimatedBuilder(
      animation: _c,
      child: emoji,
      builder: (context, child) {
        final t = _c.value;
        final wave = math.sin(t * 2 * math.pi);
        // A short burst in the first third of the loop, then rest
        final burst = t < 0.35 ? math.sin(t / 0.35 * math.pi) : 0.0;
        switch (widget.type) {
          case 'like':
            return Transform.translate(
              offset: Offset(0, -widget.size * 0.18 * burst),
              child: Transform.rotate(angle: -0.35 * burst, alignment: Alignment.bottomLeft, child: child),
            );
          case 'dislike':
            return Transform.translate(
              offset: Offset(0, widget.size * 0.18 * burst),
              child: Transform.rotate(angle: 0.35 * burst, alignment: Alignment.topLeft, child: child),
            );
          case 'idea':
            return Transform.scale(scale: 1 + 0.16 * (0.5 + 0.5 * wave), child: child);
          case 'flower':
            return Transform.rotate(angle: 0.22 * wave, alignment: Alignment.bottomCenter, child: child);
          case 'thanks':
            return Transform.translate(offset: Offset(0, -widget.size * 0.12 * (0.5 + 0.5 * wave)), child: Transform.scale(scale: 1 + 0.08 * burst, child: child));
          default:
            return Transform.scale(scale: 1 + 0.1 * burst, child: child);
        }
      },
    );
  }
}
