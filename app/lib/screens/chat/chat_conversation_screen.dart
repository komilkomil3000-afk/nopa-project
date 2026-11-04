import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'dart:io' as io;
import 'package:nopa_app/widgets/bottom_nav_bar.dart';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_format.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
import 'package:nopa_app/screens/chat/chat_message_menu.dart';
import 'package:nopa_app/screens/chat/chat_profile_screen.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:nopa_app/screens/chat/chat_voice_composer.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/screens/shell/app_shell.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/services/local_cache.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

/// A conversation, or with [threadRoot] the replies under one message.
class ChatConversationScreen extends StatefulWidget {
  final String spaceId;
  final ChatMessage? threadRoot;

  const ChatConversationScreen({super.key, required this.spaceId, this.threadRoot});

  @override
  State<ChatConversationScreen> createState() => _ChatConversationScreenState();
}

class _ChatConversationScreenState extends State<ChatConversationScreen> {
  final ChatRepository _chat = ChatRepository.instance;
  final ScrollController _scroll = ScrollController();
  final FocusNode _focus = FocusNode();
  late final DraftTextController _input = DraftTextController(draftKey: 'chat-${widget.spaceId}-${widget.threadRoot?.id ?? ''}');

  ChatMessage? _replyTo;
  ChatMessage? _editing;
  bool _loadingOlder = false;
  bool _reachedStart = false;
  bool _uploading = false;
  /// The composer shows the voice recorder (record, then review and send) instead of the text row.
  bool _voiceMode = false;
  bool _emojiOpen = false;
  bool _menuOpen = false;
  List<Map<String, dynamic>> _people = [];
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _cases = [];
  List<Map<String, dynamic>> _mentionMatches = [];
  final Set<String> _mentions = {};

  String? get _threadId => widget.threadRoot?.id;

  @override
  void initState() {
    super.initState();
    _chat.watch(widget.spaceId, threadRootId: _threadId);
    _chat.open(widget.spaceId, threadRootId: _threadId).then((_) => _chat.markRead(widget.spaceId));
    _chat.people(widget.spaceId).then((people) {
      if (mounted) setState(() => _people = people);
    });
    final space = _chat.spaceById(widget.spaceId);
    if (space != null && !space.isPrivate) {
      _chat.spaceProfile(widget.spaceId).then((profile) {
        if (mounted) setState(() => _profile = profile);
      });
    }
    _scroll.addListener(_onScroll);
    _input.addListener(_onTyping);
    _focus.addListener(() {
      if (_focus.hasFocus && _emojiOpen) setState(() => _emojiOpen = false);
    });
    _chat.addListener(_markReadWhileOpen);
    _chat.commandResult.addListener(_showCommandResult);
    _loadCases();
  }

  @override
  void dispose() {
    dismissChatMessageMenu();
    _chat.unwatch(widget.spaceId, threadRootId: _threadId);
    _chat.removeListener(_markReadWhileOpen);
    _chat.commandResult.removeListener(_showCommandResult);
    _scroll.dispose();
    _input.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _showCommandResult() {
    final text = _chat.commandResult.value;
    if (text == null || !mounted) return;
    _chat.commandResult.value = null;
    AppToast.info(context, text);
  }

  Future<void> _loadCases() async {
    final space = _chat.spaceById(widget.spaceId);
    if (space?.type != 'support') return;
    final res = await _chat.api('GET', '/chat/support/cases');
    if (mounted && res.ok) setState(() => _cases = (res.data as List).map((c) => Map<String, dynamic>.from(c as Map)).toList());
  }

  Future<void> _rateCase(String id, int rating) async {
    final res = await _chat.api('POST', '/chat/support/cases/$id/rate', body: {'rating': rating});
    if (!mounted) return;
    if (res.ok) {
      AppToast.success(context, 'از امتیاز شما سپاسگزاریم.');
      _loadCases();
    }
  }

  void _openInfo(ChatMessage card, ChatSpace? space) {
    final recipientOwner = space?.isDirect == true && Provider.of<AppRepository>(context, listen: false).currentUser.role.isMentorLike;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatTopicInfoScreen(card: card, moderator: space?.canModerate == true || recipientOwner, spaceId: widget.spaceId)));
  }

  void _openChallenge(ChatMessage card) {
    final meta = card.meta ?? const {};
    challengeFocusRequest.value = (category: challengeCategoryIndex(meta['category']?.toString().replaceAll('intra_group', 'group')), id: meta['challengeId']?.toString() ?? '');
    Navigator.of(context).popUntil((route) => route.isFirst);
    navigateToMainTab(AppTabs.challenges);
  }

  /// The profile behind the header: the other person in a private chat, otherwise the group or channel.
  void _openProfile(ChatSpace? space) {
    if (space == null || space.type == 'support') return;
    final screen = space.isDirect && space.peerId != null
        ? ChatMemberProfileScreen(spaceId: space.id, userId: space.peerId!)
        : ChatSpaceProfileScreen(spaceId: space.id);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  void _openMember(String? userId) {
    if (userId == null) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatMemberProfileScreen(spaceId: widget.spaceId, userId: userId)));
  }

  void _markReadWhileOpen() {
    final space = _chat.spaceById(widget.spaceId);
    if (space != null && space.unread > 0 && mounted) _chat.markRead(widget.spaceId);
  }

  // The list is reversed, so its far end is the oldest message
  Future<void> _onScroll() async {
    if (_loadingOlder || _reachedStart || _scroll.position.extentAfter > 200) return;
    _loadingOlder = true;
    final more = await _chat.loadOlder(widget.spaceId, threadRootId: _threadId);
    _loadingOlder = false;
    if (!more) _reachedStart = true;
  }

  void _onTyping() {
    final text = _input.text;
    if (text.isNotEmpty) _chat.sendTyping(widget.spaceId);
    final match = RegExp(r'(?:^|\s)@([^\s@]*)$').firstMatch(text);
    final query = match?.group(1);
    final matches = query == null
        ? <Map<String, dynamic>>[]
        : _people.where((u) => (u['name'] ?? '').toString().contains(query)).take(5).toList();
    if (matches.length != _mentionMatches.length || query != null) setState(() => _mentionMatches = matches);
  }

  void _pickMention(Map<String, dynamic> person) {
    final name = (person['name'] ?? '').toString();
    _input.text = _input.text.replaceFirst(RegExp(r'@[^\s@]*$'), '@$name ');
    _input.selection = TextSelection.collapsed(offset: _input.text.length);
    _mentions.add(person['id']);
    setState(() => _mentionMatches = []);
  }

  /// The emoji panel takes the keyboard's place, and the keyboard the panel's.
  void _toggleEmoji() {
    if (_emojiOpen) {
      setState(() => _emojiOpen = false);
      _focus.requestFocus();
    } else {
      _focus.unfocus();
      setState(() => _emojiOpen = true);
    }
  }

  void _insertEmoji(String emoji) {
    final value = _input.value;
    final start = value.selection.isValid ? value.selection.start : value.text.length;
    final end = value.selection.isValid ? value.selection.end : value.text.length;
    final text = value.text.replaceRange(start, end, emoji);
    _input.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: start + emoji.length));
  }

  Map<String, dynamic> _me() {
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    return {'id': user.id, 'name': user.name, 'avatarUrl': user.avatarUrl, 'gender': user.gender};
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;

    if (_editing != null) {
      final ok = await _chat.edit(_editing!, text);
      if (!mounted) return;
      if (!ok) AppToast.error(context, 'ویرایش پیام انجام نشد.');
      setState(() => _editing = null);
      _input.clear();
      return;
    }

    final replyTo = _replyTo;
    final mentions = _mentions.toList();
    _input.clear();
    _mentions.clear();
    setState(() => _replyTo = null);
    await _chat.send(spaceId: widget.spaceId, sender: _me(), body: text, threadRootId: _threadId, replyTo: replyTo, mentions: mentions);
  }

  /// A photo goes at a sensible size. If that fails the original is sent.
  Future<io.File> _shrink(io.File file) async {
    if (!RegExp(r'\.(jpe?g|png|webp)$', caseSensitive: false).hasMatch(file.path)) return file;
    try {
      final dir = await getTemporaryDirectory();
      final target = p.join(dir.path, 'chat-${DateTime.now().millisecondsSinceEpoch}.jpg');
      final bytes = await compute(_shrinkBytes, await file.readAsBytes());
      if (bytes == null) return file;
      return await io.File(target).writeAsBytes(bytes);
    } catch (e) {
      return file;
    }
  }

  /// Pure Dart (no native plugin): decode, fit within 1600px, re-encode as JPEG.
  static List<int>? _shrinkBytes(Uint8List input) {
    final decoded = img.decodeImage(input);
    if (decoded == null) return null;
    final longest = decoded.width > decoded.height ? decoded.width : decoded.height;
    final resized = longest > 1600
        ? img.copyResize(decoded, width: decoded.width >= decoded.height ? 1600 : null, height: decoded.height > decoded.width ? 1600 : null)
        : decoded;
    return img.encodeJpg(resized, quality: 80);
  }

  /// The most a file (photo, video or any other) may weigh to be sent in chat.
  static const int _maxFileBytes = 30 * 1024 * 1024;

  Future<void> _sendFile(io.File original) async {
    // Too big: say so at once instead of uploading for minutes and failing
    final size = await original.length();
    if (!mounted) return;
    if (size > _maxFileBytes) {
      final mb = (size / (1024 * 1024)).toStringAsFixed(1);
      AppToast.error(context, 'حجم این فایل $mb مگابایت است؛ حداکثر حجم مجاز برای ارسال ۳۰ مگابایت است.');
      return;
    }
    setState(() => _uploading = true);
    final file = await _shrink(original);
    final attachment = await _chat.upload(file, widget.spaceId);
    if (!mounted) return;
    setState(() => _uploading = false);
    if (attachment == null) {
      AppToast.error(context, 'ارسال فایل انجام نشد. نوع و حجم فایل (حداکثر ۳۰ مگابایت) را بررسی کنید.');
      return;
    }
    await _chat.send(spaceId: widget.spaceId, sender: _me(), threadRootId: _threadId, attachments: [attachment]);
  }

  Future<void> _pickFile() async {
    final picked = await FilePicker.platform.pickFiles();
    final path = picked?.files.single.path;
    if (path != null) await _sendFile(io.File(path));
  }

  /// Sends a voice message the user has reviewed: the clip, with the caption they typed (if any).
  /// Returns whether it went; the voice composer stays open on failure so nothing is lost.
  Future<bool> _sendVoice(io.File file, String caption) async {
    setState(() => _uploading = true);
    final attachment = await _chat.upload(file, widget.spaceId);
    if (!mounted) return false;
    setState(() => _uploading = false);
    if (attachment == null) {
      AppToast.error(context, 'ارسال فایل انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
      return false;
    }
    await _chat.send(spaceId: widget.spaceId, sender: _me(), body: caption.trim(), threadRootId: _threadId, attachments: [attachment]);
    if (mounted) setState(() => _voiceMode = false);
    return true;
  }

  void _openThread(ChatMessage message) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: widget.spaceId, threadRoot: message)));
  }

  bool _canWrite(ChatSpace? space) => !_threadIsClosed && (_threadId != null ? space?.canReply != false : space?.canPost != false);

  /// A tap on a message opens its reactions and choices next to it.
  Future<void> _showActions(ChatMessage message, ChatSpace? space, bool mine, Rect anchor, {bool card = false}) async {
    final moderator = space?.canModerate == true;
    final items = <ChatMenuItem>[
      if (_canWrite(space)) const ChatMenuItem('reply', Icons.reply_rounded, 'پاسخ'),
      if (_threadId == null && message.threadOpen && _threadAllowed(message, space)) const ChatMenuItem('thread', Icons.forum_rounded, 'ورود به گفتگو'),
      // Only mentors, admins and channel managers open a conversation under a message, never in a private chat
      if (_threadId == null && moderator && !message.threadOpen && space?.isPrivate != true) const ChatMenuItem('openThread', Icons.add_comment_rounded, 'باز کردن گفتگو زیر این پیام'),
      if (message.kind == 'challenge') ...[
        const ChatMenuItem('info', Icons.info_outline_rounded, 'اطلاعات و ارزیابی چالش'),
        const ChatMenuItem('challenge', Icons.local_fire_department_rounded, 'جزئیات چالش'),
      ],
      if (message.body.isNotEmpty) const ChatMenuItem('copy', Icons.copy_rounded, 'کپی متن'),
      if (mine && message.body.isNotEmpty && !_threadIsClosed && !card) const ChatMenuItem('edit', Icons.edit_rounded, 'ویرایش'),
      // A mentor decides where the mentor's badge appears: on their own messages, by choice
      if (mine && !message.deleted && Provider.of<AppRepository>(context, listen: false).currentUser.role.isMentorLike)
        ChatMenuItem('mentorMark', Icons.verified_rounded, message.mentorMark ? 'برداشتن نشان راهبر' : 'نشان راهبر'),
      if (moderator) ChatMenuItem('pin', Icons.push_pin_rounded, message.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'),
      if (moderator && !mine && message.senderId != null) const ChatMenuItem('mute', Icons.voice_over_off_rounded, 'بی‌صدا تا یک ساعت'),
      if (space?.canTag == true) ...[
        const ChatMenuItem('tag', Icons.label_rounded, 'برچسب'),
        if (_threadId != null) ...[
          const ChatMenuItem('best', Icons.workspace_premium_rounded, 'بهترین پاسخ'),
          const ChatMenuItem('evidence', Icons.verified_rounded, 'شاهد امتیاز'),
          if (widget.threadRoot?.topicId != null) const ChatMenuItem('final', Icons.task_alt_rounded, 'پاسخ نهایی گروه'),
        ],
      ],
      if (!mine && space?.isDirect != true) const ChatMenuItem('report', Icons.flag_rounded, 'گزارش تخلف', danger: true),
      if ((mine && !_threadIsClosed) || moderator) const ChatMenuItem('delete', Icons.delete_rounded, 'حذف', danger: true),
    ];
    final myId = Provider.of<AppRepository>(context, listen: false).currentUser.id;
    setState(() => _menuOpen = true);
    final action = await showChatMessageMenu(
      context,
      anchor: anchor,
      alignRight: mine || card,
      items: items,
      showReactions: !message.deleted,
      showStar: !message.deleted && moderator,
      myReactions: {for (final r in message.reactions) if (r['userId'] == myId) r['type'] as String},
    );
    if (!mounted) return;
    setState(() => _menuOpen = false);
    if (action == null) return;

    if (action.startsWith('react:')) {
      final ok = await _chat.react(message, action.substring(6));
      if (!ok && mounted) AppToast.error(context, 'ثبت واکنش انجام نشد.');
    } else if (action == 'reply') {
      setState(() => _replyTo = message);
      _focus.requestFocus();
    } else if (action == 'openThread') {
      final ok = await _chat.mark(message, 'thread');
      if (mounted) ok ? AppToast.success(context, 'گفتگو زیر این پیام باز شد.') : AppToast.error(context, 'باز کردن گفتگو انجام نشد.');
    } else if (action == 'info') {
      _openInfo(message, space);
    } else if (action == 'challenge') {
      _openChallenge(message);
    } else if (action == 'thread') {
      _openThread(message);
    } else if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: message.body));
      if (mounted) AppToast.success(context, 'متن کپی شد.');
    } else if (action == 'edit') {
      setState(() => _editing = message);
      _input.text = message.body;
      _focus.requestFocus();
    } else if (action == 'pin') {
      await _chat.togglePin(message);
    } else if (action == 'delete') {
      await _chat.delete(message);
    } else if (action == 'mentorMark') {
      final ok = await _chat.mark(message, 'mentor');
      if (!ok && mounted) AppToast.error(context, 'ثبت نشان انجام نشد.');
    } else if (action == 'best' || action == 'evidence') {
      await _chat.mark(message, action);
      if (mounted) AppToast.success(context, 'ثبت شد.');
    } else if (action == 'report') {
      await _chat.report(message, 'گزارش کاربر');
      if (mounted) AppToast.success(context, 'گزارش شما ثبت شد.');
    } else if (action == 'tag') {
      await _chooseTag(message);
    } else if (action == 'mute') {
      final res = await _chat.api('POST', '/chat/spaces/${widget.spaceId}/members/${message.senderId}/mute', body: {'minutes': 60});
      if (mounted) res.ok ? AppToast.success(context, 'این عضو تا یک ساعت پیام نمی‌فرستد.') : AppToast.error(context, res.error);
    } else if (action == 'final') {
      final res = await _chat.api('POST', '/chat/topics/${widget.threadRoot!.topicId}/final-answer', body: {'messageId': message.id});
      if (mounted) res.ok ? AppToast.success(context, 'پاسخ نهایی ثبت شد.') : AppToast.error(context, res.error);
    }
  }

  /// Tag a message, or with no message show what carries a tag.
  Future<void> _chooseTag(ChatMessage? message) async {
    final tags = await _chat.tags(widget.spaceId);
    if (!mounted) return;
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(12),
          children: [
            if (tags.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('هنوز تگی ساخته نشده است.', style: ChatTheme.caption, textAlign: TextAlign.center)),
            for (final tag in tags)
              ListTile(
                leading: CircleAvatar(radius: 7, backgroundColor: ChatChip.parse(tag['color'] ?? '#9292E2')),
                title: Text(tag['name'] ?? '', style: ChatTheme.body),
                onTap: () => Navigator.pop(ctx, tag),
              ),
            if (_chat.spaceById(widget.spaceId)?.canTag == true)
              ListTile(
                leading: const Icon(Icons.add_rounded, color: ChatTheme.accent),
                title: Text('تگ جدید', style: ChatTheme.body.copyWith(color: ChatTheme.accent)),
                onTap: () => Navigator.pop(ctx, const {'new': true}),
              ),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;
    if (picked['new'] == true) {
      await _createTag();
    } else if (message != null) {
      await _chat.toggleTag(message, picked['id']);
    } else {
      await _showList('پیام‌های «${picked['name']}»', () => _chat.taggedMessages(widget.spaceId, picked['id'], threadRootId: _threadId));
    }
  }

  static const List<String> _tagColors = ['#DFB690', '#9292E2', '#EC4899', '#10B981', '#F97316', '#3B82F6', '#EAB308', '#8B5CF6', '#EF4444', '#14B8A6', '#F472B6', '#A3E635'];

  Future<void> _createTag() async {
    final name = TextEditingController();
    String color = _tagColors.first;
    bool staffOnly = false;
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: StatefulBuilder(
          builder: (ctx, setDialog) => AlertDialog(
            backgroundColor: ChatTheme.surfaceBottom,
            shape: ChatTheme.dialogShape,
            title: Text('تگ جدید', style: ChatTheme.title),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: name, maxLength: 30, style: ChatTheme.body, decoration: chatField('نام تگ')),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final c in _tagColors)
                    GestureDetector(
                      onTap: () => setDialog(() => color = c),
                      child: CircleAvatar(radius: c == color ? 15 : 12, backgroundColor: ChatChip.parse(c), child: c == color ? const Icon(Icons.check_rounded, size: 15, color: ChatTheme.surfaceBottom) : null),
                    ),
                ]),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: staffOnly,
                  activeColor: ChatTheme.accent,
                  title: Text('فقط راهبران ببینند', style: ChatTheme.caption),
                  onChanged: (v) => setDialog(() => staffOnly = v == true),
                ),
              ],
            ),
            actions: [ChatButton(label: 'ساختن', onPressed: () => Navigator.pop(ctx, true))],
          ),
        ),
      ),
    );
    if (ok == true) {
      final res = await _chat.api('POST', '/chat/spaces/${widget.spaceId}/tags', body: {'name': name.text, 'color': color, 'visibility': staffOnly ? 'staff' : 'public'});
      if (mounted) res.ok ? AppToast.success(context, 'تگ ساخته شد.') : AppToast.error(context, res.error);
    }  }

  /// What was said in one station of this conversation.
  Future<void> _chooseStation() async {
    final res = await _chat.api('GET', '/chat/spaces/${widget.spaceId}/stations');
    if (!mounted || !res.ok) return;
    final stations = (res.data as List).map((s) => Map<String, dynamic>.from(s as Map)).toList();
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(12),
          children: [
            if (stations.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('هنوز پیامی به منزلگاهی وصل نشده است.', style: ChatTheme.caption, textAlign: TextAlign.center)),
            for (final station in stations) ListTile(title: Text(station['title'] ?? '', style: ChatTheme.body), onTap: () => Navigator.pop(ctx, station)),
          ],
        ),
      ),
    );
    if (picked != null) await _showList(picked['title'] ?? '', () => _chat.stationMessages(widget.spaceId, picked['id']));
  }

  Future<void> _showList(String title, Future<List<ChatMessage>> Function() load) async {
    final messages = await load();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.6),
          child: messages.isEmpty
              ? Padding(padding: const EdgeInsets.all(32), child: Text('موردی یافت نشد.', style: ChatTheme.caption, textAlign: TextAlign.center))
              : ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(title, style: ChatTheme.title),
                    const SizedBox(height: 10),
                    for (final m in messages)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.senderName, style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
                            Text(m.body.isEmpty ? 'فایل' : m.body, style: ChatTheme.body),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }

  Future<void> _search() async {
    final controller = TextEditingController();
    final query = await showNopaDialog<String>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('جستجو در گفتگو', style: ChatTheme.title),
          content: TextField(controller: controller, autofocus: true, style: ChatTheme.body, decoration: chatField('عبارت مورد نظر، یا #برتر برای پیام‌های برتر'), onSubmitted: (v) => Navigator.pop(ctx, v)),
          actions: [ChatButton(label: 'جستجو', onPressed: () => Navigator.pop(ctx, controller.text))],
        ),
      ),
    );    if (query != null && query.trim().length >= 2) {
      await _showList('نتایج جستجو', () => _chat.search(widget.spaceId, query.trim()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final myId = Provider.of<AppRepository>(context, listen: false).currentUser.id;
    return PopScope(
      canPop: !_emojiOpen && !_menuOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_menuOpen) {
          dismissChatMessageMenu();
        } else if (_emojiOpen) {
          setState(() => _emojiOpen = false);
        }
      },
      child: Container(
        // The app's own background, so chat reads as part of it
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(image: AssetImage('assets/images/login_bg.png'), fit: BoxFit.cover),
        ),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          // The composer rides on top of the keyboard
          resizeToAvoidBottomInset: true,
          body: Directionality(
            textDirection: TextDirection.rtl,
            child: ListenableBuilder(
              listenable: _chat,
              builder: (context, _) {
                final space = _chat.spaceById(widget.spaceId);
                final messages = _chat.messagesOf(widget.spaceId, threadRootId: _threadId);
                final threadClosed = widget.threadRoot?.topicId != null && _rootStatus() != 'open';
                return Column(
                  children: [
                    _header(space),
                    Expanded(
                      child: Stack(
                        children: [
                          Column(
                            children: [
                              // With the keyboard open the conversation needs every pixel
                              // The challenge brief stays in view; a plain thread's origin gives way to the keyboard
              if (widget.threadRoot != null && (widget.threadRoot!.kind == 'challenge' || MediaQuery.viewInsetsOf(context).bottom == 0)) _threadOrigin(),
                              if (space?.type == 'support') _caseBar(),
                              Expanded(child: _list(messages, space, myId)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    _canWrite(space) ? _composer() : _readOnlyBar(threadClosed),
                    if (_emojiOpen) _emojiPanel(),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  bool get _threadIsClosed => widget.threadRoot?.topicId != null && _rootStatus() != 'open';

  String? _rootStatus() {
    for (final m in _chat.messagesOf(widget.spaceId)) {
      if (m.id == _threadId) return m.topicStatus;
    }
    return widget.threadRoot?.topicStatus;
  }

  Widget _caseBar() {
    if (_cases.isEmpty) return const SizedBox.shrink();
    final current = _cases.first;
    final status = const {'open': 'باز', 'reviewing': 'در بررسی', 'resolved': 'حل‌شده'}[current['status']] ?? '';
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      padding: const EdgeInsets.all(10),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${current['subject']} · $status', style: ChatTheme.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
          if (current['status'] == 'resolved' && current['rating'] == null)
            Row(children: [
              Text('به این پاسخ امتیاز بدهید: ', style: ChatTheme.caption),
              for (var i = 1; i <= 5; i++)
                GestureDetector(onTap: () => _rateCase(current['id'], i), child: const Icon(Icons.star_rounded, size: 22, color: ChatTheme.accent)),
            ]),
        ],
      ),
    );
  }

  /// The line under the title: typing, online or not, or how many people are here.
  String _status(ChatSpace? space) {
    final typing = _chat.typingIn(widget.spaceId);
    if (typing != null) return space?.isDirect == true ? 'در حال نوشتن...' : '$typing در حال نوشتن...';
    if (space == null) return '';
    if (_threadId != null) return space.title;
    if (space.type == 'support') return 'پشتیبانی نپا';
    if (space.isDirect) return space.peerOnline || (space.peerId != null && _chat.isOnline(space.peerId!)) ? 'آنلاین' : 'آفلاین';
    final members = _people.isNotEmpty ? _people.length : (_profile?['memberCount'] as num?)?.toInt();
    if (members == null) return '';
    final online = _people.isNotEmpty ? _people.where((p) => _chat.isOnline(p['id'] ?? '')).length : (_profile?['onlineCount'] as num?)?.toInt() ?? 0;
    final noun = space.isChannel ? 'عضو' : 'همسفر';
    return online > 0 ? '$members $noun · $online آنلاین' : '$members $noun';
  }

  /// Golden header: face, name and status on the right (a tap opens the profile), tools and back on the left.
  Widget _header(ChatSpace? space) {
    final thread = _threadId != null;
    final challengeThread = thread && widget.threadRoot?.kind == 'challenge';
    final title = thread ? (challengeThread ? 'گفتگوی چالش' : 'گفتگوی زیر پیام') : (space?.title ?? '');
    final online = space?.isDirect == true && space!.peerOnline;
    final avatar = thread
        ? const ChatIconAvatar(icon: Icons.forum_rounded, radius: 21)
        : (space == null ? const ChatIconAvatar(icon: Icons.chat_rounded, radius: 21) : ChatSpaceAvatar(space: space, radius: 21));
    return ChatGoldHeader(
      actions: [
        if (!thread) ...[
          IconButton(onPressed: _search, tooltip: 'جستجو', icon: const Icon(Icons.search_rounded, color: ChatTheme.ink, size: 23)),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: ChatTheme.ink),
            color: ChatTheme.paper,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            onSelected: (value) {
              switch (value) {
                case 'profile':
                  _openProfile(space);
                case 'tags':
                  _chooseTag(null);
                case 'stations':
                  _chooseStation();
                case 'pins':
                  _showList('پیام‌های سنجاق‌شده', () => _chat.pins(widget.spaceId));
                case 'mute':
                  if (space != null) _chat.setMuted(space, !space.muted);
              }
            },
            itemBuilder: (_) => [
              if (space != null && space.type != 'support') _menuItem('profile', Icons.info_outline_rounded, space.isDirect ? 'پروفایل مخاطب' : 'اطلاعات و اعضا'),
              _menuItem('pins', Icons.push_pin_rounded, 'پیام‌های سنجاق‌شده'),
              _menuItem('tags', Icons.label_rounded, 'پیام‌های برچسب‌دار'),
              _menuItem('stations', Icons.flag_rounded, 'پیام‌های هر منزلگاه'),
              if (space != null)
                _menuItem('mute', space.muted ? Icons.notifications_rounded : Icons.notifications_off_rounded, space.muted ? 'روشن کردن اعلان' : 'بی‌صدا کردن گفتگو'),
            ],
          ),
        ],
      ],
      child: ChatHeaderTitle(
        avatar: ChatRing(online: online, child: avatar),
        title: title,
        subtitle: _status(space),
        // In a challenge's conversation the header leads to the challenge's info and evaluation:
        // participations, closing the challenge and applying the points
        onTap: thread
            ? (widget.threadRoot?.kind == 'challenge' ? () => _openInfo(widget.threadRoot!, space) : null)
            : () => _openProfile(space),
      ),
    );
  }

  PopupMenuItem<String> _menuItem(String value, IconData icon, String label) => PopupMenuItem(
        value: value,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Row(children: [
            Icon(icon, color: ChatTheme.ink.withValues(alpha: 0.75), size: 18),
            const SizedBox(width: 10),
            Text(label, style: AppTypography.h3.copyWith(color: ChatTheme.ink)),
          ]),
        ),
      );

  /// The top of a thread. For a challenge it carries the whole brief, not just the title.
  Widget _threadOrigin() {
    final root = widget.threadRoot!;
    final meta = root.meta ?? const {};
    final isChallenge = root.kind == 'challenge';
    final title = meta['title']?.toString() ?? (root.body.isEmpty ? 'فایل' : root.body);
    final description = (meta['description'] ?? '').toString().trim();
    final status = _rootStatus() ?? root.topicStatus ?? 'open';
    final facts = <String>[
      if (isChallenge && (meta['stationTitle'] ?? '').toString().isNotEmpty) 'منزلگاه: ${meta['stationTitle']}',
      if (isChallenge && (meta['creatorName'] ?? '').toString().isNotEmpty) 'سازنده: ${meta['creatorName']}',
      if (isChallenge && meta['startDate'] != null) 'شروع: ${chatDateText(meta['startDate'])}',
      if (isChallenge && meta['dueDate'] != null) 'مهلت: ${chatDateText(meta['dueDate'])}',
      if (isChallenge && meta['reward'] != null) 'جایزه: ${meta['reward']}',
    ];
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.34),
      margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 10, ChatTheme.gutter, 4),
      padding: const EdgeInsets.all(10),
      decoration: ChatTheme.card(highlighted: true),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(meta['tag']?.toString() ?? root.senderName, style: ChatTheme.caption.copyWith(color: ChatTheme.accent))),
              if (isChallenge) ChatChip(label: topicStatusLabels[status] ?? status, color: status == 'open' ? ChatTheme.accent : ChatTheme.text),
            ]),
            const SizedBox(height: 2),
            Text(title, style: ChatTheme.title.copyWith(fontSize: 15)),
            if (description.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(description, style: ChatTheme.body)),
            for (final f in facts) Padding(padding: const EdgeInsets.only(top: 3), child: Text(f, style: ChatTheme.caption)),
          ],
        ),
      ),
    );
  }

  /// Cards (challenges, polls) open the same menu as bubbles, from wherever they were tapped.
  Widget _tappableCard(ChatMessage message, ChatSpace? space, Widget child) => Builder(
        key: ValueKey(message.id),
        builder: (ctx) => GestureDetector(
          onTap: () {
            final box = ctx.findRenderObject() as RenderBox?;
            if (box != null) _showActions(message, space, false, box.localToGlobal(Offset.zero) & box.size, card: true);
          },
          child: child,
        ),
      );

  ChatBubbleStyle _styleOf(ChatSpace? space) {
    if (space == null) return ChatBubbleStyle.group;
    if (space.isPrivate) return ChatBubbleStyle.private;
    // The comments under a channel post are a conversation of their own
    if (space.isChannel && _threadId == null) return ChatBubbleStyle.channel;
    return ChatBubbleStyle.group;
  }

  // Challenges read as messages now; only these stay as cards
  static bool _isCard(ChatMessage m) => !m.deleted && const {'station', 'result', 'poll'}.contains(m.kind);

  /// Conversations under messages live in groups and channels; in a private chat only a personal challenge has one.
  bool _threadAllowed(ChatMessage message, ChatSpace? space) => space?.isPrivate != true || message.topicId != null;

  /// Mentors and staff here, whose reactions wear the mentor's badge.
  Set<String> get _staffIds {
    final space = _chat.spaceById(widget.spaceId);
    final me = Provider.of<AppRepository>(context, listen: false).currentUser;
    return {
      for (final p in _people)
        if (const {'mentor', 'admin', 'sub_admin', 'channel_manager'}.contains(p['role'])) p['id'] as String,
      // The list of people may not have arrived yet, or leave out the other side of a private chat
      if (space?.peerIsMentor == true && space?.peerId != null) space!.peerId!,
      if (me.role.isMentorLike) me.id,
      for (final m in _chat.messagesOf(widget.spaceId, threadRootId: _threadId))
        if (m.senderIsMentor && m.senderId != null) m.senderId!,
    };
  }

  Set<String> get _mentionNames => {for (final p in _people) (p['name'] ?? '').toString()};

  Widget _list(List<ChatMessage> messages, ChatSpace? space, String myId) {
    if (messages.isEmpty) {
      return Center(child: Text('هنوز پیامی ارسال نشده است.', style: ChatTheme.caption.copyWith(fontSize: 13)));
    }
    // A deleted message leaves no trace in the conversation
    messages = messages.where((m) => !m.deleted).toList();
    final style = _styleOf(space);
    return ListView.builder(
      controller: _scroll,
      reverse: true,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(ChatTheme.gutter, 12, ChatTheme.gutter, 12),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[messages.length - 1 - index];
        final older = index + 1 < messages.length ? messages[messages.length - 2 - index] : null;
        final newer = index > 0 ? messages[messages.length - index] : null;
        final mine = message.senderId == myId;
        if (message.kind == 'station' && !message.deleted) return StationCard(key: ValueKey(message.id), message: message);
        if (message.kind == 'result' && !message.deleted) return ResultCard(key: ValueKey(message.id), message: message);
        if (message.kind == 'poll' && !message.deleted) {
          return _tappableCard(message, space, PollCard(message: message, myId: myId, onVote: (o) => _chat.vote(message, o)));
        }
        // A run is a sender's consecutive messages: the name goes over its first, the face and tail under its last
        final startsRun = older == null || older.senderId != message.senderId || _isCard(older);
        final endsRun = newer == null || newer.senderId != message.senderId || _isCard(newer);
        return ChatMessageBubble(
          key: ValueKey(message.clientMessageId ?? message.id),
          message: message,
          mine: mine,
          style: style,
          myId: myId,
          staffTags: _chat.staffTagsOf(message.id),
          staffIds: _staffIds,
          mentionNames: _mentionNames,
          showSender: style == ChatBubbleStyle.channel ? message.senderId != null && startsRun : (style == ChatBubbleStyle.group && !mine && startsRun),
          showAvatar: endsRun,
          seen: space != null && space.isDirect && message.seq > 0 && message.seq <= space.peerReadSeq,
          onTap: (rect) => _showActions(message, space, mine, rect, card: style == ChatBubbleStyle.channel),
          onOpenThread: _threadId == null && _threadAllowed(message, space) ? () => _openThread(message) : null,
          onOpenSender: message.senderId == null ? null : () => _openMember(message.senderId),
          onRetry: () => _chat.retry(message),
          onReact: (type) {
            if (message.deleted) return;
            // Only mentors can take the star back; for everyone else its chip is just a count
            if (type == ChatTheme.starReaction && space?.canModerate != true) return;
            _chat.react(message, type);
          },
        );
      },
    );
  }

  /// Where one cannot write: the same floating bar, in the colour of the app's general feedback.
  Widget _readOnlyBar(bool closed) {
    final space = _chat.spaceById(widget.spaceId);
    final text = closed
        ? 'این چالش بسته شده است.'
        : (space?.canReply == false
            ? 'این میدان مخصوص راهبران است؛ گفتگوی شما در گروه چالش‌های کاروان انجام می‌شود.'
            : (space?.isChannel == true
                ? 'این کانال فقط خواندنی است؛ زیر پست‌هایی که گفتگو دارند، «ورود به گفتگو» را بزنید.'
                : 'برای گفتگو، روی «ورود به گفتگو» زیر هر چالش یا پیام بزنید.'));
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 6, ChatTheme.gutter, 0),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: ChatTheme.feedback,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: ChatTheme.stroke.withValues(alpha: 0.6)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Row(children: [
          Icon(closed ? Icons.lock_rounded : Icons.info_outline_rounded, size: 18, color: ChatTheme.feedbackText.withValues(alpha: 0.8)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: AppTypography.bodyMedium.copyWith(color: ChatTheme.feedbackText))),
        ]),
      ),
    );
  }

  /// Selected text gets bold, italic and mention next to the usual copy, cut, paste and select-all.
  Widget _selectionMenu(BuildContext context, EditableTextState state) {
    final items = [...state.contextMenuButtonItems];
    if (!state.textEditingValue.selection.isCollapsed) {
      items.addAll([
        ContextMenuButtonItem(
          label: 'بولد',
          onPressed: () {
            _input.value = ChatFormat.toggle(_input.value, ChatFormat.bold);
            state.hideToolbar();
          },
        ),
        ContextMenuButtonItem(
          label: 'ایتالیک',
          onPressed: () {
            _input.value = ChatFormat.toggle(_input.value, ChatFormat.italic);
            state.hideToolbar();
          },
        ),
        if (_people.isNotEmpty)
          ContextMenuButtonItem(
            label: 'منشن',
            onPressed: () {
              state.hideToolbar();
              _mentionSelection();
            },
          ),
      ]);
    }
    return AdaptiveTextSelectionToolbar.buttonItems(anchors: state.contextMenuAnchors, buttonItems: items);
  }

  /// Puts a person's name, as a mention, in place of the selected words.
  Future<void> _mentionSelection() async {
    final value = _input.value;
    final selected = value.selection.textInside(value.text).trim();
    final matches = _people.where((p) => selected.isEmpty || (p['name'] ?? '').toString().contains(selected)).toList();
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(vertical: 12),
            children: [
              for (final person in matches.isEmpty ? _people : matches)
                ListTile(
                  leading: const Icon(Icons.alternate_email_rounded, color: ChatTheme.accent),
                  title: Text(person['name'] ?? '', style: ChatTheme.body),
                  onTap: () => Navigator.pop(ctx, person),
                ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !mounted) return;
    final name = '@${picked['name'] ?? ''} ';
    final start = value.selection.start, end = value.selection.end;
    _input.value = TextEditingValue(
      text: value.text.replaceRange(start, end, name),
      selection: TextSelection.collapsed(offset: start + name.length),
    );
    _mentions.add(picked['id']);
    _focus.requestFocus();
  }

  /// Floating light bar, clear of the screen's edges and corners: voice and attach on the right turn into
  /// send while typing; emoji on the left.
  Widget _composer() {
    final context_ = _editing ?? _replyTo;
    final inkSoft = ChatTheme.ink.withValues(alpha: 0.7);
    final caption = AppTypography.bodyMedium.copyWith(color: inkSoft);
    return SafeArea(
      top: false,
      // The emoji panel under the bar already keeps clear of the system bar
      bottom: !_emojiOpen,
      minimum: const EdgeInsets.only(bottom: 10),
      child: Container(
        margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 6, ChatTheme.gutter, 0),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: ChatTheme.paper,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 4))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final person in _mentionMatches)
              InkWell(
                onTap: () => _pickMention(person),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  child: Row(children: [
                    Icon(Icons.alternate_email_rounded, size: 16, color: inkSoft),
                    const SizedBox(width: 8),
                    Text(person['name'] ?? '', style: caption.copyWith(color: ChatTheme.ink, fontSize: 13)),
                  ]),
                ),
              ),
            if (context_ != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 10, 8, 0),
                padding: const EdgeInsetsDirectional.only(start: 10),
                decoration: const BoxDecoration(border: BorderDirectional(start: BorderSide(color: AppColors.buttonCamel, width: 2))),
                child: Row(
                  children: [
                    Icon(_editing != null ? Icons.edit_rounded : Icons.reply_rounded, size: 15, color: AppColors.buttonCamel),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _editing != null ? 'ویرایش پیام' : 'پاسخ به ${context_.senderName}: ${context_.body.isEmpty ? 'فایل' : ChatFormat.plain(context_.body)}',
                        style: caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        if (_editing != null) _input.clear();
                        setState(() {
                          _editing = null;
                          _replyTo = null;
                        });
                      },
                      icon: Icon(Icons.close_rounded, size: 16, color: inkSoft),
                    ),
                  ],
                ),
              ),
            if (_voiceMode)
              ChatVoiceComposer(
                key: const ValueKey('voice-composer'),
                onSend: _sendVoice,
                onClose: () {
                  if (mounted) setState(() => _voiceMode = false);
                },
              )
            else
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 2, 4, 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _input,
                    builder: (context, value, _) {
                      final typing = value.text.trim().isNotEmpty || _editing != null;
                      return AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
                        child: typing
                            ? Padding(
                                key: const ValueKey('send'),
                                padding: const EdgeInsets.all(4),
                                child: Material(
                                  color: ChatTheme.accent,
                                  shape: const CircleBorder(),
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: _send,
                                    // The arrow points right, the way a message leaves in a right-to-left chat
                                    child: const SizedBox(
                                      width: 40,
                                      height: 40,
                                      child: Directionality(textDirection: TextDirection.ltr, child: Icon(Icons.send_rounded, color: ChatTheme.ink, size: 20)),
                                    ),
                                  ),
                                ),
                              )
                            : Row(
                                key: const ValueKey('tools'),
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    tooltip: 'پیام صوتی',
                                    onPressed: () => setState(() => _voiceMode = true),
                                    icon: Icon(Icons.mic_none_rounded, color: inkSoft, size: 25),
                                  ),
                                  IconButton(
                                    tooltip: 'پیوست',
                                    onPressed: _uploading ? null : _pickFile,
                                    icon: _uploading
                                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.buttonCamel))
                                        : Transform.rotate(angle: 0.6, child: Icon(Icons.attach_file_rounded, color: inkSoft, size: 24)),
                                  ),
                                ],
                              ),
                      );
                    },
                  ),
                  Expanded(
                    child: TextField(
                      controller: _input,
                      focusNode: _focus,
                      minLines: 1,
                      maxLines: 6,
                      maxLength: 4000,
                      cursorColor: AppColors.buttonCamel,
                      textInputAction: TextInputAction.newline,
                      contextMenuBuilder: _selectionMenu,
                      style: AppTypography.bodyLarge.copyWith(color: ChatTheme.ink),
                      decoration: InputDecoration(
                        counterText: '',
                        isDense: true,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.fromLTRB(8, 13, 8, 13),
                        hintText: 'پیام...',
                        hintStyle: caption.copyWith(fontSize: 13, color: ChatTheme.ink.withValues(alpha: 0.45)),
                      ),
                    ),
                  ),
                  Container(width: 1, height: 24, margin: const EdgeInsets.only(bottom: 12), color: ChatTheme.ink.withValues(alpha: 0.15)),
                  IconButton(
                    tooltip: _emojiOpen ? 'صفحه‌کلید' : 'ایموجی',
                    onPressed: _toggleEmoji,
                    icon: Icon(_emojiOpen ? Icons.keyboard_alt_rounded : Icons.emoji_emotions_rounded, color: inkSoft, size: 24),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static const List<String> _emojis = [
    '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🙂', '😉', '😇', '🤗', '🤔', '🤨',
    '😐', '😶', '🙄', '😏', '😮', '😴', '😌', '😛', '😜', '🤪', '😒', '😔', '😕', '🙃', '😲', '😢',
    '😭', '😤', '😠', '😡', '🤯', '😳', '🥺', '😱', '😨', '😰', '😓', '🤭', '🤫', '😬', '🥳', '🤓',
    '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '✌️', '👌', '🤞', '👋', '✋', '☝️', '👉', '👈', '🫡',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '💔', '💯', '✨', '🔥', '⭐', '🌟', '🎉', '🎯', '🏆',
    '📚', '📖', '✍️', '📝', '💡', '🧠', '⏰', '✅', '❌', '❓', '❗', '🌹', '🌙', '☀️', '🐪', '🏕️',
  ];

  Widget _emojiPanel() {
    return Container(
      height: 260 + MediaQuery.paddingOf(context).bottom,
      color: ChatTheme.surfaceBottom,
      padding: EdgeInsets.fromLTRB(ChatTheme.gutter - 8, 8, ChatTheme.gutter - 8, MediaQuery.paddingOf(context).bottom),
      child: GridView.count(
        crossAxisCount: 8,
        children: [
          for (final e in _emojis)
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => _insertEmoji(e),
              child: Center(child: Text(e, style: const TextStyle(fontSize: 24))),
            ),
        ],
      ),
    );
  }
}
