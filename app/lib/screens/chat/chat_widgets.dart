import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/tap_expander.dart';

/// Icon standing for a space that has no face of its own.
IconData chatSpaceIcon(String type) => switch (type) {
      'announcements' => Icons.campaign_rounded,
      'arena' => Icons.emoji_events_rounded,
      'public' => Icons.forum_rounded,
      'mentors' => Icons.groups_rounded,
      'challenges' => Icons.local_fire_department_rounded,
      'support' => Icons.support_agent_rounded,
      _ => Icons.diversity_3_rounded,
    };

/// A thin gold ring around an avatar, with an optional green dot for someone online.
class ChatRing extends StatelessWidget {
  final Widget child;
  final bool online;
  final double width;
  const ChatRing({super.key, required this.child, this.online = false, this.width = 1});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.all(1.5),
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ChatTheme.accent.withValues(alpha: 0.6), width: width)),
          child: child,
        ),
        if (online)
          PositionedDirectional(
            end: 1,
            bottom: 1,
            child: Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(color: ChatTheme.online, shape: BoxShape.circle, border: Border.all(color: ChatTheme.surfaceBottom, width: 2)),
            ),
          ),
      ],
    );
  }
}

/// A space's face: the other person in a private chat, otherwise the icon of its kind.
class ChatSpaceAvatar extends StatelessWidget {
  final ChatSpace space;
  final double radius;
  const ChatSpaceAvatar({super.key, required this.space, this.radius = 22});

  @override
  Widget build(BuildContext context) {
    if (space.isDirect) {
      return SafeAvatar(imageUrl: space.peerAvatarUrl, name: space.title, radius: radius, gender: space.peerGender, isMentor: space.peerIsMentor);
    }
    return ChatIconAvatar(icon: chatSpaceIcon(space.type), radius: radius);
  }
}

class ChatIconAvatar extends StatelessWidget {
  final IconData icon;
  final double radius;
  const ChatIconAvatar({super.key, required this.icon, this.radius = 22});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ChatTheme.mineFill, ChatTheme.surfaceTop]),
      ),
      child: Icon(icon, color: ChatTheme.lavender, size: radius),
    );
  }
}

/// Golden header of a pushed chat screen: back arrow at the left, [leading] content on the right and
/// optional [actions] next to the back arrow. It reaches under the status bar.
class ChatGoldHeader extends StatelessWidget {
  final Widget child;
  final List<Widget> actions;
  final VoidCallback? onBack;
  const ChatGoldHeader({super.key, required this.child, this.actions = const [], this.onBack});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(ChatTheme.gutter - 6, top + 8, ChatTheme.gutter, 12),
      decoration: ChatTheme.header,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          children: [
            Expanded(child: child),
            ...actions,
            TapExpander(
              child: IconButton(
                onPressed: onBack ?? () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_forward_rounded, color: ChatTheme.ink, size: 26),
                tooltip: 'بازگشت',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Name and a line under it, as the header of a conversation or profile shows them.
class ChatHeaderTitle extends StatelessWidget {
  final Widget avatar;
  final String title;
  final String subtitle;
  final Color? subtitleColor;
  final VoidCallback? onTap;
  const ChatHeaderTitle({super.key, required this.avatar, required this.title, required this.subtitle, this.subtitleColor, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Row(
        children: [
          avatar,
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTypography.h3),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(color: subtitleColor ?? ChatTheme.ink.withValues(alpha: 0.65)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Thin line under a row's text, fading away towards the far edge.
class ChatSeparator extends StatelessWidget {
  final double indentStart;
  const ChatSeparator({super.key, this.indentStart = ChatTheme.gutter});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      margin: EdgeInsetsDirectional.only(start: indentStart, end: ChatTheme.gutter),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.centerStart,
          end: AlignmentDirectional.centerEnd,
          colors: [ChatTheme.stroke.withValues(alpha: 0.2), ChatTheme.stroke.withValues(alpha: 0.7), ChatTheme.stroke.withValues(alpha: 0)],
          stops: const [0, 0.35, 1],
        ),
      ),
    );
  }
}

/// "HH:mm" today, "دیروز", a weekday this week, otherwise month/day.
String chatTimeLabel(DateTime? at) {
  if (at == null) return '';
  final local = at.toLocal();
  final now = DateTime.now();
  String two(int n) => n.toString().padLeft(2, '0');
  if (local.year == now.year && local.month == now.month && local.day == now.day) return '${two(local.hour)}:${two(local.minute)}';
  final days = DateTime(now.year, now.month, now.day).difference(DateTime(local.year, local.month, local.day)).inDays;
  if (days == 1) return 'دیروز';
  if (days < 7) return const ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه'][local.weekday - 1];
  return '${local.month}/${local.day}';
}

/// A chat sub-page (groups, challenge info, dashboard...): the chat's golden header with the same back arrow
/// as a conversation, over the app's background.
class ChatPageScaffold extends StatelessWidget {
  final String title;
  final Widget body;
  final List<Widget> actions;
  const ChatPageScaffold({super.key, required this.title, required this.body, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: AppColors.screenBackgroundGradient,
        image: DecorationImage(image: AssetImage('assets/images/login_bg.png'), fit: BoxFit.cover),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Column(
          children: [
            ChatGoldHeader(
              actions: actions,
              child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTypography.h3),
            ),
            Expanded(child: SafeArea(top: false, child: body)),
          ],
        ),
      ),
    );
  }
}
