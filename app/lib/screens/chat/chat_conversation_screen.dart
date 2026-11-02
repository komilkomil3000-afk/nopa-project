import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:nopa_app/screens/shell/app_shell.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/services/local_cache.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
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
  late final DraftTextController _input = DraftTextController(draftKey: 'chat-${widget.spaceId}-${widget.threadRoot?.id ?? ''}');

  ChatMessage? _replyTo;
  ChatMessage? _editing;
  bool _loadingOlder = false;
  bool _reachedStart = false;
  bool _uploading = false;
  bool _recording = false;
  List<Map<String, dynamic>> _people = [];
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
      if (mounted) _people = people;
    });
    _scroll.addListener(_onScroll);
    _input.addListener(_onTyping);
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
      final out = await FlutterImageCompress.compressAndGetFile(file.path, target, quality: 80, minWidth: 1600, minHeight: 1600);
      return out == null ? file : io.File(out.path);
    } catch (e) {
      return file;
    }
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

  Future<void> _showActions(ChatMessage message, ChatSpace? space, bool mine) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) {
        Widget item(String value, IconData icon, String label) => ListTile(
              leading: Icon(icon, color: ChatTheme.lavender),
              title: Text(label, style: ChatTheme.body),
              onTap: () => Navigator.pop(ctx, value),
            );
        return Directionality(
          textDirection: TextDirection.rtl,
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      for (final entry in ChatTheme.reactions.entries)
                        Tooltip(
                          message: entry.value.label,
                          child: IconButton(
                            onPressed: () => Navigator.pop(ctx, 'react:${entry.key}'),
                            icon: Icon(entry.value.icon, color: ChatTheme.accent, size: 26),
                          ),
                        ),
                    ],
                  ),
                ),
                item('reply', Icons.reply_rounded, 'پاسخ'),
                if (_threadId == null) item('thread', Icons.forum_rounded, 'ورود به گفتگوی زیر پیام'),
                if (message.body.isNotEmpty) item('copy', Icons.copy_rounded, 'کپی متن'),
                if (mine && message.body.isNotEmpty && !_threadIsClosed) item('edit', Icons.edit_rounded, 'ویرایش'),
                if (space?.canModerate == true) item('pin', Icons.push_pin_rounded, message.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'),
                if (space?.canModerate == true && !mine && message.senderId != null) item('mute', Icons.voice_over_off_rounded, 'بی‌صدا تا یک ساعت'),
                if (space?.canTag == true) ...[
                  item('tag', Icons.label_rounded, 'برچسب'),
                  if (_threadId != null) ...[
                    item('best', Icons.workspace_premium_rounded, 'بهترین پاسخ'),
                    item('evidence', Icons.verified_rounded, 'شاهد امتیاز'),
                    if (widget.threadRoot?.topicId != null) item('final', Icons.task_alt_rounded, 'پاسخ نهایی گروه'),
                  ],
                ],
                if (!mine && space?.isDirect != true) item('report', Icons.flag_rounded, 'گزارش تخلف'),
                if ((mine && !_threadIsClosed) || space?.canModerate == true) item('delete', Icons.delete_rounded, 'حذف'),
              ],
            ),
          ),
        );
      },
    );
    if (action == null || !mounted) return;

    if (action.startsWith('react:')) {
      await _chat.react(message, action.substring(6));
    } else if (action == 'reply') {
      setState(() => _replyTo = message);
    } else if (action == 'thread') {
      _openThread(message);
    } else if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: message.body));
      if (mounted) AppToast.success(context, 'متن کپی شد.');
    } else if (action == 'edit') {
      setState(() => _editing = message);
      _input.text = message.body;
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
    return AppScaffold(
      showBottomNavBar: false,
      showDrawerButton: false,
      showNotificationIcon: false,
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: ListenableBuilder(
          listenable: _chat,
          builder: (context, _) {
            final space = _chat.spaceById(widget.spaceId);
            final messages = _chat.messagesOf(widget.spaceId, threadRootId: _threadId);
            final threadClosed = widget.threadRoot?.topicId != null && _rootStatus(messages) != 'open';
            final canWrite = !threadClosed && (_threadId != null ? space?.canReply != false : space?.canPost != false);
            return Column(
              children: [
                _header(space),
                // With the keyboard open the conversation needs every pixel
                if (widget.threadRoot != null && MediaQuery.of(context).viewInsets.bottom == 0) _threadOrigin(),
                if (space?.type == 'support') _caseBar(),
                Expanded(child: _list(messages, space, myId)),
                if (_chat.typingIn(widget.spaceId) != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                    child: Align(alignment: Alignment.centerRight, child: Text('${_chat.typingIn(widget.spaceId)} در حال نوشتن است', style: ChatTheme.caption)),
                  ),
                canWrite ? _composer() : _readOnlyBar(threadClosed),
              ],
            );
          },
        ),
      ),
    );
  }

  bool get _threadIsClosed => widget.threadRoot?.topicId != null && _rootStatus(const []) != 'open';

  String? _rootStatus(List<ChatMessage> _) {
    final top = _chat.messagesOf(widget.spaceId);
    for (final m in top) {
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

  /// Title and search stay in sight; the rest of the tools sit in one menu so the title always fits.
  Widget _header(ChatSpace? space) {
    final title = _threadId != null ? 'گفتگوی زیر پیام' : (space?.title ?? '');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 4, 4),
      child: Row(
        children: [
          Expanded(child: Text(title, style: ChatTheme.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (_threadId == null) ...[
            IconButton(onPressed: _search, icon: const Icon(Icons.search_rounded, color: ChatTheme.lavender, size: 22)),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded, color: ChatTheme.lavender),
              color: ChatTheme.surfaceBottom,
              onSelected: (value) {
                switch (value) {
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
                _menuItem('pins', Icons.push_pin_rounded, 'پیام‌های سنجاق‌شده'),
                _menuItem('tags', Icons.label_rounded, 'پیام‌های برچسب‌دار'),
                _menuItem('stations', Icons.flag_rounded, 'پیام‌های هر منزلگاه'),
                if (space != null)
                  _menuItem('mute', space.muted ? Icons.notifications_rounded : Icons.notifications_off_rounded, space.muted ? 'روشن کردن اعلان' : 'بی‌صدا کردن گفتگو'),
              ],
            ),
          ],
        ],
      ),
    );
  }

  PopupMenuItem<String> _menuItem(String value, IconData icon, String label) => PopupMenuItem(
        value: value,
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Row(children: [
            Icon(icon, color: ChatTheme.lavender, size: 18),
            const SizedBox(width: 10),
            Text(label, style: ChatTheme.body),
          ]),
        ),
      );

  Widget _threadOrigin() {
    final root = widget.threadRoot!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
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

  Widget _list(List<ChatMessage> messages, ChatSpace? space, String myId) {
    if (messages.isEmpty) {
      return Center(child: Text('هنوز پیامی ارسال نشده است.', style: ChatTheme.caption.copyWith(fontSize: 13)));
    }
    return ListView.builder(
      controller: _scroll,
      reverse: true,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[messages.length - 1 - index];
        final previous = index + 1 < messages.length ? messages[messages.length - 2 - index] : null;
        final mine = message.senderId == myId;
        if (message.kind == 'challenge' && !message.deleted && message.topicId != null) {
          return GestureDetector(
            key: ValueKey(message.id),
            onLongPress: () => _showActions(message, space, false),
            child: ChallengeCard(
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
          return GestureDetector(
            key: ValueKey(message.id),
            onLongPress: () => _showActions(message, space, false),
            child: PollCard(message: message, myId: myId, onVote: (o) => _chat.vote(message, o)),
          );
        }
        return ChatMessageBubble(
          key: ValueKey(message.clientMessageId ?? message.id),
          message: message,
          mine: mine,
          myId: myId,
          staffTags: _chat.staffTagsOf(message.id),
          showSender: previous?.senderId != message.senderId && space?.isDirect != true,
          seen: space != null && space.isDirect && message.seq > 0 && message.seq <= space.peerReadSeq,
          onLongPress: () => _showActions(message, space, mine),
          onOpenThread: _threadId == null ? () => _openThread(message) : null,
          onRetry: () => _chat.retry(message),
          onReact: (type) => _chat.react(message, type),
        );
      },
    );
  }

  Widget _readOnlyBar(bool closed) => Padding(
        padding: const EdgeInsets.all(14),
        child: Text(
          closed
              ? 'این چالش بسته شده است.'
              : (_chat.spaceById(widget.spaceId)?.canReply == false ? 'این میدان فقط خواندنی است؛ گفتگو در گروه چالش‌های کاروان شماست.' : 'برای گفتگو، روی «ورود به گفتگو» در کارت چالش یا اعلان بزنید.'),
          style: ChatTheme.caption,
          textAlign: TextAlign.center,
        ),
      );

  Widget _composer() {
    final context_ = _editing ?? _replyTo;
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 8),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: ChatTheme.card(),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final person in _mentionMatches)
              ListTile(dense: true, title: Text(person['name'] ?? '', style: ChatTheme.body), onTap: () => _pickMention(person)),
            if (context_ != null)
              Row(
                children: [
                  const SizedBox(width: 8),
                  Icon(_editing != null ? Icons.edit_rounded : Icons.reply_rounded, size: 15, color: ChatTheme.accent),
                  const SizedBox(width: 6),
                  Expanded(child: Text(context_.body.isEmpty ? 'فایل' : context_.body, style: ChatTheme.caption, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () {
                      if (_editing != null) _input.clear();
                      setState(() {
                        _editing = null;
                        _replyTo = null;
                      });
                    },
                    icon: const Icon(Icons.close_rounded, size: 16, color: ChatTheme.muted),
                  ),
                ],
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: _uploading ? null : _pickFile,
                  icon: _uploading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ChatTheme.accent))
                      : const Icon(Icons.attach_file_rounded, color: ChatTheme.lavender, size: 22),
                ),
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: 4000,
                    style: ChatTheme.body,
                    decoration: InputDecoration(
                      counterText: '',
                      isDense: true,
                      border: InputBorder.none,
                      hintText: _recording ? 'در حال ضبط صدا...' : 'پیام...',
                      hintStyle: ChatTheme.caption.copyWith(fontSize: 13),
                    ),
                  ),
                ),
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _input,
                  builder: (context, value, _) => value.text.trim().isEmpty && _editing == null
                      ? IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: _toggleRecording,
                          icon: Icon(_recording ? Icons.stop_circle_rounded : Icons.mic_rounded, color: _recording ? ChatTheme.danger : ChatTheme.lavender, size: 23),
                        )
                      : IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: _send,
                          icon: const Icon(Icons.send_rounded, color: ChatTheme.accent, size: 22),
                        ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
