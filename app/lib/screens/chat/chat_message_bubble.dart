import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/audio_exclusivity_service.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/zoomable_image.dart';
import 'package:url_launcher/url_launcher.dart';

/// One message: sender, quoted reply, files, text, reactions and its delivery state.
class ChatMessageBubble extends StatelessWidget {
  final ChatMessage message;
  final bool mine;
  final bool showSender;
  final bool seen;
  final String myId;
  final VoidCallback onLongPress;
  final VoidCallback? onOpenThread;
  final VoidCallback onRetry;
  final void Function(String type) onReact;

  const ChatMessageBubble({
    super.key,
    required this.message,
    required this.mine,
    required this.showSender,
    required this.seen,
    required this.myId,
    required this.onLongPress,
    required this.onOpenThread,
    required this.onRetry,
    required this.onReact,
  });

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.of(context).size.width * 0.76;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.start : MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        textDirection: TextDirection.rtl,
        children: [
          if (!mine) ...[
            SafeAvatar(imageUrl: message.senderAvatarUrl, name: message.senderName, radius: 15, gender: message.senderGender, isMentor: message.senderIsMentor),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: GestureDetector(
                onLongPress: message.deleted ? null : onLongPress,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(10, 7, 10, 6),
                  decoration: ChatTheme.bubble(mine: mine),
                  child: _content(context),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _content(BuildContext context) {
    if (message.deleted) {
      return Text('این پیام حذف شده است', style: ChatTheme.caption.copyWith(fontStyle: FontStyle.italic));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showSender && !mine)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(message.senderName, style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)),
          ),
        if (message.replyToId != null) _quote(),
        for (final attachment in message.attachments) _Attachment(attachment: attachment),
        if (message.body.isNotEmpty) Text(message.body, style: ChatTheme.body, textDirection: _directionOf(message.body)),
        if (message.reactions.isNotEmpty) _reactions(),
        if (onOpenThread != null && message.threadReplies > 0) _threadLink(),
        _footer(),
      ],
    );
  }

  /// Latin text reads left to right inside the right-to-left conversation.
  TextDirection _directionOf(String text) {
    final first = RegExp(r'[A-Za-z؀-ۿ]').firstMatch(text)?.group(0);
    return first != null && RegExp(r'[A-Za-z]').hasMatch(first) ? TextDirection.ltr : TextDirection.rtl;
  }

  Widget _quote() => Container(
        margin: const EdgeInsets.only(bottom: 5),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: const BoxDecoration(border: BorderDirectional(start: BorderSide(color: ChatTheme.lavender, width: 2))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message.replyToSender ?? '', style: ChatTheme.caption.copyWith(color: ChatTheme.lavender)),
            Text((message.replyToBody ?? '').isEmpty ? 'پیام' : message.replyToBody!, style: ChatTheme.caption, maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ),
      );

  Widget _reactions() {
    final counts = <String, int>{};
    final myReactions = <String>{};
    for (final r in message.reactions) {
      counts[r['type']] = (counts[r['type']] ?? 0) + 1;
      if (r['userId'] == myId) myReactions.add(r['type']);
    }
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          for (final entry in counts.entries)
            GestureDetector(
              onTap: () => onReact(entry.key),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: ChatTheme.lavender.withValues(alpha: myReactions.contains(entry.key) ? 0.3 : 0.12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(ChatTheme.reactions[entry.key]?.icon ?? Icons.star_rounded, size: 13, color: ChatTheme.accent),
                    const SizedBox(width: 3),
                    Text('${entry.value}', style: ChatTheme.caption.copyWith(color: ChatTheme.text)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _threadLink() => GestureDetector(
        onTap: onOpenThread,
        child: Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.forum_rounded, size: 14, color: ChatTheme.accent),
              const SizedBox(width: 4),
              Text('${message.threadReplies} پاسخ', style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
            ],
          ),
        ),
      );

  Widget _footer() {
    final time = '${message.createdAt.hour.toString().padLeft(2, '0')}:${message.createdAt.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (message.pinned) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.push_pin_rounded, size: 11, color: ChatTheme.muted)),
          if (message.edited) Text('ویرایش‌شده · ', style: ChatTheme.caption.copyWith(fontSize: 10)),
          Text(time, style: ChatTheme.caption.copyWith(fontSize: 10)),
          if (mine) ...[const SizedBox(width: 4), _state()],
        ],
      ),
    );
  }

  Widget _state() => switch (message.sendState) {
        ChatSendState.sending => const Icon(Icons.schedule_rounded, size: 12, color: ChatTheme.muted),
        ChatSendState.failed => GestureDetector(
            onTap: onRetry,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.refresh_rounded, size: 14, color: ChatTheme.danger),
                Text(' تلاش دوباره', style: TextStyle(color: ChatTheme.danger, fontFamily: AppTheme.fontFamily, fontSize: 10)),
              ],
            ),
          ),
        ChatSendState.sent => Icon(seen ? Icons.done_all_rounded : Icons.done_rounded, size: 13, color: seen ? ChatTheme.accent : ChatTheme.muted),
      };
}

class _Attachment extends StatelessWidget {
  final ChatAttachment attachment;
  const _Attachment({required this.attachment});

  String get _url => ApiConstants.resolveImageUrl(attachment.url);

  @override
  Widget build(BuildContext context) {
    switch (attachment.kind) {
      case 'image':
        return Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(ChatTheme.radius),
            child: ZoomableImage(
              imageUrl: _url,
              child: CachedNetworkImage(
                imageUrl: _url,
                cacheKey: 'chat-${attachment.id}', // the link changes, the file does not
                height: 190,
                fit: BoxFit.cover,
                placeholder: (_, _) => const SizedBox(height: 120, width: 160),
                errorWidget: (_, _, _) => const SizedBox(height: 60, width: 160, child: Icon(Icons.broken_image_rounded, color: ChatTheme.muted)),
              ),
            ),
          ),
        );
      case 'audio':
        return _AudioPlayerRow(url: _url);
      default:
        return GestureDetector(
          onTap: () => launchUrl(Uri.parse(_url), mode: LaunchMode.externalApplication),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(attachment.kind == 'video' ? Icons.movie_rounded : Icons.description_rounded, color: ChatTheme.accent, size: 24),
                const SizedBox(width: 6),
                Flexible(child: Text(attachment.name, style: ChatTheme.caption.copyWith(color: ChatTheme.text), maxLines: 2, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
        );
    }
  }
}

class _AudioPlayerRow extends StatefulWidget {
  final String url;
  const _AudioPlayerRow({required this.url});

  @override
  State<_AudioPlayerRow> createState() => _AudioPlayerRowState();
}

class _AudioPlayerRowState extends State<_AudioPlayerRow> {
  final AudioPlayer _player = AudioPlayer();
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _playing = s == PlayerState.playing);
    });
    _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _total = d);
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_playing) {
      await _player.pause();
    } else {
      AudioExclusivityService.registerAudioPlayer(_player);
      await _player.play(UrlSource(widget.url));
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = _total.inMilliseconds > 0 ? (_position.inMilliseconds / _total.inMilliseconds).clamp(0.0, 1.0) : 0.0;
    return SizedBox(
      width: 190,
      child: Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: _toggle,
            icon: Icon(_playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded, color: ChatTheme.accent, size: 30),
          ),
          Expanded(child: LinearProgressIndicator(value: value, color: ChatTheme.accent, backgroundColor: ChatTheme.stroke.withValues(alpha: 0.4))),
        ],
      ),
    );
  }
}
