import 'package:nopa_app/core/avatar_catalog.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_format.dart';
import 'package:nopa_app/screens/chat/chat_reaction_emoji.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_waveform.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/services/audio_exclusivity_service.dart';
import 'package:nopa_app/services/chat_downloads.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
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

/// One message: sender, quoted reply, files, text (or a challenge), reactions, the way into the conversation
/// under it and its delivery state. A tap on it, or beside it on its row, opens its menu at [onTap]'s rectangle.
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

  /// Mentors and staff of this conversation: their reactions carry the mentor's badge.
  final Set<String> staffIds;

  /// Names that may be mentioned here, to tell a two-word mention from a mention and a word.
  final Set<String> mentionNames;
  final void Function(Rect bubble) onTap;

  /// The box into the conversation under this message; null where there is none.
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
    this.staffIds = const {},
    this.mentionNames = const {},
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
  static const double _stroke = 1.2;

  ChatMessage get m => widget.message;
  bool get _card => widget.style == ChatBubbleStyle.channel;
  bool get _challenge => m.kind == 'challenge' && !m.deleted;
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

  /// The station-window frame (own messages, channel posts) or the زریک frame (everyone else).
  Widget _frame({required Widget child, required EdgeInsets padding, double? width}) {
    final radius = ChatTheme.radius;
    return Container(
      width: width,
      decoration: BoxDecoration(
        gradient: _mineLook ? ChatTheme.mineStroke : ChatTheme.otherStroke,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      padding: const EdgeInsets.all(_stroke),
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: _mineLook ? ChatTheme.mineFillGradient : ChatTheme.otherFillGradient,
          borderRadius: BorderRadius.circular(radius - _stroke),
        ),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = _content();
    final Widget row;
    if (_card) {
      row = KeyedSubtree(key: _bubbleKey, child: _frame(width: double.infinity, padding: const EdgeInsets.fromLTRB(14, 12, 14, 8), child: content));
    } else {
      final maxWidth = MediaQuery.sizeOf(context).width * (_challenge ? 0.8 : 0.72);
      final bubble = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: widget.mine ? CrossAxisAlignment.start : CrossAxisAlignment.end,
        children: [
          ConstrainedBox(
            key: _bubbleKey,
            constraints: BoxConstraints(maxWidth: maxWidth, minWidth: 64),
            child: _frame(padding: const EdgeInsets.fromLTRB(12, 8, 12, 6), child: content),
          ),
          if (widget.showAvatar)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Transform.translate(
                offset: const Offset(0, -1.4),
                child: CustomPaint(
                  size: const Size(12, 8),
                  painter: _TailPainter(fill: ChatTheme.bubbleFill(mine: widget.mine), stroke: ChatTheme.tailStroke(mine: widget.mine)),
                ),
              ),
            ),
        ],
      );
      final avatar = widget.showAvatar
          ? GestureDetector(
              onTap: widget.onOpenSender,
              child: m.senderId == null && m.botKey != null
                  ? const ChatRing(child: ChatIconAvatar(icon: Icons.smart_toy_rounded, radius: _avatarRadius))
                  : ChatRing(child: SafeAvatar(imageUrl: m.senderAvatarUrl, name: m.senderName, radius: _avatarRadius, gender: m.senderGender, isMentor: m.senderIsMentor)),
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
        if (widget.showSender) _sender(),
        if (m.replyToId != null) _quote(),
        if (_isSubmission) _submissionBadge(),
        if (_challenge) ..._challengeContent() else ...[
          for (final attachment in m.attachments) ChatAttachmentView(attachment: attachment, onGold: !_mineLook, own: widget.mine),
          if (m.body.isNotEmpty) _bodyText(),
        ],
        if (m.tags.isNotEmpty || m.best || m.evidence || m.finalMark || widget.staffTags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Wrap(spacing: 4, runSpacing: 4, children: [
              // The best-answer mark is a mentor's: it wears the mentor's colour and badge
              if (m.best) const ChatChip.mentor(label: 'بهترین پاسخ'),
              // Each mark has its own colour so it reads at once: green evidence, orange final answer
              if (m.finalMark) const ChatChip(label: 'پاسخ نهایی گروه', color: Color(0xFFE8710A), icon: Icons.task_alt_rounded, filled: true),
              if (m.evidence) const ChatChip(label: 'شاهد امتیاز', color: Color(0xFF12945F), icon: Icons.verified_rounded, filled: true),
              for (final tag in m.tags) ChatChip(label: tag['name'] ?? '', color: ChatChip.parse(tag['color'] ?? '#9292E2')),
              for (final tag in widget.staffTags) ChatChip(label: '${tag['name']} (راهبران)', color: ChatChip.parse(tag['color'] ?? '#9292E2')),
            ]),
          ),
        if (m.reactions.isNotEmpty) _reactions(),
        if (widget.onOpenThread != null && m.threadOpen) _threadBox(),
        _footer(),
      ],
    );
  }

  /// A caravan's work under an inter-group challenge in «میدان آثار».
  bool get _isSubmission => m.meta?['submission'] == true;

  /// «اثر کاروان», and the place the admin gave it once the ranking is confirmed.
  Widget _submissionBadge() {
    final rank = (m.meta?['rank'] as num?)?.toInt();
    final label = (m.meta?['rankLabel'] ?? '').toString();
    final caravan = (m.meta?['caravanName'] ?? '').toString();
    final color = switch (rank) {
      1 => const Color(0xFFE5B84B),
      2 => const Color(0xFFC4C9D4),
      3 => const Color(0xFFCD8B5A),
      _ => ChatTheme.accent,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Wrap(spacing: 4, runSpacing: 4, children: [
        const ChatChip(label: 'اثر کاروان'),
        if (rank != null)
          ChatChip(label: caravan.isEmpty ? label : '$label · $caravan', color: color),
      ]),
    );
  }

  Widget _sender() {
    final name = Text(
      m.senderName,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: ChatTheme.caption.copyWith(color: _mineLook ? ChatTheme.accent : ChatTheme.goldTitle, fontWeight: FontWeight.bold, fontSize: 11.5),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: GestureDetector(
        onTap: widget.onOpenSender,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Flexible(child: name),
          if (m.mentorMark) ...[const SizedBox(width: 5), const ChatChip.mentor(label: 'راهبر')],
        ]),
      ),
    );
  }

  /// Text with bold, italic, mentions and tappable links.
  Widget _bodyText() {
    final style = ChatTheme.body.copyWith(color: _textColor);
    return Text.rich(
      TextSpan(
        children: ChatFormat.spans(
          m.body,
          linkColor: _mineLook ? ChatTheme.accent : ChatTheme.goldTitle,
          mentionColor: _mineLook ? ChatTheme.lavender : const Color(0xFF3A2A7A),
          mentionNames: widget.mentionNames,
        ),
      ),
      style: style,
      textDirection: _directionOf(m.body),
    );
  }

  /// A challenge reads like a message: its kind and title, then small boxes for its details.
  List<Widget> _challengeContent() {
    final meta = m.meta ?? const {};
    final status = m.topicStatus ?? 'open';
    final creator = (meta['creatorName'] ?? '').toString();
    final creatorRole = meta['creatorRole']?.toString();
    final mentorCreator = creator.isNotEmpty && (creatorRole == 'mentor' || (creatorRole == null && creator != 'مدیر سیستم'));
    final description = (meta['description'] ?? '').toString();
    return [
      Row(children: [
        Icon(Icons.local_fire_department_rounded, size: 16, color: _textColor),
        const SizedBox(width: 4),
        Text('چالش ${meta['tag'] ?? ''}', style: ChatTheme.caption.copyWith(color: _mutedColor, fontWeight: FontWeight.bold)),
        const Spacer(),
        // Top-left corner of the card (the end of the row in RTL)
        ChallengeStatusBadge(status: status),
      ]),
      const SizedBox(height: 6),
      Text(meta['title']?.toString() ?? m.body, style: ChatTheme.title.copyWith(color: _textColor, fontSize: 14.5)),
      if (description.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(description, style: ChatTheme.body.copyWith(color: _textColor.withValues(alpha: 0.9), fontSize: 13), maxLines: 4, overflow: TextOverflow.ellipsis),
        ),
      const SizedBox(height: 8),
      Wrap(spacing: 5, runSpacing: 5, children: [
        if (creator.isNotEmpty)
          mentorCreator ? ChatChip.mentor(label: creator) : _InfoBox(icon: Icons.person_rounded, text: creator, onGold: !_mineLook),
        if ((meta['stationTitle'] ?? '').toString().isNotEmpty) _InfoBox(icon: Icons.flag_rounded, text: meta['stationTitle'].toString(), onGold: !_mineLook),
        if (meta['dueDate'] != null) _InfoBox(icon: Icons.schedule_rounded, text: 'مهلت ${chatDateText(meta['dueDate'])}', onGold: !_mineLook),
        if ((meta['reward'] ?? '').toString().isNotEmpty) _InfoBox(icon: Icons.emoji_events_rounded, text: meta['reward'].toString(), onGold: !_mineLook),
        if ((meta['finalAnswer'] ?? '').toString().isNotEmpty) _InfoBox(icon: Icons.task_alt_rounded, text: 'پاسخ نهایی: ${meta['finalAnswer']}', onGold: !_mineLook),
      ]),
    ];
  }

  /// Latin text reads left to right inside the right-to-left conversation.
  TextDirection _directionOf(String text) {
    final first = RegExp(r'[A-Za-z؀-ۿ]').firstMatch(text)?.group(0);
    return first != null && RegExp(r'[A-Za-z]').hasMatch(first) ? TextDirection.ltr : TextDirection.rtl;
  }

  Widget _quote() {
    final edge = _mineLook ? ChatTheme.lavender : ChatTheme.goldTitle;
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
          Text(ChatFormat.plain((m.replyToBody ?? '').isEmpty ? 'پیام' : m.replyToBody!), style: ChatTheme.caption.copyWith(color: _mutedColor), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _reactions() {
    final counts = <String, int>{};
    final mineSet = <String>{};
    final byStaff = <String>{};
    for (final r in m.reactions) {
      counts[r['type']] = (counts[r['type']] ?? 0) + 1;
      if (r['userId'] == widget.myId) mineSet.add(r['type']);
      if (widget.staffIds.contains(r['userId'])) byStaff.add(r['type']);
    }
    final base = _mineLook ? ChatTheme.lavender : ChatTheme.goldTitle;
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
                  border: Border.all(color: byStaff.contains(entry.key) ? ChatTheme.mentor : base.withValues(alpha: mineSet.contains(entry.key) ? 0.5 : 0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ChatReactionEmoji(type: entry.key, size: 13),
                    const SizedBox(width: 3),
                    Text('${entry.value}', style: ChatTheme.caption.copyWith(color: _textColor)),
                    // A mentor's reaction wears the mentor's badge
                    if (byStaff.contains(entry.key)) ...[const SizedBox(width: 3), const Icon(ChatTheme.mentorBadge, size: 12, color: ChatTheme.mentor)],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// The way into the conversation under this message, with the faces of who is talking there.
  Widget _threadBox() {
    final fg = _mineLook ? ChatTheme.accent : ChatTheme.goldTitle;
    final faces = m.threadPeople.take(4).toList();
    final label = m.threadReplies > 0 ? 'ورود به گفتگو · ${m.threadReplies} پاسخ' : 'ورود به گفتگو';
    return GestureDetector(
      onTap: widget.onOpenThread,
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.fromLTRB(10, 6, 6, 6),
        decoration: BoxDecoration(
          color: fg.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: fg.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Icon(Icons.forum_rounded, size: 16, color: fg),
            const SizedBox(width: 6),
            Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChatTheme.caption.copyWith(color: fg, fontWeight: FontWeight.bold, fontSize: 11.5))),
            if (faces.isNotEmpty)
              SizedBox(
                width: 20.0 + (faces.length - 1) * 13,
                height: 20,
                child: Stack(
                  children: [
                    for (var i = 0; i < faces.length; i++)
                      PositionedDirectional(
                        start: i * 13.0,
                        child: Container(
                          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: _mineLook ? ChatTheme.surfaceBottom : ChatTheme.goldFill, width: 1.5)),
                          child: SafeAvatar(
                            imageUrl: faces[i]['avatarUrl'],
                            name: faces[i]['name'] ?? '',
                            radius: 8.5,
                            gender: faces[i]['gender'],
                            isMentor: AvatarCatalog.isMentorRole(faces[i]['role']),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            Icon(Icons.chevron_left_rounded, size: 18, color: fg),
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
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.refresh_rounded, size: 14, color: ChatTheme.danger),
                Text(' تلاش دوباره', style: AppTypography.caption.copyWith(color: ChatTheme.danger)),
              ],
            ),
          ),
        ChatSendState.sent => Icon(widget.seen ? Icons.done_all_rounded : Icons.done_rounded, size: 13, color: widget.seen ? ChatTheme.online : _mutedColor),
      };
}

/// A small detail box under a message (station, deadline, reward...).
class _InfoBox extends StatelessWidget {
  final IconData? icon;
  final String text;
  final bool onGold;
  const _InfoBox({this.icon, required this.text, required this.onGold});

  @override
  Widget build(BuildContext context) {
    final fg = onGold ? ChatTheme.goldTitle : ChatTheme.text;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.22)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: fg.withValues(alpha: 0.8)), const SizedBox(width: 3)],
        Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChatTheme.caption.copyWith(color: fg, fontSize: 10.5, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

/// The small triangle under the last bubble of a run, pointing at its sender's face.
class _TailPainter extends CustomPainter {
  final Color fill;
  final Color stroke;
  const _TailPainter({required this.fill, required this.stroke});

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = fill);
    final edge = Paint()
      ..color = stroke
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    canvas.drawLine(const Offset(0, 0.6), Offset(size.width / 2, size.height), edge);
    canvas.drawLine(Offset(size.width, 0.6), Offset(size.width / 2, size.height), edge);
  }

  @override
  bool shouldRepaint(_TailPainter old) => old.fill != fill || old.stroke != stroke;
}

/// A photo, voice or file inside a message. [onGold] draws it for the light, gold bubble.
/// Received photos and voices are not fetched on their own: the user taps to download them
/// ([own] ones, sent by this user, are shown directly).
class ChatAttachmentView extends StatefulWidget {
  final ChatAttachment attachment;
  final bool onGold;
  final bool own;
  const ChatAttachmentView({super.key, required this.attachment, this.onGold = false, this.own = false});

  @override
  State<ChatAttachmentView> createState() => _ChatAttachmentViewState();
}

class _ChatAttachmentViewState extends State<ChatAttachmentView> {
  ChatAttachment get attachment => widget.attachment;
  bool get onGold => widget.onGold;
  String get _url => ApiConstants.resolveImageUrl(attachment.url);
  String get _cacheKey => 'chat-${attachment.id}'; // the link changes, the file does not

  @override
  void initState() {
    super.initState();
    ChatDownloads.instance.addListener(_changed);
    ChatDownloads.instance.load();
  }

  @override
  void dispose() {
    ChatDownloads.instance.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  Future<void> _download() async {
    final ok = await ChatDownloads.instance.download(attachment.id, _url, cacheKey: _cacheKey);
    if (!ok && mounted) {
      AppToast.error(context, 'دانلود انجام نشد. اتصال اینترنت را بررسی کنید. اگر فیلترشکن شما روشن است، لطفاً آن را خاموش کنید.');
    }
  }

  static String _size(int bytes) {
    if (bytes <= 0) return '';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).ceil()} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  bool get _ready => widget.own || ChatDownloads.instance.has(attachment.id);

  Widget _downloadButton(Color color) {
    final busy = ChatDownloads.instance.isBusy(attachment.id);
    return GestureDetector(
      onTap: busy ? null : _download,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 34,
            height: 34,
            child: busy
                ? Padding(padding: const EdgeInsets.all(7), child: CircularProgressIndicator(strokeWidth: 2.4, color: color))
                : Icon(Icons.download_for_offline_rounded, color: color, size: 30),
          ),
          const SizedBox(width: 6),
          Text(_size(attachment.size), style: ChatTheme.caption.copyWith(color: color)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = onGold ? ChatTheme.goldTitle : ChatTheme.accent;
    switch (attachment.kind) {
      case 'image':
        if (!_ready) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(ChatTheme.radius),
              child: Container(
                height: 150,
                width: 190,
                color: color.withValues(alpha: 0.12),
                alignment: Alignment.center,
                child: _downloadButton(color),
              ),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(ChatTheme.radius),
            child: ZoomableImage(
              imageUrl: _url,
              child: CachedNetworkImage(
                imageUrl: _url,
                cacheKey: _cacheKey,
                height: 190,
                fit: BoxFit.cover,
                placeholder: (_, _) => const SizedBox(height: 120, width: 160),
                errorWidget: (_, _, _) => const SizedBox(height: 60, width: 160, child: Icon(Icons.broken_image_rounded, color: ChatTheme.muted)),
              ),
            ),
          ),
        );
      case 'audio':
        if (!_ready) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: SizedBox(
              width: 230,
              child: Row(
                children: [
                  _downloadButton(color),
                  const SizedBox(width: 8),
                  Expanded(child: Text('پیام صوتی', style: ChatTheme.caption.copyWith(color: color))),
                ],
              ),
            ),
          );
        }
        return ChatAudioPlayer(url: _url, onGold: onGold, peaks: ChatWaveform.decodePeaks(attachment.name), seed: attachment.id, attachmentId: attachment.id);
      default:
        final fileColor = onGold ? ChatTheme.goldTitle : ChatTheme.accent;
        return GestureDetector(
          onTap: () => launchUrl(Uri.parse(_url), mode: LaunchMode.externalApplication),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(attachment.kind == 'video' ? Icons.movie_rounded : Icons.description_rounded, color: fileColor, size: 24),
                const SizedBox(width: 6),
                Flexible(child: Text(attachment.name, style: ChatTheme.caption.copyWith(color: onGold ? ChatTheme.goldInk : ChatTheme.text), maxLines: 2, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
        );
    }
  }
}

/// One voice message: play/pause and its waveform. Tap or drag the waveform to jump to any moment.
class ChatAudioPlayer extends StatefulWidget {
  final String url;
  final bool onGold;

  /// The recording's bars (see [ChatWaveform.decodePeaks]); without them a stable shape is drawn from [seed].
  final List<double>? peaks;
  final String? seed;

  /// A recording still on the device (the voice composer's preview); then [url] is not used.
  final String? filePath;

  /// Overrides the colour of the controls and bars (the composer bar is light, a bubble is not).
  final Color? color;

  /// Defaults to a width that fits a bubble; the composer lets it fill the bar.
  final double? width;
  /// The chat file behind [url]: its link is renewed before playing (saved messages carry expired ones).
  final String? attachmentId;
  const ChatAudioPlayer({super.key, required this.url, this.onGold = false, this.peaks, this.seed, this.filePath, this.color, this.width, this.attachmentId});

  @override
  State<ChatAudioPlayer> createState() => _ChatAudioPlayerState();
}

class _ChatAudioPlayerState extends State<ChatAudioPlayer> with AutomaticKeepAliveClientMixin {
  final AudioPlayer _player = AudioPlayer();

  /// A voice that is playing (or paused midway) is kept when its message scrolls out of view,
  /// so the sound goes on while the user reads up the chat; it is released once it ends.
  @override
  bool get wantKeepAlive => _playing || (_started && !_completed);

  void _refreshKeepAlive() {
    if (mounted) updateKeepAlive();
  }
  late final List<double> _peaks = widget.peaks ?? ChatWaveform.pseudoPeaks(widget.seed ?? widget.filePath ?? widget.url);
  String? _freshUrl;
  DateTime _freshAt = DateTime.fromMillisecondsSinceEpoch(0);
  Source get _source => widget.filePath != null ? DeviceFileSource(widget.filePath!) : UrlSource(_freshUrl ?? widget.url);

  /// Asks the server for a new signed link (valid an hour) when the one in hand may have expired.
  Future<void> _renewLink() async {
    final id = widget.attachmentId;
    if (id == null || widget.filePath != null) return;
    if (_freshUrl != null && DateTime.now().difference(_freshAt).inMinutes < 30) return;
    final res = await ChatRepository.instance.api('GET', '/chat/attachments/$id/link');
    final url = res.ok && res.data is Map ? (res.data as Map)['url']?.toString() : null;
    if (url != null && url.isNotEmpty) {
      _freshUrl = ApiConstants.resolveImageUrl(url);
      _freshAt = DateTime.now();
      _loaded = false;
    }
  }
  bool _playing = false;
  bool _loaded = false;
  bool _completed = false;
  /// The source was started: resume and seek are safe.
  bool _started = false;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;

  /// The fraction under the finger while dragging; null otherwise.
  double? _scrub;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _playing = s == PlayerState.playing);
      _refreshKeepAlive();
    });
    _player.onPositionChanged.listen((p) {
      if (mounted && _scrub == null) setState(() => _position = p);
    });
    _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _total = d);
    });
    _player.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _completed = true;
          _started = false;
          _position = Duration.zero;
        });
      }
      _refreshKeepAlive();
    });
  }

  @override
  void dispose() {
    AudioExclusivityService.unregisterAudioPlayer(_player);
    _player.dispose();
    super.dispose();
  }

  /// Learns the length once, without ever blocking playback: a failure here is not fatal.
  Future<void> _ensureLoaded() async {
    await _renewLink();
    if (_loaded) return;
    try {
      await _player.setSource(_source);
      _loaded = true;
      final duration = await _player.getDuration();
      if (duration != null && duration > Duration.zero && mounted) setState(() => _total = duration);
    } catch (_) {}
  }

  /// Plays from [_position]. A paused player resumes; a fresh, finished or never-started one starts its
  /// source again at that position (seeking a stopped player is what used to fail).
  Future<void> _toggle() async {
    if (_playing) {
      await _player.pause();
      return;
    }
    AudioExclusivityService.registerAudioPlayer(_player);
    try {
      if (_started && !_completed) {
        await _player.resume();
      } else {
        await _renewLink();
        final from = _completed ? Duration.zero : _position;
        _completed = false;
        await _player.play(_source, position: from);
        _started = true;
        _refreshKeepAlive();
      }
    } catch (_) {
      // One more try from scratch before giving up
      try {
        _completed = false;
        await _player.stop();
        _freshAt = DateTime.fromMillisecondsSinceEpoch(0); // renew the link too
        await _renewLink();
        await _player.play(_source, position: _position);
        _started = true;
      } catch (_) {
        if (mounted) AppToast.error(context, 'پخش صدا انجام نشد.');
      }
    }
  }

  Future<void> _seekTo(double fraction) async {
    if (_total == Duration.zero) await _ensureLoaded();
    if (!mounted) return;
    if (_total == Duration.zero) {
      setState(() => _scrub = null);
      return;
    }
    final target = Duration(milliseconds: (_total.inMilliseconds * fraction).round());
    final wasCompleted = _completed;
    setState(() {
      _position = target;
      _scrub = null;
    });
    try {
      if (_started && !wasCompleted) {
        await _player.seek(target);
      } else {
        // Nothing playing yet (or finished): start from the touched moment
        _completed = false;
        _started = false;
        await _toggle();
      }
    } catch (_) {
      _started = false;
      await _toggle();
    }
  }

  static String _clock(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final fraction = _scrub ?? (_total.inMilliseconds > 0 ? (_position.inMilliseconds / _total.inMilliseconds).clamp(0.0, 1.0) : 0.0);
    final shown = _scrub != null ? Duration(milliseconds: (_total.inMilliseconds * _scrub!).round()) : _position;
    final color = widget.color ?? (widget.onGold ? ChatTheme.goldTitle : ChatTheme.accent);
    // Play button on the left, the timeline to its right, whatever the chat direction
    return Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(
      width: widget.width ?? 230,
      child: Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: _toggle,
            icon: Icon(_playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded, color: color, size: 30),
          ),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ChatWaveform(
                  peaks: _peaks,
                  progress: fraction,
                  activeColor: color,
                  idleColor: color.withValues(alpha: 0.28),
                  height: 30,
                  onScrub: (f) => setState(() => _scrub = f),
                  onSeek: _seekTo,
                ),
                const SizedBox(height: 2),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    _total > Duration.zero ? '${_clock(shown)} / ${_clock(_total)}' : _clock(shown),
                    style: ChatTheme.caption.copyWith(color: color, fontSize: 10),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}
