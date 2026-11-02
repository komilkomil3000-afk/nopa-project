import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/services/audio_exclusivity_service.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/zoomable_image.dart';
import 'package:url_launcher/url_launcher.dart';

/// How a conversation lays its messages out.
enum ChatBubbleStyle {
  /// Two people: bubbles with faces, no names.
  private,

  /// Many people: bubbles with faces, and the sender's name over the first of a run.
  group,

  /// A broadcast: every post is a full-width card.
  channel,
}

/// One message: sender, quoted reply, files, text, reactions and its delivery state.
/// A tap on it, or beside it on its row, opens its menu at [onTap]'s rectangle.
class ChatMessageBubble extends StatefulWidget {
  final ChatMessage message;
  final bool mine;
  final ChatBubbleStyle style;

  /// The sender's name over the bubble (the first of a run in a group).
  final bool showSender;

  /// Face and tail (the last of a run).
  final bool showAvatar;
  final bool seen;
  final String myId;
  final List<Map<String, dynamic>> staffTags;
  final void Function(Rect bubble) onTap;
  final VoidCallback? onOpenThread;
  final VoidCallback? onOpenSender;
  final VoidCallback onRetry;
  final void Function(String type) onReact;

  const ChatMessageBubble({
    super.key,
    required this.message,
    required this.mine,
    required this.style,
    required this.showSender,
    required this.showAvatar,
    required this.seen,
    required this.myId,
    this.staffTags = const [],
    required this.onTap,
    required this.onOpenThread,
    this.onOpenSender,
    required this.onRetry,
    required this.onReact,
  });

  @override
  State<ChatMessageBubble> createState() => _ChatMessageBubbleState();
}

class _ChatMessageBubbleState extends State<ChatMessageBubble> {
  final GlobalKey _bubbleKey = GlobalKey();

  static const double _avatarRadius = 16;

  ChatMessage get m => widget.message;
  bool get _card => widget.style == ChatBubbleStyle.channel;
  // A channel card is never gold: posts are not a dialogue
  bool get _mineLook => _card || widget.mine;
  Color get _textColor => ChatTheme.bubbleText(mine: _mineLook);
  Color get _mutedColor => ChatTheme.bubbleMuted(mine: _mineLook);

  void _tap() {
    if (m.deleted) return;
    final box = _bubbleKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    widget.onTap(box.localToGlobal(Offset.zero) & box.size);
  }

  @override
  Widget build(BuildContext context) {
    final content = _content();
    final Widget row;
    if (_card) {
      row = Container(
        key: _bubbleKey,
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
        decoration: ChatTheme.card(),
        child: content,
      );
    } else {
      final maxWidth = MediaQuery.sizeOf(context).width * 0.72;
      final bubble = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: widget.mine ? CrossAxisAlignment.start : CrossAxisAlignment.end,
        children: [
          ConstrainedBox(
            key: _bubbleKey,
            constraints: BoxConstraints(maxWidth: maxWidth, minWidth: 64),
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
              decoration: BoxDecoration(
                color: ChatTheme.bubbleFill(mine: widget.mine),
                borderRadius: BorderRadius.circular(ChatTheme.radius),
                border: widget.mine ? Border.all(color: ChatTheme.stroke.withValues(alpha: 0.8), width: 1) : null,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 6, offset: const Offset(0, 2))],
              ),
              child: content,
            ),
          ),
          if (widget.showAvatar)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Transform.translate(
                offset: const Offset(0, -1.2),
                child: CustomPaint(size: const Size(12, 8), painter: _TailPainter(fill: ChatTheme.bubbleFill(mine: widget.mine), stroke: widget.mine ? ChatTheme.stroke.withValues(alpha: 0.8) : null)),
              ),
            ),
        ],
      );
      final avatar = widget.showAvatar
          ? GestureDetector(
              onTap: widget.onOpenSender,
              child: ChatRing(
                child: SafeAvatar(imageUrl: m.senderAvatarUrl, name: m.senderName, radius: _avatarRadius, gender: m.senderGender, isMentor: m.senderIsMentor),
              ),
            )
          : const SizedBox(width: _avatarRadius * 2 + 5);
      // Right to left: one's own run sits on the right with its face outside it, everyone else's on the left
      row = Row(
        mainAxisAlignment: widget.mine ? MainAxisAlignment.start : MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: widget.mine
            ? [Padding(padding: const EdgeInsets.only(bottom: 4), child: avatar), const SizedBox(width: 6), Flexible(child: bubble)]
            : [Flexible(child: bubble), const SizedBox(width: 6), Padding(padding: const EdgeInsets.only(bottom: 4), child: avatar)],
      );
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _tap,
      child: Padding(
        padding: EdgeInsets.only(top: 2, bottom: _card ? 10 : (widget.showAvatar ? 8 : 2)),
        child: Directionality(textDirection: TextDirection.rtl, child: row),
      ),
    );
  }

  Widget _content() {
    if (m.deleted) {
      return Text('این پیام حذف شده است', style: ChatTheme.caption.copyWith(color: _mutedColor, fontStyle: FontStyle.italic));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.showSender)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: GestureDetector(
              onTap: widget.onOpenSender,
              child: Text(
                m.senderIsMentor ? '${m.senderName} · راهبر' : m.senderName,
                style: ChatTheme.caption.copyWith(color: _mineLook ? ChatTheme.accent : ChatTheme.ink, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        if (m.replyToId != null) _quote(),
        for (final attachment in m.attachments) ChatAttachmentView(attachment: attachment, onGold: !_mineLook),
        if (m.body.isNotEmpty) _bodyText(),
        if (m.tags.isNotEmpty || m.best || widget.staffTags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Wrap(spacing: 4, runSpacing: 4, children: [
              if (m.best) const ChatChip(label: 'بهترین پاسخ', color: ChatTheme.accent),
              for (final tag in m.tags) ChatChip(label: tag['name'] ?? '', color: ChatChip.parse(tag['color'] ?? '#9292E2')),
              for (final tag in widget.staffTags) ChatChip(label: '${tag['name']} (راهبران)', color: ChatChip.parse(tag['color'] ?? '#9292E2')),
            ]),
          ),
        if (m.reactions.isNotEmpty) _reactions(),
        if (widget.onOpenThread != null && (m.threadReplies > 0 || _card)) _threadLink(),
        _footer(),
      ],
    );
  }

  static final RegExp _link = RegExp(r'https?://[^\s]+');

  /// Text with its links tappable.
  Widget _bodyText() {
    final style = ChatTheme.body.copyWith(color: _textColor);
    final direction = _directionOf(m.body);
    if (!_link.hasMatch(m.body)) return Text(m.body, style: style, textDirection: direction);
    final spans = <InlineSpan>[];
    var at = 0;
    for (final match in _link.allMatches(m.body)) {
      if (match.start > at) spans.add(TextSpan(text: m.body.substring(at, match.start)));
      final url = match.group(0)!;
      spans.add(TextSpan(
        text: url,
        style: TextStyle(color: _mineLook ? ChatTheme.accent : ChatTheme.ink, decoration: TextDecoration.underline, fontWeight: _mineLook ? null : FontWeight.bold),
        recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      ));
      at = match.end;
    }
    if (at < m.body.length) spans.add(TextSpan(text: m.body.substring(at)));
    return RichText(textDirection: direction, text: TextSpan(style: style, children: spans));
  }

  /// Latin text reads left to right inside the right-to-left conversation.
  TextDirection _directionOf(String text) {
    final first = RegExp(r'[A-Za-z؀-ۿ]').firstMatch(text)?.group(0);
    return first != null && RegExp(r'[A-Za-z]').hasMatch(first) ? TextDirection.ltr : TextDirection.rtl;
  }

  Widget _quote() {
    final edge = _mineLook ? ChatTheme.lavender : ChatTheme.ink;
    return Container(
      margin: const EdgeInsets.only(bottom: 5),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: edge.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: BorderDirectional(start: BorderSide(color: edge, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(m.replyToSender ?? '', style: ChatTheme.caption.copyWith(color: edge, fontWeight: FontWeight.bold)),
          Text((m.replyToBody ?? '').isEmpty ? 'پیام' : m.replyToBody!, style: ChatTheme.caption.copyWith(color: _mutedColor), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _reactions() {
    final counts = <String, int>{};
    final mineSet = <String>{};
    for (final r in m.reactions) {
      counts[r['type']] = (counts[r['type']] ?? 0) + 1;
      if (r['userId'] == widget.myId) mineSet.add(r['type']);
    }
    final base = _mineLook ? ChatTheme.lavender : ChatTheme.ink;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          for (final entry in counts.entries)
            GestureDetector(
              onTap: () => widget.onReact(entry.key),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: base.withValues(alpha: mineSet.contains(entry.key) ? 0.3 : 0.12),
                  border: mineSet.contains(entry.key) ? Border.all(color: base.withValues(alpha: 0.5)) : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(ChatTheme.reactions[entry.key]?.icon ?? Icons.star_rounded, size: 13, color: _mineLook ? ChatTheme.accent : ChatTheme.ink),
                    const SizedBox(width: 3),
                    Text('${entry.value}', style: ChatTheme.caption.copyWith(color: _textColor)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _threadLink() {
    final color = _mineLook ? ChatTheme.accent : ChatTheme.ink;
    final label = m.threadReplies > 0 ? '${m.threadReplies} پاسخ' : 'ارسال نظر';
    return GestureDetector(
      onTap: widget.onOpenThread,
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        padding: _card ? const EdgeInsets.only(top: 6) : EdgeInsets.zero,
        decoration: _card ? BoxDecoration(border: Border(top: BorderSide(color: ChatTheme.stroke.withValues(alpha: 0.5)))) : null,
        child: Row(
          mainAxisSize: _card ? MainAxisSize.max : MainAxisSize.min,
          children: [
            Icon(Icons.forum_rounded, size: 14, color: color),
            const SizedBox(width: 4),
            Text(label, style: ChatTheme.caption.copyWith(color: color, fontWeight: FontWeight.bold)),
            if (_card) ...[const Spacer(), Icon(Icons.chevron_left_rounded, size: 18, color: color)],
          ],
        ),
      ),
    );
  }

  Widget _footer() {
    final time = '${m.createdAt.hour.toString().padLeft(2, '0')}:${m.createdAt.minute.toString().padLeft(2, '0')}';
    final caption = ChatTheme.caption.copyWith(fontSize: 10, color: _mutedColor);
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (m.pinned) Padding(padding: const EdgeInsets.only(left: 4), child: Icon(Icons.push_pin_rounded, size: 11, color: _mutedColor)),
          if (m.edited) Text('ویرایش‌شده · ', style: caption),
          Text(time, style: caption),
          if (widget.mine) ...[const SizedBox(width: 4), _state()],
        ],
      ),
    );
  }

  Widget _state() => switch (m.sendState) {
        ChatSendState.sending => Icon(Icons.schedule_rounded, size: 12, color: _mutedColor),
        ChatSendState.failed => GestureDetector(
            onTap: widget.onRetry,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.refresh_rounded, size: 14, color: ChatTheme.danger),
                Text(' تلاش دوباره', style: TextStyle(color: ChatTheme.danger, fontFamily: AppTheme.fontFamily, fontSize: 10)),
              ],
            ),
          ),
        ChatSendState.sent => Icon(widget.seen ? Icons.done_all_rounded : Icons.done_rounded, size: 13, color: widget.seen ? ChatTheme.online : _mutedColor),
      };
}

/// The small triangle under the last bubble of a run, pointing at its sender's face.
class _TailPainter extends CustomPainter {
  final Color fill;
  final Color? stroke;
  const _TailPainter({required this.fill, this.stroke});

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = fill);
    if (stroke != null) {
      final edge = Paint()
        ..color = stroke!
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1;
      canvas.drawLine(Offset(0, 0.6), Offset(size.width / 2, size.height), edge);
      canvas.drawLine(Offset(size.width, 0.6), Offset(size.width / 2, size.height), edge);
    }
  }

  @override
  bool shouldRepaint(_TailPainter old) => old.fill != fill || old.stroke != stroke;
}

/// A photo, voice or file inside a message. [onGold] draws it for the light, gold bubble.
class ChatAttachmentView extends StatelessWidget {
  final ChatAttachment attachment;
  final bool onGold;
  const ChatAttachmentView({super.key, required this.attachment, this.onGold = false});

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
        return ChatAudioPlayer(url: _url, onGold: onGold);
      default:
        final color = onGold ? ChatTheme.ink : ChatTheme.accent;
        return GestureDetector(
          onTap: () => launchUrl(Uri.parse(_url), mode: LaunchMode.externalApplication),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(attachment.kind == 'video' ? Icons.movie_rounded : Icons.description_rounded, color: color, size: 24),
                const SizedBox(width: 6),
                Flexible(child: Text(attachment.name, style: ChatTheme.caption.copyWith(color: onGold ? ChatTheme.ink : ChatTheme.text), maxLines: 2, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
        );
    }
  }
}

/// Play/pause and progress of one voice message.
class ChatAudioPlayer extends StatefulWidget {
  final String url;
  final bool onGold;
  const ChatAudioPlayer({super.key, required this.url, this.onGold = false});

  @override
  State<ChatAudioPlayer> createState() => _ChatAudioPlayerState();
}

class _ChatAudioPlayerState extends State<ChatAudioPlayer> {
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
    final color = widget.onGold ? ChatTheme.ink : ChatTheme.accent;
    return SizedBox(
      width: 190,
      child: Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: _toggle,
            icon: Icon(_playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded, color: color, size: 30),
          ),
          Expanded(child: LinearProgressIndicator(value: value, color: color, backgroundColor: color.withValues(alpha: 0.2))),
        ],
      ),
    );
  }
}
