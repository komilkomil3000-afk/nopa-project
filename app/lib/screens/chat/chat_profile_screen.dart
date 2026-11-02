import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/constants/app_strings.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/chat/chat_conversation_screen.dart';
import 'package:nopa_app/screens/chat/chat_groups_screen.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/screens/mentor/profile/mentor_caravans_roster_screen.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/zoomable_image.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// A group or channel: its numbers, its members (each opens their profile) and what was shared in it.
class ChatSpaceProfileScreen extends StatefulWidget {
  final String spaceId;
  const ChatSpaceProfileScreen({super.key, required this.spaceId});

  @override
  State<ChatSpaceProfileScreen> createState() => _ChatSpaceProfileScreenState();
}

class _ChatSpaceProfileScreenState extends State<ChatSpaceProfileScreen> {
  final ChatRepository _chat = ChatRepository.instance;
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _allMembers = false;

  static const int _shownMembers = 8;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var profile = await _chat.spaceProfile(widget.spaceId);
    // A server without the profile endpoint yet: what the app already knows of the space and its people
    if (profile == null) {
      final space = _chat.spaceById(widget.spaceId);
      final people = await _chat.people(widget.spaceId);
      if (space != null) {
        profile = {
          'id': space.id,
          'type': space.type,
          'title': space.title,
          'memberCount': people.length,
          'onlineCount': people.where((p) => _chat.isOnline(p['id'] ?? '')).length,
          'members': people,
          'canModerate': space.canModerate,
        };
      }
    }
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final space = _chat.spaceById(widget.spaceId);
    final profile = _profile;
    return _ProfileScaffold(
      title: space?.isChannel == true ? 'اطلاعات کانال' : 'اطلاعات و اعضا',
      loading: _loading,
      failed: profile == null,
      onRetry: () {
        setState(() => _loading = true);
        _load();
      },
      builder: () {
        final members = ((profile!['members'] as List?) ?? []).map((m) => Map<String, dynamic>.from(m as Map)).toList();
        final memberCount = (profile['memberCount'] as num?)?.toInt() ?? members.length;
        final online = members.isNotEmpty ? members.where((m) => _chat.isOnline(m['id'] ?? '')).length : (profile['onlineCount'] as num?)?.toInt() ?? 0;
        final isChannel = space?.isChannel ?? false;
        final shown = _allMembers ? members : members.take(_shownMembers).toList();
        return [
          _ProfilePanel(
            children: [
              _IdentityRow(
                avatar: ChatIconAvatar(icon: chatSpaceIcon(profile['type'] ?? ''), radius: 40),
                name: profile['title'] ?? space?.title ?? '',
                subtitle: '${isChannel ? 'تعداد اعضا' : 'تعداد همسفر'} ${memberCount.toString()}نفر    ${online.toString()}نفر آنلاین',
                rank: (profile['rank'] as num?)?.toInt(),
              ),
              if (profile['canModerate'] == true && profile['type'] == 'media') ...[
                const SizedBox(height: 18),
                InkWell(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChatGroupsScreen())).then((_) => _load()),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(children: [
                      const Icon(Icons.person_add_alt_1_rounded, color: ChatTheme.lavender, size: 20),
                      const SizedBox(width: 10),
                      Text('درخواست اضافه کردن عضو جدید', style: ChatTheme.body.copyWith(color: ChatTheme.lavender, fontSize: 13)),
                    ]),
                  ),
                ),
              ],
              if (members.isNotEmpty) ...[
                const SizedBox(height: 10),
                for (var i = 0; i < shown.length; i++) ...[
                  if (i > 0) const ChatSeparator(indentStart: 0),
                  _MemberRow(
                    person: shown[i],
                    online: _chat.isOnline(shown[i]['id'] ?? ''),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ChatMemberProfileScreen(spaceId: widget.spaceId, userId: shown[i]['id']),
                    )),
                  ),
                ],
                if (members.length > _shownMembers)
                  Center(
                    child: TextButton(
                      onPressed: () => setState(() => _allMembers = !_allMembers),
                      child: Text(_allMembers ? 'نمایش کمتر' : 'نمایش همه‌ی ${members.length} نفر', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontSize: 12)),
                    ),
                  ),
              ],
            ],
          ),
          _SharedMedia(spaceId: widget.spaceId, withSessions: space?.isPrivate != true),
        ];
      },
    );
  }
}

/// A person as seen from a conversation: their numbers, and how much they take part when the viewer guides them.
class ChatMemberProfileScreen extends StatefulWidget {
  final String spaceId;
  final String userId;
  const ChatMemberProfileScreen({super.key, required this.spaceId, required this.userId});

  @override
  State<ChatMemberProfileScreen> createState() => _ChatMemberProfileScreenState();
}

class _ChatMemberProfileScreenState extends State<ChatMemberProfileScreen> {
  final ChatRepository _chat = ChatRepository.instance;
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var profile = await _chat.memberProfile(widget.spaceId, widget.userId);
    // A server without the profile endpoint yet: the person as the conversation's member list has them
    if (profile == null) {
      final space = _chat.spaceById(widget.spaceId);
      final people = await _chat.people(widget.spaceId);
      final person = people.where((p) => p['id'] == widget.userId).firstOrNull;
      if (person != null) {
        profile = {...person};
      } else if (space != null && space.peerId == widget.userId) {
        profile = {'id': space.peerId, 'name': space.title, 'avatarUrl': space.peerAvatarUrl, 'gender': space.peerGender, 'role': space.peerIsMentor ? 'mentor' : 'student'};
      }
    }
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  Future<void> _message() async {
    final navigator = Navigator.of(context);
    final space = await _chat.openDirect(widget.userId);
    if (!mounted) return;
    if (space == null) {
      AppToast.info(context, 'گفتگوی خصوصی با این فرد ممکن نیست.');
      return;
    }
    navigator.push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: space.id)));
  }

  void _openReportCard(Map<String, dynamic> p) {
    final member = CaravanMemberModel.fromJson({
      'id': p['id'],
      'name': p['name'],
      'avatarUrl': p['avatarUrl'] ?? '',
      'levelFrame': p['levelFrame'],
      'zarikBalance': p['zarik'],
      'nakh': p['nakh'],
      'farsh': p['farsh'],
      'beyragh': p['derafsh'],
      'role': p['role'],
    });
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => StudentReportCardAndEvaluationScreen(member: member, caravanName: p['caravanName'] ?? '', caravanId: p['caravanId']),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final me = Provider.of<AppRepository>(context, listen: false).currentUser;
    final space = _chat.spaceById(widget.spaceId);
    return _ProfileScaffold(
      title: 'پروفایل',
      loading: _loading,
      failed: _profile == null,
      onRetry: () {
        setState(() => _loading = true);
        _load();
      },
      builder: () {
        final p = _profile!;
        final isMentor = p['role'] == 'mentor';
        final caravan = (p['caravanName'] ?? '').toString();
        final subtitle = isMentor ? (caravan.isEmpty ? 'راهبر' : 'راهبر کاروان $caravan') : (caravan.isEmpty ? 'همسفر نپا' : 'عضو کاروان $caravan');
        final stats = p['stats'] is Map ? Map<String, dynamic>.from(p['stats'] as Map) : null;
        final self = widget.userId == me.id;
        final canReport = me.role.isMentorLike && !isMentor && p['caravanId'] != null;
        return [
          _ProfilePanel(
            children: [
              _IdentityRow(
                avatar: SafeAvatar(imageUrl: p['avatarUrl'], name: p['name'] ?? '', radius: 40, gender: p['gender'], isMentor: isMentor),
                online: _chat.isOnline(widget.userId),
                name: p['name'] ?? '',
                subtitle: subtitle,
                rank: isMentor ? null : (p['rank'] as num?)?.toInt(),
              ),
              if (!isMentor && p.containsKey('zarik')) ...[
                const SizedBox(height: 18),
                Row(
                  children: [
                    _Stat(label: AppStrings.zarik, value: p['zarik']),
                    _Stat(label: AppStrings.nakh, value: p['nakh']),
                    _Stat(label: AppStrings.farsh, value: p['farsh']),
                    _Stat(label: AppStrings.beyragh, value: p['derafsh']),
                  ],
                ),
              ],
              if (!self && space?.isDirect != true) ...[
                const SizedBox(height: 16),
                _PanelButton(icon: Icons.chat_bubble_outline_rounded, label: 'پیام خصوصی', onTap: _message),
              ],
            ],
          ),
          if (stats != null) _Participation(stats: stats, onReportCard: canReport ? () => _openReportCard(p) : null),
          _SharedMedia(spaceId: widget.spaceId, userId: space?.isPrivate == true ? null : widget.userId, withSessions: space?.isPrivate != true),
        ];
      },
    );
  }
}

/// Golden top bar (logo, connection, back) over a scrolling page.
class _ProfileScaffold extends StatelessWidget {
  final String title;
  final bool loading;
  final bool failed;
  final VoidCallback onRetry;
  final List<Widget> Function() builder;
  const _ProfileScaffold({required this.title, required this.loading, required this.failed, required this.onRetry, required this.builder});

  /// Height of the golden header under the status bar.
  static const double _headerHeight = 70;

  @override
  Widget build(BuildContext context) {
    final chat = ChatRepository.instance;
    final top = MediaQuery.paddingOf(context).top;
    Widget body;
    if (loading) {
      body = const Center(child: CircularProgressIndicator(color: ChatTheme.accent));
    } else if (failed) {
      body = Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('اطلاعات دریافت نشد.', style: ChatTheme.caption.copyWith(fontSize: 13)),
          TextButton(onPressed: onRetry, child: Text('تلاش دوباره', style: ChatTheme.body.copyWith(color: ChatTheme.accent))),
        ]),
      );
    } else {
      // The page scrolls under the header, so the lavender panel seems to come out of it
      body = ListenableBuilder(
        listenable: chat,
        builder: (context, _) => ListView(
          padding: EdgeInsets.only(top: top + _headerHeight - 30, bottom: 24 + MediaQuery.paddingOf(context).bottom),
          children: builder(),
        ),
      );
    }
    return Container(
      decoration: const BoxDecoration(
        gradient: AppColors.screenBackgroundGradient,
        image: DecorationImage(image: AssetImage('assets/images/login_bg.png'), fit: BoxFit.cover),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Directionality(
          textDirection: TextDirection.rtl,
          child: Stack(
            children: [
              Positioned.fill(child: loading || failed ? Padding(padding: EdgeInsets.only(top: top + _headerHeight), child: body) : body),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: ChatGoldHeader(
                  child: ListenableBuilder(
                    listenable: chat,
                    builder: (context, _) => ChatHeaderTitle(
                      avatar: const SizedBox.shrink(),
                      title: title,
                      subtitle: chat.connected ? '' : 'درحال اتصال...',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The lavender panel under the header that holds who this is.
class _ProfilePanel extends StatelessWidget {
  final List<Widget> children;
  const _ProfilePanel({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.fromLTRB(ChatTheme.gutter + 8, 30 + 22, ChatTheme.gutter + 8, 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ChatTheme.surfaceTop, ChatTheme.mineFill]),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
  }
}

class _IdentityRow extends StatelessWidget {
  final Widget avatar;
  final String name;
  final String subtitle;
  final int? rank;
  final bool online;
  const _IdentityRow({required this.avatar, required this.name, required this.subtitle, this.rank, this.online = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(shape: BoxShape.circle, color: ChatTheme.lavender.withValues(alpha: 0.12), border: Border.all(color: ChatTheme.lavender.withValues(alpha: 0.35))),
          child: ChatRing(online: online, child: avatar),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(subtitle, maxLines: 2, style: ChatTheme.caption.copyWith(color: ChatTheme.lavender, fontSize: 11.5, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        if (rank != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: ChatTheme.accent.withValues(alpha: 0.6))),
            child: Column(children: [
              Text('رتبه', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontSize: 11)),
              const SizedBox(height: 2),
              Text('$rank', style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily, fontSize: 16, fontWeight: FontWeight.bold)),
            ]),
          ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final dynamic value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(children: [
        Text(label, style: ChatTheme.caption.copyWith(color: ChatTheme.lavender, fontSize: 12)),
        const SizedBox(height: 4),
        Text('${value ?? 0}', style: const TextStyle(color: Colors.white, fontFamily: AppTheme.fontFamily, fontSize: 13, fontWeight: FontWeight.bold)),
      ]),
    );
  }
}

class _PanelButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _PanelButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ChatTheme.accent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 18, color: ChatTheme.ink),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(color: ChatTheme.ink, fontFamily: AppTheme.fontFamily, fontSize: 13, fontWeight: FontWeight.bold)),
          ]),
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  final Map<String, dynamic> person;
  final bool online;
  final VoidCallback onTap;
  const _MemberRow({required this.person, required this.online, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final mentor = person['role'] == 'mentor';
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(children: [
          ChatRing(online: online, child: SafeAvatar(imageUrl: person['avatarUrl'], name: person['name'] ?? '', radius: 18, gender: person['gender'], isMentor: mentor)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              mentor ? '${person['name'] ?? ''} · راهبر' : (person['name'] ?? ''),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: ChatTheme.title.copyWith(fontSize: 13),
            ),
          ),
          Text(online ? 'آنلاین' : '', style: ChatTheme.caption.copyWith(color: ChatTheme.lavender, fontSize: 10)),
        ]),
      ),
    );
  }
}

/// How much a member takes part in this conversation (seen by their mentors, moderators and themselves).
class _Participation extends StatelessWidget {
  final Map<String, dynamic> stats;
  final VoidCallback? onReportCard;
  const _Participation({required this.stats, this.onReportCard});

  int _int(String key) => (stats[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    final last = DateTime.tryParse(stats['lastActiveAt']?.toString() ?? '');
    return Container(
      margin: const EdgeInsets.fromLTRB(ChatTheme.gutter, 0, ChatTheme.gutter, 18),
      padding: const EdgeInsets.all(14),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const Icon(Icons.insights_rounded, color: ChatTheme.accent, size: 20),
            const SizedBox(width: 8),
            Text('تحلیل مشارکت در این گفتگو', style: ChatTheme.title),
          ]),
          const SizedBox(height: 14),
          _Bar(label: 'سهم از پیام‌های گفتگو', percent: _int('messageShare'), detail: '${_int('messages')} پیام'),
          if (_int('sessions') > 0) _Bar(label: 'مشارکت در نشست‌ها', percent: _int('sessionShare'), detail: '${_int('sessionsJoined')} از ${_int('sessions')}'),
          _Bar(label: 'روزهای فعال (۳۰ روز اخیر)', percent: _int('activeDaysShare'), detail: '${_int('activeDays')} روز'),
          const SizedBox(height: 4),
          Row(children: [
            Expanded(child: _Fact(icon: Icons.favorite_rounded, label: 'واکنش دریافتی', value: '${_int('reactionsReceived')}')),
            Expanded(child: _Fact(icon: Icons.schedule_rounded, label: 'آخرین فعالیت', value: last == null ? 'هنوز پیامی نداده' : chatTimeLabel(last))),
          ]),
          if (onReportCard != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onReportCard,
              style: OutlinedButton.styleFrom(
                foregroundColor: ChatTheme.accent,
                side: BorderSide(color: ChatTheme.accent.withValues(alpha: 0.6)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              icon: const Icon(Icons.assignment_rounded, size: 18),
              label: Text('کارنامه و پیشرفت کامل', style: ChatTheme.body.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  final String label;
  final int percent;
  final String detail;
  const _Bar({required this.label, required this.percent, required this.detail});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Expanded(child: Text(label, style: ChatTheme.caption.copyWith(color: ChatTheme.text, fontSize: 12))),
            Text('$detail · ٪$percent', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (percent / 100).clamp(0.0, 1.0),
              minHeight: 6,
              color: ChatTheme.accent,
              backgroundColor: ChatTheme.stroke.withValues(alpha: 0.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _Fact({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, size: 16, color: ChatTheme.lavender),
      const SizedBox(width: 6),
      Flexible(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: ChatTheme.caption.copyWith(fontSize: 10)),
          Text(value, style: ChatTheme.caption.copyWith(color: ChatTheme.text, fontSize: 12, fontWeight: FontWeight.bold)),
        ]),
      ),
    ]);
  }
}

/// Tabs of what was shared: photos, voices, links and (in groups and channels) sessions.
class _SharedMedia extends StatefulWidget {
  final String spaceId;
  final String? userId;
  final bool withSessions;
  const _SharedMedia({required this.spaceId, this.userId, required this.withSessions});

  @override
  State<_SharedMedia> createState() => _SharedMediaState();
}

class _SharedMediaState extends State<_SharedMedia> {
  final ChatRepository _chat = ChatRepository.instance;
  final Map<String, List<Map<String, dynamic>>> _loaded = {};
  String _kind = 'image';

  List<(String, String)> get _tabs => [
        ('image', 'عکس ها'),
        ('audio', 'صوت ها'),
        ('link', 'لینک ها'),
        if (widget.withSessions) ('session', 'نشست ها'),
      ];

  @override
  void initState() {
    super.initState();
    _fetch(_kind);
  }

  Future<void> _fetch(String kind) async {
    if (_loaded.containsKey(kind)) return;
    final list = await _chat.media(widget.spaceId, kind, userId: widget.userId);
    if (mounted) setState(() => _loaded[kind] = list);
  }

  void _select(String kind) {
    setState(() => _kind = kind);
    _fetch(kind);
  }

  void _openSession(Map<String, dynamic> s) {
    final root = ChatMessage.fromJson({
      'id': s['id'],
      'spaceId': widget.spaceId,
      'kind': s['kind'] ?? 'text',
      'body': s['title'] ?? '',
      'threadReplies': s['threadReplies'] ?? 0,
      'createdAt': s['createdAt'],
      'meta': {'title': s['title']},
      if (s['topicId'] != null) 'topic': {'id': s['topicId'], 'status': s['topicStatus']},
    });
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: widget.spaceId, threadRoot: root)));
  }

  void _playVoice(Map<String, dynamic> a) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ChatTheme.gutter),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(chatTimeLabel(DateTime.tryParse(a['createdAt']?.toString() ?? '')), style: ChatTheme.caption),
            const SizedBox(height: 8),
            ChatAudioPlayer(url: ApiConstants.resolveImageUrl(a['url'] ?? '')),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = _loaded[_kind];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ChatTheme.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: _tabBar()),
          const SizedBox(height: 16),
          if (items == null)
            const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: ChatTheme.accent)))
          else if (_kind == 'image' || _kind == 'audio')
            _grid(items)
          else if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(30),
              child: Text(_kind == 'link' ? 'لینکی به اشتراک گذاشته نشده است.' : 'هنوز نشستی برگزار نشده است.', textAlign: TextAlign.center, style: ChatTheme.caption.copyWith(fontSize: 13)),
            )
          else
            for (final item in items) _kind == 'link' ? _linkRow(item) : _sessionRow(item),
        ],
      ),
    );
  }

  Widget _tabBar() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ChatTheme.surfaceBottom,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: ChatTheme.stroke.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < _tabs.length; i++) ...[
            if (i > 0 && _tabs[i].$1 != _kind && _tabs[i - 1].$1 != _kind)
              Container(width: 1, height: 16, color: ChatTheme.stroke.withValues(alpha: 0.6))
            else if (i > 0)
              const SizedBox(width: 1),
            GestureDetector(
              onTap: () => _select(_tabs[i].$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: _tabs[i].$1 == _kind
                    ? BoxDecoration(
                        gradient: const LinearGradient(colors: [AppColors.accentGoldEnd, AppColors.accentGoldStart], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                        borderRadius: BorderRadius.circular(6),
                      )
                    : null,
                child: Text(
                  _tabs[i].$2,
                  style: TextStyle(
                    color: _tabs[i].$1 == _kind ? Colors.white : ChatTheme.text.withValues(alpha: 0.85),
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 12,
                    fontWeight: _tabs[i].$1 == _kind ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Square frames, three to a row; empty frames stand in while there is nothing to show.
  Widget _grid(List<Map<String, dynamic>> items) {
    final count = items.isEmpty ? 9 : items.length;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 6, crossAxisSpacing: 6),
      itemCount: count,
      itemBuilder: (context, i) {
        final frame = BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ChatTheme.stroke.withValues(alpha: 0.7)),
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ChatTheme.surfaceTop.withValues(alpha: 0.6), ChatTheme.surfaceBottom.withValues(alpha: 0.6)]),
        );
        if (items.isEmpty) return Container(decoration: frame);
        final item = items[i];
        if (_kind == 'image') {
          final url = ApiConstants.resolveImageUrl(item['url'] ?? '');
          return Container(
            decoration: frame,
            clipBehavior: Clip.antiAlias,
            child: ZoomableImage(
              imageUrl: url,
              child: CachedNetworkImage(
                imageUrl: url,
                cacheKey: 'chat-${item['id']}',
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => const Icon(Icons.broken_image_rounded, color: ChatTheme.muted),
              ),
            ),
          );
        }
        return GestureDetector(
          onTap: () => _playVoice(item),
          child: Container(
            decoration: frame,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.graphic_eq_rounded, color: ChatTheme.accent, size: 30),
              const SizedBox(height: 6),
              Text(chatTimeLabel(DateTime.tryParse(item['createdAt']?.toString() ?? '')), style: ChatTheme.caption),
            ]),
          ),
        );
      },
    );
  }

  Widget _linkRow(Map<String, dynamic> item) {
    final body = (item['body'] ?? '').toString();
    final url = RegExp(r'https?://[^\s]+').firstMatch(body)?.group(0);
    return InkWell(
      onTap: url == null ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: ChatTheme.card(),
        child: Row(children: [
          const Icon(Icons.link_rounded, color: ChatTheme.accent, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(url ?? body, maxLines: 1, overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr, style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontSize: 12)),
              const SizedBox(height: 2),
              Text('${item['senderName'] ?? ''} · ${chatTimeLabel(DateTime.tryParse(item['createdAt']?.toString() ?? ''))}', style: ChatTheme.caption),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _sessionRow(Map<String, dynamic> item) {
    final status = const {'open': 'باز', 'closed': 'بسته', 'paid': 'ارزیابی‌شده'}[item['topicStatus']];
    return InkWell(
      onTap: () => _openSession(item),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: ChatTheme.card(),
        child: Row(children: [
          Icon(item['kind'] == 'challenge' ? Icons.local_fire_department_rounded : Icons.forum_rounded, color: ChatTheme.accent, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item['title'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: ChatTheme.title.copyWith(fontSize: 13)),
              const SizedBox(height: 3),
              Text(
                [
                  '${item['threadReplies'] ?? 0} پاسخ',
                  ?status,
                  chatTimeLabel(DateTime.tryParse(item['createdAt']?.toString() ?? '')),
                ].join(' · '),
                style: ChatTheme.caption,
              ),
            ]),
          ),
          const Icon(Icons.chevron_left_rounded, color: ChatTheme.muted),
        ]),
      ),
    );
  }
}
