import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_conversation_screen.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_typography.dart';

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
    // Same pill as the "مشاهده" / "شرکت" button next to it, only smaller.
    return TapExpander(child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.buttonCamel.withValues(alpha: 0.85), width: 1.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.forum_rounded, size: 11, color: Color(0xFFF4DCC5)),
            const SizedBox(width: 4),
            Text('ورود به گفتگوی چالش', style: AppTypography.captionGold.copyWith(fontSize: 9.5)),
          ],
        ),
      ),
    ));
  }
}
