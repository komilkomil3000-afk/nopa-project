import 'package:flutter/material.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';

/// A reaction's emoji as a plain static Unicode glyph (no animation, no Lottie).
class ChatReactionEmoji extends StatelessWidget {
  final String type;
  final double size;
  const ChatReactionEmoji({super.key, required this.type, this.size = 24});

  @override
  Widget build(BuildContext context) => Text(ChatTheme.emojiOf(type), style: TextStyle(fontSize: size, height: 1.1));
}
