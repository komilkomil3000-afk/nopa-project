import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
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
  }

  @override
  void dispose() {
    _chat.unwatch(widget.spaceId, threadRootId: _threadId);
    _chat.removeListener(_markReadWhileOpen);
    _scroll.dispose();
    _input.dispose();
    _recorder.dispose();
    super.dispose();
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

  Future<void> _sendFile(io.File file) async {
    setState(() => _uploading = true);
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
                if (mine && message.body.isNotEmpty) item('edit', Icons.edit_rounded, 'ویرایش'),
                if (space?.canModerate == true) item('pin', Icons.push_pin_rounded, message.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'),
                if (mine || space?.canModerate == true) item('delete', Icons.delete_rounded, 'حذف'),
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
    }
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
    );
    controller.dispose();
    if (query != null && query.trim().length >= 2) {
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
            final canWrite = _threadId != null || space?.canPost != false;
            return Column(
              children: [
                _header(space),
                if (widget.threadRoot != null) _threadOrigin(),
                Expanded(child: _list(messages, space, myId)),
                if (_chat.typingIn(widget.spaceId) != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                    child: Align(alignment: Alignment.centerRight, child: Text('${_chat.typingIn(widget.spaceId)} در حال نوشتن است', style: ChatTheme.caption)),
                  ),
                canWrite ? _composer() : _readOnlyBar(),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _header(ChatSpace? space) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 8, 4),
      child: Row(
        children: [
          Expanded(child: Text(_threadId != null ? 'گفتگوی زیر پیام' : (space?.title ?? ''), style: ChatTheme.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (_threadId == null) ...[
            IconButton(onPressed: _search, icon: const Icon(Icons.search_rounded, color: ChatTheme.lavender, size: 22)),
            IconButton(onPressed: () => _showList('پیام‌های سنجاق‌شده', () => _chat.pins(widget.spaceId)), icon: const Icon(Icons.push_pin_rounded, color: ChatTheme.lavender, size: 20)),
            if (space != null)
              IconButton(
                onPressed: () => _chat.setMuted(space, !space.muted),
                icon: Icon(space.muted ? Icons.notifications_off_rounded : Icons.notifications_rounded, color: ChatTheme.lavender, size: 20),
              ),
          ],
        ],
      ),
    );
  }

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
          Text(root.senderName, style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
          Text(root.body.isEmpty ? 'فایل' : root.body, style: ChatTheme.body, maxLines: 3, overflow: TextOverflow.ellipsis),
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
        return ChatMessageBubble(
          key: ValueKey(message.clientMessageId ?? message.id),
          message: message,
          mine: mine,
          myId: myId,
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

  Widget _readOnlyBar() => Padding(
        padding: const EdgeInsets.all(14),
        child: Text('برای پاسخ، پیام را نگه دارید و وارد گفتگوی زیر آن شوید.', style: ChatTheme.caption, textAlign: TextAlign.center),
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
