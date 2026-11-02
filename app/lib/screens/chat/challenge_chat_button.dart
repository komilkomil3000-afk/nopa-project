import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_conversation_screen.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// From a challenge to its conversation. Shown only while chat is available.
class ChallengeChatButton extends StatelessWidget {
  final String challengeId;
  const ChallengeChatButton({super.key, required this.challengeId});

  Future<void> _open(BuildContext context) async {
    final navigator = Navigator.of(context);
    final chat = ChatRepository.instance;
    final res = await chat.api('GET', '/chat/topics/by-challenge/$challengeId');
    if (!context.mounted) return;
    if (!res.ok) {
      AppToast.info(context, 'گفتگوی این چالش هنوز باز نشده است.');
      return;
    }
    final data = res.data as Map;
    await navigator.push(MaterialPageRoute(
      builder: (_) => ChatConversationScreen(
        spaceId: data['spaceId'] as String,
        threadRoot: ChatMessage.fromJson(Map<String, dynamic>.from(data['message'] as Map)),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (!Provider.of<AppRepository>(context, listen: false).currentUser.chatEnabled) return const SizedBox.shrink();
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(context),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.forum_rounded, size: 16, color: ChatTheme.accent),
            const SizedBox(width: 5),
            Text('ورود به گفتگوی چالش', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
