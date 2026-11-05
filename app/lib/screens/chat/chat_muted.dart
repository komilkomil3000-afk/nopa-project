import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';

String _clock(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return h > 0 ? '$h:$m:$s' : '$m:$s';
}

/// In place of the composer while a moderator has silenced this user: «شما بی‌صدا هستید» and the time left,
/// counting down. When it reaches zero [onEnd] runs and the composer comes back.
class ChatMutedBar extends StatefulWidget {
  final DateTime until;
  final VoidCallback onEnd;
  const ChatMutedBar({super.key, required this.until, required this.onEnd});

  @override
  State<ChatMutedBar> createState() => _ChatMutedBarState();
}

class _ChatMutedBarState extends State<ChatMutedBar> {
  Timer? _timer;
  bool _ended = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    if (!mounted) return;
    if (!widget.until.isAfter(DateTime.now())) {
      _timer?.cancel();
      if (!_ended) {
        _ended = true;
        widget.onEnd();
      }
      return;
    }
    setState(() {});
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(DateTime.now());
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 6, ChatTheme.gutter, 0),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: ChatTheme.danger.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: ChatTheme.danger.withValues(alpha: 0.7)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Row(children: [
          const Icon(Icons.voice_over_off_rounded, size: 20, color: ChatTheme.danger),
          const SizedBox(width: 10),
          Expanded(child: Text('شما بی‌صدا هستید', style: ChatTheme.title.copyWith(color: ChatTheme.text))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: ChatTheme.danger, borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.timer_outlined, size: 14, color: Colors.white),
              const SizedBox(width: 4),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(_clock(left.isNegative ? Duration.zero : left), style: ChatTheme.caption.copyWith(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// «بی‌صدا» in red beside a member's name, for moderators.
class ChatMutedBadge extends StatelessWidget {
  const ChatMutedBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: ChatTheme.danger.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ChatTheme.danger.withValues(alpha: 0.8)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.voice_over_off_rounded, size: 12, color: ChatTheme.danger),
        const SizedBox(width: 3),
        Text('بی‌صدا', style: ChatTheme.caption.copyWith(color: ChatTheme.danger, fontWeight: FontWeight.bold, fontSize: 10.5)),
      ]),
    );
  }
}

/// Whether a person row from the server (`mutedUntil`, moderators only) is silenced right now.
bool chatPersonMuted(Map<String, dynamic> person) {
  final until = DateTime.tryParse(person['mutedUntil']?.toString() ?? '')?.toLocal();
  return until != null && until.isAfter(DateTime.now());
}
