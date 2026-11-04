import 'package:nopa_app/core/avatar_catalog.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_conversation_screen.dart';
import 'package:nopa_app/screens/chat/chat_format.dart';
import 'package:nopa_app/screens/chat/chat_groups_screen.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/tap_expander.dart';

/// The filter tabs under the chat header, right to left, and the space types each one holds.
enum ChatFilter {
  all('همه', {}),
  challenges('چالش‌ها', {'challenges', 'arena'}),
  personal('شخصی', {'direct', 'support'}),
  gathering('دورهمی', {'caravan', 'mentors', 'media', 'mediaqa'}),
  academy('آموزگاه', {'announcements', 'public'});

  final String label;
  final Set<String> types;
  const ChatFilter(this.label, this.types);

  bool matches(ChatSpace space) {
    if (this == ChatFilter.all) return true;
    if (types.contains(space.type)) return true;
    // Spaces of a type no tab names (e.g. custom groups) are gatherings
    return this == ChatFilter.gathering && !ChatFilter.values.any((f) => f.types.contains(space.type));
  }
}

/// Chat tab: its own golden header (logo, connection state, filters) above every conversation the user has.
class ChatHomeScreen extends StatefulWidget {
  const ChatHomeScreen({super.key});

  @override
  State<ChatHomeScreen> createState() => _ChatHomeScreenState();
}

class _ChatHomeScreenState extends State<ChatHomeScreen> {
  ChatFilter _filter = ChatFilter.all;
  final PageController _pages = PageController();

  /// Set while a tap on a header tab animates the pages, so the pages passed on the way don't flip the tab.
  ChatFilter? _tapTarget;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _selectFilter(ChatFilter f) {
    setState(() => _filter = f);
    if (!_pages.hasClients) return;
    _tapTarget = f;
    _pages
        .animateToPage(f.index, duration: const Duration(milliseconds: 260), curve: Curves.easeOutCubic)
        .whenComplete(() => _tapTarget = null);
  }

  void _onPageChanged(int index) {
    final f = ChatFilter.values[index];
    if (_tapTarget != null && f != _tapTarget) return;
    if (f != _filter) setState(() => _filter = f);
  }

  @override
  Widget build(BuildContext context) {
    final chat = ChatRepository.instance;
    // Mentors and channel managers start groups from here; students write to their mentor or support
    final role = Provider.of<AppRepository>(context, listen: false).currentUser.role;
    final staff = role.isMentorLike || role.isChannelManager;
    return ListenableBuilder(
      listenable: chat,
      builder: (context, _) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            children: [
              _ChatHeader(
                connected: chat.online,
                filter: _filter,
                onFilter: _selectFilter,
              ),
              Expanded(
                child: Stack(
                  children: [
                    if (chat.spaces.isEmpty && chat.loadingSpaces)
                      const Center(child: CircularProgressIndicator(color: ChatTheme.accent))
                    else
                      // One page per filter: swiping sideways moves between the tabs, right to left
                      PageView.builder(
                        controller: _pages,
                        itemCount: ChatFilter.values.length,
                        onPageChanged: _onPageChanged,
                        itemBuilder: (context, page) => _buildPage(chat, ChatFilter.values[page]),
                      ),
                    Positioned(
                      left: 16,
                      bottom: 16,
                      child: FloatingActionButton.small(
                        heroTag: 'chat-new',
                        backgroundColor: ChatTheme.accent,
                        foregroundColor: ChatTheme.surfaceBottom,
                        onPressed: staff ? () => showCreateGroupSheet(context) : () => _showContacts(context),
                        child: Icon(staff ? Icons.add_rounded : Icons.edit_rounded, size: staff ? 24 : 20),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPage(ChatRepository chat, ChatFilter filter) {
    final spaces = chat.spaces.where(filter.matches).toList();
    return RefreshIndicator(
      color: ChatTheme.accent,
      onRefresh: chat.refreshSpaces,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(0, 10, 0, 180),
        itemCount: spaces.length + 2,
        itemBuilder: (context, i) {
          if (i == 0) return const SizedBox.shrink();
          if (i == 1) {
            return spaces.isEmpty
                ? const Padding(
                    padding: EdgeInsets.only(top: 80),
                    child: ChatNotice(title: 'گفتگوها', message: 'گفتگویی برای نمایش وجود ندارد.'),
                  )
                : const SizedBox.shrink();
          }
          return _SpaceTile(space: spaces[i - 2], myId: chat.userId);
        },
      ),
    );
  }

  /// The pencil: first choose whom to write to, the mentor or the support team.
  Future<void> _showContacts(BuildContext context) async {
    final navigator = Navigator.of(context);
    final mentorLike = Provider.of<AppRepository>(context, listen: false).currentUser.role.isMentorLike;
    final target = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            ListTile(
              leading: const Icon(Icons.person_rounded, color: ChatTheme.accent),
              title: Text(mentorLike ? 'پیام به اعضا' : 'پیام به راهبر', style: ChatTheme.body),
              onTap: () => Navigator.pop(ctx, 'mentor'),
            ),
            ListTile(
              leading: const Icon(Icons.support_agent_rounded, color: ChatTheme.accent),
              title: Text('پیام به پشتیبانی', style: ChatTheme.body),
              onTap: () => Navigator.pop(ctx, 'support'),
            ),
          ],
        ),
      ),
    );
    if (target == null || !context.mounted) return;
    if (target == 'support') {
      final space = await ChatRepository.instance.openSupport();
      if (space != null) {
        navigator.push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: space.id)));
      } else if (context.mounted) {
        AppToast.error(context, 'باز کردن گفتگو با پشتیبانی انجام نشد.');
      }
      return;
    }
    await _showPeople(context);
  }

  Future<void> _showPeople(BuildContext context) async {
    final navigator = Navigator.of(context);
    final contacts = await ChatRepository.instance.contacts();
    if (!context.mounted) return;
    if (contacts.isEmpty) {
      AppToast.info(context, 'فعلاً کسی برای گفتگوی خصوصی وجود ندارد.');
      return;
    }
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: ChatTheme.surfaceBottom,
      shape: ChatTheme.sheetShape,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            for (final person in contacts)
              ListTile(
                leading: SafeAvatar(imageUrl: person['avatarUrl'], name: person['name'] ?? '', radius: 18, gender: person['gender'], isMentor: AvatarCatalog.isMentorRole(person['role'])),
                title: Text(person['name'] ?? '', style: ChatTheme.body),
                onTap: () => Navigator.pop(ctx, person),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    final space = await ChatRepository.instance.openDirect(picked['id']);
    if (space != null) {
      navigator.push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: space.id)));
    }
  }
}

/// Golden header reaching under the status bar: logo, connection state, drawer button and the filter tabs.
class _ChatHeader extends StatelessWidget {
  final bool connected;
  final ChatFilter filter;
  final ValueChanged<ChatFilter> onFilter;

  const _ChatHeader({required this.connected, required this.filter, required this.onFilter});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final scaffold = Scaffold.maybeOf(context);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 10, 18, 14),
      decoration: ChatTheme.header,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              height: 42,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'NOPA',
                      style: AppTypography.logo.copyWith(color: ChatTheme.ink),
                    ),
                  ),
                  // RTL inside this LTR row, so the dots of "درحال اتصال..." sit on the left
                  Text(
                    connected ? 'شما متصل هستید' : 'درحال اتصال...',
                    textDirection: TextDirection.rtl,
                    style: AppTypography.h3,
                  ),
                  if (scaffold?.hasDrawer ?? false)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TapExpander(
                        child: GestureDetector(
                          onTap: scaffold!.openDrawer,
                          child: Container(
                            width: 42,
                            height: 42,
                            decoration: const BoxDecoration(color: ChatTheme.ink, shape: BoxShape.circle),
                            child: const Icon(Icons.menu_rounded, color: AppColors.textPoetry, size: 24),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          _FilterBar(filter: filter, onFilter: onFilter),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final ChatFilter filter;
  final ValueChanged<ChatFilter> onFilter;

  const _FilterBar({required this.filter, required this.onFilter});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      margin: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: ChatTheme.text,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          for (final f in ChatFilter.values)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onFilter(f),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // The open tab reads a little bigger and bolder
                    AnimatedScale(
                      scale: f == filter ? 1.14 : 1.0,
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOut,
                      child: Text(
                        f.label,
                        maxLines: 1,
                        style: AppTypography.bodyMedium.copyWith(
                          color: f == filter ? ChatTheme.ink : ChatTheme.muted,
                          fontWeight: f == filter ? FontWeight.w700 : null,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// One conversation row: avatar at the start, name and last message, then time and unread count or read ticks.
class _SpaceTile extends StatelessWidget {
  final ChatSpace space;
  final String? myId;
  const _SpaceTile({required this.space, required this.myId});

  static const double _avatarRadius = 22;

  bool get _mine => myId != null && space.previewSenderId == myId && space.preview.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final preview = space.preview.isEmpty
        ? 'هنوز پیامی ارسال نشده است'
        : ChatFormat.plain(space.isDirect || space.previewSender.isEmpty || _mine ? space.preview : '${space.previewSender}: ${space.preview}');
    final time = chatTimeLabel(space.lastActivity);
    final showBadge = space.unread > 0 && !space.muted;

    final ticks = Icon(
      space.isDirect && space.peerReadSeq >= space.lastSeq ? Icons.done_all_rounded : Icons.done_rounded,
      color: AppColors.emerald,
      size: 15,
    );
    final timeText = Text(time, style: ChatTheme.caption.copyWith(fontSize: 10));

    return TapExpander(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: space.id))),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  ChatRing(online: space.isDirect && space.peerOnline, child: ChatSpaceAvatar(space: space, radius: _avatarRadius)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(space.title, style: ChatTheme.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 4),
                        Text(
                          preview,
                          style: ChatTheme.caption.copyWith(color: showBadge ? ChatTheme.text.withValues(alpha: 0.8) : null),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  if (showBadge)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        timeText,
                        const SizedBox(height: 6),
                        Container(
                          constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: ChatTheme.accent, borderRadius: BorderRadius.circular(9)),
                          child: Text(
                            space.unread > 99 ? '99+' : '${space.unread}',
                            style: AppTypography.caption.copyWith(color: ChatTheme.surfaceBottom),
                          ),
                        ),
                      ],
                    )
                  else
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (space.muted) const Icon(Icons.notifications_off_rounded, color: ChatTheme.muted, size: 14),
                        if (_mine) ticks,
                        if (space.muted || _mine) const SizedBox(width: 4),
                        timeText,
                      ],
                    ),
                ],
              ),
            ),
            const ChatSeparator(indentStart: ChatTheme.gutter + _avatarRadius * 2 + 14),
          ],
        ),
      ),
    );
  }
}

/// Centered icon and text, for an empty or unavailable chat section.
class ChatNotice extends StatelessWidget {
  final String title;
  final String message;

  const ChatNotice({super.key, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                'assets/svg_icons/chat01.svg',
                width: 56,
                height: 56,
                colorFilter: const ColorFilter.mode(ChatTheme.lavender, BlendMode.srcIn),
              ),
              const SizedBox(height: 16),
              Text(title, style: ChatTheme.title.copyWith(fontSize: 16)),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center, style: ChatTheme.caption.copyWith(fontSize: 13, height: 1.7)),
            ],
          ),
        ),
      ),
    );
  }
}
