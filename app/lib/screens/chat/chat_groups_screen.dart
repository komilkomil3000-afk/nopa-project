import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';

/// Media groups: mentors and channel managers add, rename and delete them and choose their members.
class ChatGroupsScreen extends StatefulWidget {
  const ChatGroupsScreen({super.key});

  @override
  State<ChatGroupsScreen> createState() => _ChatGroupsScreenState();
}

class _ChatGroupsScreenState extends State<ChatGroupsScreen> {
  final ChatRepository _chat = ChatRepository.instance;
  List<Map<String, dynamic>> _groups = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await _chat.api('GET', '/chat/groups');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res.ok) _groups = (res.data as List).map((g) => Map<String, dynamic>.from(g as Map)).toList();
    });
    _chat.refreshSpaces();
  }

  Future<String?> _askName(String title, {String initial = ''}) async {
    final controller = TextEditingController(text: initial);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text(title, style: ChatTheme.title),
          content: TextField(controller: controller, maxLength: 60, autofocus: true, style: ChatTheme.body, decoration: chatField('نام گروه')),
          actions: [ChatButton(label: 'ثبت', onPressed: () => Navigator.pop(ctx, controller.text.trim()))],
        ),
      ),
    );
    return name == null || name.isEmpty ? null : name;
  }

  Future<void> _do(String method, String path, {Map<String, dynamic>? body}) async {
    final res = await _chat.api(method, path, body: body);
    if (!mounted) return;
    if (!res.ok) AppToast.error(context, res.error);
    await _load();
  }

  Future<void> _create() async {
    final name = await _askName('گروه جدید');
    if (name != null) await _do('POST', '/chat/groups', body: {'title': name, 'memberIds': <String>[]});
  }

  Future<void> _delete(Map<String, dynamic> group) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('حذف گروه', style: ChatTheme.title),
          content: Text('گروه «${group['title']}» و همه‌ی پیام‌هایش برای همیشه حذف می‌شود.', style: ChatTheme.body),
          actions: [
            ChatButton(label: 'انصراف', primary: false, onPressed: () => Navigator.pop(ctx, false)),
            ChatButton(label: 'حذف', onPressed: () => Navigator.pop(ctx, true)),
          ],
        ),
      ),
    );
    if (ok == true) await _do('DELETE', '/chat/groups/${group['id']}');
  }

  Future<void> _members(Map<String, dynamic> group) async {
    final query = group['caravanId'] == null ? '' : '?caravanId=${group['caravanId']}';
    final res = await _chat.api('GET', '/chat/groups/candidates$query');
    if (!mounted || !res.ok) return;
    final people = (res.data as List).map((p) => Map<String, dynamic>.from(p as Map)).toList();
    final members = ((group['members'] as List?) ?? const []).map((m) => m['id'] as String).toSet();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: StatefulBuilder(
          builder: (ctx, setSheet) => ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.7),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.all(12),
              children: [
                if (people.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('عضوی برای انتخاب وجود ندارد.', style: ChatTheme.caption, textAlign: TextAlign.center)),
                for (final person in people)
                  CheckboxListTile(
                    value: members.contains(person['id']),
                    activeColor: ChatTheme.accent,
                    secondary: SafeAvatar(imageUrl: person['avatarUrl'], name: person['name'] ?? '', radius: 16, gender: person['gender']),
                    title: Text(person['name'] ?? '', style: ChatTheme.body),
                    onChanged: (checked) async {
                      final id = person['id'] as String;
                      final res = checked == true
                          ? await _chat.api('POST', '/chat/groups/${group['id']}/members', body: {'memberIds': [id]})
                          : await _chat.api('DELETE', '/chat/groups/${group['id']}/members/$id');
                      if (res.ok) setSheet(() => checked == true ? members.add(id) : members.remove(id));
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return ChatPageScaffold(
      title: 'گروه‌ها',
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: ChatTheme.accent))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(children: [
                    Expanded(child: Text('گروه‌های رسانه‌ای', style: ChatTheme.title.copyWith(fontSize: 16))),
                    ChatButton(label: 'گروه جدید', onPressed: _create),
                  ]),
                  const SizedBox(height: 12),
                  if (_groups.isEmpty) Text('هنوز گروهی ساخته نشده است.', style: ChatTheme.caption.copyWith(fontSize: 13)),
                  for (final group in _groups)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: ChatTheme.card(),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(group['title'] ?? '', style: ChatTheme.title),
                          Text('${(group['members'] as List?)?.length ?? 0} عضو${group['caravanName'] != null ? ' · ${group['caravanName']}' : ''}', style: ChatTheme.caption),
                          const SizedBox(height: 6),
                          Wrap(spacing: 8, children: [
                            ChatButton(label: 'اعضا', primary: false, onPressed: () => _members(group)),
                            ChatButton(
                              label: 'تغییر نام',
                              primary: false,
                              onPressed: () async {
                                final name = await _askName('تغییر نام گروه', initial: group['title'] ?? '');
                                if (name != null) await _do('PATCH', '/chat/groups/${group['id']}', body: {'title': name});
                              },
                            ),
                            ChatButton(label: 'حذف', primary: false, onPressed: () => _delete(group)),
                          ]),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
