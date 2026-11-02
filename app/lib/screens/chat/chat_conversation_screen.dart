import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
import 'package:nopa_app/screens/chat/chat_message_menu.dart';
import 'package:nopa_app/screens/chat/chat_profile_screen.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
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
import 'package:record/record.dart';

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
  final AudioRecorder _recorder = AudioRecorder();
  final FocusNode _focus = FocusNode();
  late final DraftTextController _input = DraftTextController(draftKey: 'chat-${widget.spaceId}-${widget.threadRoot?.id ?? ''}');

  ChatMessage? _replyTo;
  ChatMessage? _editing;
  bool _loadingOlder = false;
  bool _reachedStart = false;
  bool _uploading = false;
  bool _recording = false;
  bool _emojiOpen = false;
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
    _chat.unwatch(widget.spaceId, threadRootId: _threadId);
    _chat.removeListener(_markReadWhileOpen);
    _chat.commandResult.removeListener(_showCommandResult);
    _scroll.dispose();
    _input.dispose();
    _focus.dispose();
    _recorder.dispose();
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
    navigateToMainTab(2);
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

  Future<void> _sendFile(io.File original) async {
    setState(() => _uploading = true);
    final file = await _shrink(original);
    final attachment = await _chat.upload(file, widget.spaceId);
    if (!mounted) return;
    setState(() => _uploading = false);
    if (attachment == null) {
      AppToast.error(context, 'ارسال فایل انجام نشد. نوع و حجم فایل (حداکثر ۲۰ مگابایت) را بررسی کنید.');
      return;
    }
    await _chat.send(spaceId: widget.spaceId, sender: _me(), threadRootId: _threadId, attachments: [attachment]);
  }

  Future<void> _pickFile() async {
    final picked = await FilePicker.platform.pickFiles();
    final path = picked?.files.single.path;
    if (path != null) await _sendFile(io.File(path));
  }

  Future<void> _toggleRecording() async {
    if (_recording) {
      final path = await _recorder.stop();
      setState(() => _recording = false);
      if (path != null) await _sendFile(io.File(path));
      return;
    }
    if (!await _recorder.hasPermission()) {
      if (mounted) AppToast.error(context, 'برای ضبط صدا، اجازه‌ی میکروفون لازم است.');
      return;
    }
    final dir = await getTemporaryDirectory();
    final path = p.join(dir.path, 'voice-${DateTime.now().millisecondsSinceEpoch}.m4a');
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 48000), path: path);
    setState(() => _recording = true);
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
      // Sessions under a message belong to groups and channels, not to a private chat
      if (_threadId == null && space?.isPrivate != true) const ChatMenuItem('thread', Icons.forum_rounded, 'ورود به گفتگوی زیر پیام'),
      if (message.body.isNotEmpty) const ChatMenuItem('copy', Icons.copy_rounded, 'کپی متن'),
      if (mine && message.body.isNotEmpty && !_threadIsClosed && !card) const ChatMenuItem('edit', Icons.edit_rounded, 'ویرایش'),
      if (moderator) ChatMenuItem('pin', Icons.push_pin_rounded, message.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'),
      if (!mine && message.senderId != null && space?.isPrivate != true) const ChatMenuItem('profile', Icons.person_rounded, 'پروفایل فرستنده'),
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
    final action = await showChatMessageMenu(
      context,
      anchor: anchor,
      alignRight: mine || card,
      items: items,
      myReactions: {for (final r in message.reactions) if (r['userId'] == myId) r['type'] as String},
    );
    if (action == null || !mounted) return;

    if (action.startsWith('react:')) {
      await _chat.react(message, action.substring(6));
    } else if (action == 'reply') {
      setState(() => _replyTo = message);
      _focus.requestFocus();
    } else if (action == 'thread') {
      _openThread(message);
    } else if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: message.body));
      if (mounted) AppToast.success(context, 'متن کپی شد.');
    } else if (action == 'edit') {
      setState(() => _editing = message);
      _input.text = message.body;
      _focus.requestFocus();
    } else if (action == 'profile') {
      _openMember(message.senderId);
    } else if (action == 'pin') {
      await _chat.togglePin(message);
    } else if (action == 'delete') {
      await _chat.delete(message);
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
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
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: StatefulBuilder(
          builder: (ctx, setDialog) => AlertDialog(
            backgroundColor: ChatTheme.surfaceBottom,
            title: Text('تگ جدید', style: ChatTheme.title),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: name, maxLength: 30, style: ChatTheme.body, decoration: chatField('نام تگ')),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final c in _tagColors)
                    GestureDetector(
                      onTap: () => setDialog(() => color = c),
                      child: CircleAvatar(radius: c == color ? 15 : 12, backgroundColor: ChatChip.parse(c), child: c == color ? const Icon(Icons.check, size: 15, color: ChatTheme.surfaceBottom) : null),
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
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
    final query = await showDialog<String>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          title: Text('جستجو در گفتگو', style: ChatTheme.title),
          content: TextField(controller: controller, autofocus: true, style: ChatTheme.body, onSubmitted: (v) => Navigator.pop(ctx, v)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: Text('جستجو', style: ChatTheme.body.copyWith(color: ChatTheme.accent))),
          ],
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
      canPop: !_emojiOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _emojiOpen) setState(() => _emojiOpen = false);
      },
      child: Container(
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
                          const Positioned.fill(child: _ChatWallpaper()),
                          Column(
                            children: [
                              // With the keyboard open the conversation needs every pixel
                              if (widget.threadRoot != null && MediaQuery.viewInsetsOf(context).bottom == 0) _threadOrigin(),
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
    final title = thread ? 'گفتگوی زیر پیام' : (space?.title ?? '');
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
        onTap: thread ? null : () => _openProfile(space),
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
            Text(label, style: const TextStyle(color: ChatTheme.ink, fontFamily: AppTheme.fontFamily, fontSize: 13, fontWeight: FontWeight.w600)),
          ]),
        ),
      );

  Widget _threadOrigin() {
    final root = widget.threadRoot!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 10, ChatTheme.gutter, 4),
      padding: const EdgeInsets.all(10),
      decoration: ChatTheme.card(highlighted: true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(root.meta?['tag']?.toString() ?? root.senderName, style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
          Text(root.meta?['title']?.toString() ?? (root.body.isEmpty ? 'فایل' : root.body), style: ChatTheme.body, maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
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

  static bool _isCard(ChatMessage m) => !m.deleted && const {'challenge', 'station', 'result', 'poll'}.contains(m.kind);

  Widget _list(List<ChatMessage> messages, ChatSpace? space, String myId) {
    if (messages.isEmpty) {
      return Center(child: Text('هنوز پیامی ارسال نشده است.', style: ChatTheme.caption.copyWith(fontSize: 13)));
    }
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
        if (message.kind == 'challenge' && !message.deleted && message.topicId != null) {
          return _tappableCard(
            message,
            space,
            ChallengeCard(
              message: message,
              onOpenThread: () => _openThread(message),
              onOpenInfo: () => _openInfo(message, space),
              onOpenChallenge: () => _openChallenge(message),
            ),
          );
        }
        if (message.kind == 'station' && !message.deleted) return StationCard(key: ValueKey(message.id), message: message);
        if (message.kind == 'result' && !message.deleted) return ResultCard(key: ValueKey(message.id), message: message);
        if (message.kind == 'poll' && !message.deleted) {
          return _tappableCard(message, space, PollCard(message: message, myId: myId, onVote: (o) => _chat.vote(message, o)));
        }
        // A run is a sender's consecutive messages: the name goes over its first, the face and tail under its last
        final startsRun = older == null || older.senderId != message.senderId || _isCard(older);
        final endsRun = newer == null || newer.senderId != message.senderId || _isCard(newer);
        final threadAllowed = _threadId == null && (space?.isPrivate != true || message.threadReplies > 0);
        return ChatMessageBubble(
          key: ValueKey(message.clientMessageId ?? message.id),
          message: message,
          mine: mine,
          style: style,
          myId: myId,
          staffTags: _chat.staffTagsOf(message.id),
          showSender: style == ChatBubbleStyle.channel ? message.senderId != null && startsRun : (style == ChatBubbleStyle.group && !mine && startsRun),
          showAvatar: endsRun,
          seen: space != null && space.isDirect && message.seq > 0 && message.seq <= space.peerReadSeq,
          onTap: (rect) => _showActions(message, space, mine, rect, card: style == ChatBubbleStyle.channel),
          onOpenThread: threadAllowed ? () => _openThread(message) : null,
          onOpenSender: message.senderId == null || mine ? null : () => _openMember(message.senderId),
          onRetry: () => _chat.retry(message),
          onReact: (type) => _chat.react(message, type),
        );
      },
    );
  }

  Widget _readOnlyBar(bool closed) => Container(
        width: double.infinity,
        color: ChatTheme.paper,
        padding: EdgeInsets.fromLTRB(ChatTheme.gutter, 14, ChatTheme.gutter, 14 + MediaQuery.paddingOf(context).bottom),
        child: Text(
          closed
              ? 'این چالش بسته شده است.'
              : (_chat.spaceById(widget.spaceId)?.canReply == false
                  ? 'این میدان فقط خواندنی است؛ گفتگو در گروه چالش‌های کاروان شماست.'
                  : (_chat.spaceById(widget.spaceId)?.isChannel == true
                      ? 'برای گفتگو، روی «ارسال نظر» زیر هر پست بزنید.'
                      : 'برای گفتگو، روی «ورود به گفتگو» در کارت چالش یا اعلان بزنید.')),
          style: TextStyle(color: ChatTheme.ink.withValues(alpha: 0.7), fontFamily: AppTheme.fontFamily, fontSize: 12),
          textAlign: TextAlign.center,
        ),
      );

  /// Light bar at the bottom: voice and attach on the right turn into send while typing; emoji on the left.
  Widget _composer() {
    final context_ = _editing ?? _replyTo;
    final inkSoft = ChatTheme.ink.withValues(alpha: 0.7);
    final caption = TextStyle(color: inkSoft, fontFamily: AppTheme.fontFamily, fontSize: 12);
    return Container(
      decoration: BoxDecoration(
        color: ChatTheme.paper,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 12, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        // The emoji panel under the bar already keeps clear of the system bar
        bottom: !_emojiOpen,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final person in _mentionMatches)
              InkWell(
                onTap: () => _pickMention(person),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: ChatTheme.gutter, vertical: 10),
                  child: Row(children: [
                    Icon(Icons.alternate_email_rounded, size: 16, color: inkSoft),
                    const SizedBox(width: 8),
                    Text(person['name'] ?? '', style: caption.copyWith(color: ChatTheme.ink, fontSize: 13)),
                  ]),
                ),
              ),
            if (context_ != null)
              Container(
                margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 8, ChatTheme.gutter - 8, 0),
                padding: const EdgeInsetsDirectional.only(start: 10),
                decoration: const BoxDecoration(border: BorderDirectional(start: BorderSide(color: AppColors.buttonCamel, width: 2))),
                child: Row(
                  children: [
                    Icon(_editing != null ? Icons.edit_rounded : Icons.reply_rounded, size: 15, color: AppColors.buttonCamel),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _editing != null ? 'ویرایش پیام' : 'پاسخ به ${context_.senderName}: ${context_.body.isEmpty ? 'فایل' : context_.body}',
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
            Padding(
              padding: const EdgeInsets.fromLTRB(ChatTheme.gutter - 8, 4, ChatTheme.gutter - 8, 4),
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
                                    child: const SizedBox(
                                      width: 40,
                                      height: 40,
                                      child: Icon(Icons.send_rounded, color: ChatTheme.ink, size: 20),
                                    ),
                                  ),
                                ),
                              )
                            : Row(
                                key: const ValueKey('tools'),
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    tooltip: _recording ? 'پایان ضبط و ارسال' : 'پیام صوتی',
                                    onPressed: _toggleRecording,
                                    icon: Icon(_recording ? Icons.stop_circle_rounded : Icons.mic_none_rounded, color: _recording ? ChatTheme.danger : inkSoft, size: 25),
                                  ),
                                  IconButton(
                                    tooltip: 'پیوست',
                                    onPressed: _uploading || _recording ? null : _pickFile,
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
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: TextField(
                        controller: _input,
                        focusNode: _focus,
                        minLines: 1,
                        maxLines: 5,
                        maxLength: 4000,
                        cursorColor: AppColors.buttonCamel,
                        textInputAction: TextInputAction.newline,
                        style: const TextStyle(color: ChatTheme.ink, fontFamily: AppTheme.fontFamily, fontSize: 14, height: 1.5),
                        decoration: InputDecoration(
                          counterText: '',
                          isDense: true,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                          hintText: _recording ? 'در حال ضبط صدا...' : 'پیام...',
                          hintStyle: caption.copyWith(fontSize: 13, color: _recording ? ChatTheme.danger : ChatTheme.ink.withValues(alpha: 0.45)),
                        ),
                      ),
                    ),
                  ),
                  Container(width: 1, height: 26, margin: const EdgeInsets.only(bottom: 11), color: ChatTheme.ink.withValues(alpha: 0.15)),
                  IconButton(
                    tooltip: _emojiOpen ? 'صفحه‌کلید' : 'ایموجی',
                    onPressed: _toggleEmoji,
                    icon: Icon(_emojiOpen ? Icons.keyboard_alt_outlined : Icons.emoji_emotions_outlined, color: inkSoft, size: 24),
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

/// The conversation's backdrop: the pattern of travel drawings over the app's background, when the
/// pattern image is in the app (assets/images/chat_pattern.png); without it, the plain background.
class _ChatWallpaper extends StatelessWidget {
  const _ChatWallpaper();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: 0.09,
        child: Image.asset(
          'assets/images/chat_pattern.png',
          repeat: ImageRepeat.repeat,
          fit: BoxFit.none,
          scale: 2,
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }
}
