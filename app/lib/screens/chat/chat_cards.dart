import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/schedule_utils.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/widgets/fa_text.dart';

/// A coloured label, the shape of every tag in chat.
class ChatChip extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  /// Solid colour with white text: the mentor's chips, readable on gold and on lavender alike.
  final bool filled;
  const ChatChip({super.key, required this.label, this.color = ChatTheme.lavender, this.icon, this.filled = false});

  /// The mark of a mentor: blue, with the badge.
  const ChatChip.mentor({super.key, required this.label}) : color = ChatTheme.mentor, icon = ChatTheme.mentorBadge, filled = true;

  static Color parse(String hex) => Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));

  @override
  Widget build(BuildContext context) {
    final fg = filled ? Colors.white : color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: filled ? 1 : 0.55)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: fg), const SizedBox(width: 3)],
        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChatTheme.caption.copyWith(color: fg, fontWeight: FontWeight.bold))),
      ]),
    );
  }
}

String chatDateText(dynamic value) {
  return ScheduleUtils.formatDateTime(value?.toString()) ?? '';
}

const Map<String, String> topicStatusLabels = {'open': 'باز', 'closed': 'بسته', 'paid': 'پرداخت‌شده'};

/// A challenge in a conversation: its type, station, creator, deadline and reward.
class ChallengeCard extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback onOpenThread;
  final VoidCallback onOpenInfo;
  final VoidCallback onOpenChallenge;

  const ChallengeCard({super.key, required this.message, required this.onOpenThread, required this.onOpenInfo, required this.onOpenChallenge});

  @override
  Widget build(BuildContext context) {
    final meta = message.meta ?? const {};
    final status = message.topicStatus ?? 'open';
    final tagColor = switch (meta['category']) {
      'individual' => ChatTheme.lavender,
      'inter_group' => ChatTheme.danger,
      _ => ChatTheme.accent,
    };
    Widget line(String label, dynamic value) => (value == null || value.toString().isEmpty)
        ? const SizedBox.shrink()
        : Padding(padding: const EdgeInsets.only(top: 3), child: Text('$label: $value', style: ChatTheme.caption));

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: status == 'open'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ChatChip(label: meta['tag']?.toString() ?? 'چالش', color: tagColor),
              const Spacer(),
              ChatChip(label: topicStatusLabels[status] ?? status, color: status == 'open' ? ChatTheme.accent : ChatTheme.muted),
            ],
          ),
          const SizedBox(height: 8),
          Text(meta['title']?.toString() ?? message.body, style: ChatTheme.title),
          if ((meta['description'] ?? '').toString().isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 3), child: Text(meta['description'].toString(), style: ChatTheme.caption.copyWith(fontSize: 12), maxLines: 3, overflow: TextOverflow.ellipsis)),
          line('منزلگاه', meta['stationTitle']),
          line('ایجادکننده', meta['creatorName']),
          line('مهلت', meta['dueDate'] == null ? null : chatDateText(meta['dueDate'])),
          line('جایزه', meta['reward']),
          line('پاسخ نهایی گروه', meta['finalAnswer']),
          const SizedBox(height: 8),
          Row(
            children: [
              _action(Icons.forum_rounded, message.threadReplies > 0 ? '${message.threadReplies} پیام' : 'ورود به گفتگو', onOpenThread),
              const SizedBox(width: 14),
              _action(Icons.info_outline_rounded, 'اطلاعات', onOpenInfo),
              const SizedBox(width: 14),
              _action(Icons.local_fire_department_rounded, 'جزئیات چالش', onOpenChallenge),
            ],
          ),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback onTap) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: ChatTheme.accent),
            const SizedBox(width: 3),
            Text(label, style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
          ],
        ),
      );
}

/// The start of a station, doubling as the divider between stations in a conversation.
class StationCard extends StatelessWidget {
  final ChatMessage message;
  const StationCard({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final meta = message.meta ?? const {};
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: true),
      child: Column(
        children: [
          const Icon(Icons.flag_rounded, color: ChatTheme.accent),
          const SizedBox(height: 4),
          Text('ورود به منزلگاه ${meta['title'] ?? ''}', style: ChatTheme.title, textAlign: TextAlign.center),
          if ((meta['subtitle'] ?? '').toString().isNotEmpty) Text(meta['subtitle'].toString(), style: ChatTheme.caption, textAlign: TextAlign.center),
          if ((meta['stayDuration'] ?? '').toString().isNotEmpty) Text('مدت: ${meta['stayDuration']}', style: ChatTheme.caption),
          if ((meta['description'] ?? '').toString().isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 4), child: Text(meta['description'].toString(), style: ChatTheme.caption.copyWith(fontSize: 12), textAlign: TextAlign.center)),
        ],
      ),
    );
  }
}

/// Results of an inter-group challenge: places first, then what was good in each work.
class ResultCard extends StatelessWidget {
  final ChatMessage message;
  const ResultCard({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final meta = message.meta ?? const {};
    final places = (meta['places'] as List?) ?? const [];
    final strengths = (meta['strengths'] as List?) ?? const [];
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('نتیجه‌ی ${meta['title'] ?? ''}', style: ChatTheme.title),
          const SizedBox(height: 6),
          for (final p in places) Text('رتبه‌ی ${p['place']}: ${p['name']}', style: ChatTheme.body),
          if (strengths.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('نکته‌های خوب آثار', style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
            for (final s in strengths) Text('${s['name']}: ${s['strength']}', style: ChatTheme.caption.copyWith(fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class PollCard extends StatelessWidget {
  final ChatMessage message;
  final String myId;
  final void Function(int option) onVote;

  const PollCard({super.key, required this.message, required this.myId, required this.onVote});

  @override
  Widget build(BuildContext context) {
    final meta = message.meta ?? const {};
    final options = (meta['options'] as List?)?.map((o) => o.toString()).toList() ?? const <String>[];
    final votes = message.pollVotes;
    final total = votes.length;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(meta['question']?.toString() ?? message.body, style: ChatTheme.title),
          const SizedBox(height: 8),
          for (var i = 0; i < options.length; i++)
            Builder(builder: (context) {
              final count = votes.where((v) => v['option'] == i).length;
              final mine = votes.any((v) => v['option'] == i && v['userId'] == myId);
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onVote(i),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(mine ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded, size: 15, color: ChatTheme.accent),
                          const SizedBox(width: 6),
                          Expanded(child: Text(options[i], style: ChatTheme.body)),
                          Text('$count', style: ChatTheme.caption),
                        ],
                      ),
                      const SizedBox(height: 3),
                      LinearProgressIndicator(value: total == 0 ? 0 : count / total, color: ChatTheme.accent, backgroundColor: ChatTheme.stroke.withValues(alpha: 0.3)),
                    ],
                  ),
                ),
              );
            }),
          Text('$total رأی', style: ChatTheme.caption),
        ],
      ),
    );
  }
}
