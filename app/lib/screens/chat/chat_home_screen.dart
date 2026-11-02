import 'package:flutter/material.dart' hide Text;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_conversation_screen.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/tap_expander.dart';

/// Chat tab: every conversation the user has, channels first.
class ChatHomeScreen extends StatelessWidget {
  const ChatHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final chat = ChatRepository.instance;
    return ListenableBuilder(
      listenable: chat,
      builder: (context, _) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Stack(
            children: [
              if (chat.spaces.isEmpty)
                chat.loadingSpaces
                    ? const Center(child: CircularProgressIndicator(color: ChatTheme.accent))
                    : const ChatNotice(title: 'گفتگوها', message: 'گفتگویی برای نمایش وجود ندارد.')
              else
                RefreshIndicator(
                  color: ChatTheme.accent,
                  onRefresh: chat.refreshSpaces,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 84),
                    itemCount: chat.spaces.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) => _SpaceTile(space: chat.spaces[i]),
                  ),
                ),
              if (Provider.of<AppRepository>(context, listen: false).currentUser.role.isMentorLike)
                Positioned(
                  left: 16,
                  bottom: 68,
                  child: FloatingActionButton.small(
                    heroTag: 'chat-dashboard',
                    backgroundColor: ChatTheme.surfaceTop,
                    foregroundColor: ChatTheme.accent,
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChatDashboardScreen())),
                    child: const Icon(Icons.dashboard_rounded, size: 20),
                  ),
                ),
              Positioned(
                left: 16,
                bottom: 16,
                child: FloatingActionButton.small(
                  heroTag: 'chat-new',
                  backgroundColor: ChatTheme.accent,
                  foregroundColor: ChatTheme.surfaceBottom,
                  onPressed: () => _showContacts(context),
                  child: const Icon(Icons.edit_rounded, size: 20),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showContacts(BuildContext context) async {
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            for (final person in contacts)
              ListTile(
                leading: SafeAvatar(imageUrl: person['avatarUrl'], name: person['name'] ?? '', radius: 18, gender: person['gender'], isMentor: person['role'] == 'mentor'),
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

class _SpaceTile extends StatelessWidget {
  final ChatSpace space;
  const _SpaceTile({required this.space});

  IconData get _icon => switch (space.type) {
        'announcements' => Icons.campaign_rounded,
        'arena' => Icons.emoji_events_rounded,
        'public' => Icons.forum_rounded,
        'mentors' => Icons.groups_rounded,
        'challenges' => Icons.local_fire_department_rounded,
        'media' => Icons.perm_media_rounded,
        'support' => Icons.support_agent_rounded,
        _ => Icons.diversity_3_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final preview = space.preview.isEmpty ? 'هنوز پیامی ارسال نشده است' : (space.previewSender.isEmpty ? space.preview : '${space.previewSender}: ${space.preview}');
    return TapExpander(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatConversationScreen(spaceId: space.id))),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: ChatTheme.card(highlighted: space.unread > 0 && !space.muted),
          child: Row(
            children: [
              space.isDirect
                  ? SafeAvatar(imageUrl: space.peerAvatarUrl, name: space.title, radius: 21, gender: space.peerGender, isMentor: space.peerIsMentor)
                  : Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: ChatTheme.lavender.withValues(alpha: 0.16)),
                      child: Icon(_icon, color: ChatTheme.lavender, size: 22),
                    ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(space.title, style: ChatTheme.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 3),
                    Text(preview, style: ChatTheme.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              if (space.muted)
                const Icon(Icons.notifications_off_rounded, color: ChatTheme.muted, size: 16)
              else if (space.unread > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: ChatTheme.accent, borderRadius: BorderRadius.circular(10)),
                  child: Text(
                    space.unread > 99 ? '99+' : '${space.unread}',
                    style: const TextStyle(color: ChatTheme.surfaceBottom, fontFamily: AppTheme.fontFamily, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
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
