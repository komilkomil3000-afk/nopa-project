import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';

/// «اطلاعات چالش» of a quiz. The mentor closes or reopens it and sees everyone's answers, right and wrong, with when
/// they took part and who they are, and who has not taken it yet. A member sees only their own result.
class ChatQuizResults extends StatefulWidget {
  final String topicId;
  final bool moderator;
  final void Function(String userId) onOpenMember;
  const ChatQuizResults({super.key, required this.topicId, required this.moderator, required this.onOpenMember});

  @override
  State<ChatQuizResults> createState() => _ChatQuizResultsState();
}

class _ChatQuizResultsState extends State<ChatQuizResults> {
  final ChatRepository _chat = ChatRepository.instance;
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final path = widget.moderator ? '/chat/topics/${widget.topicId}/quiz/results' : '/chat/topics/${widget.topicId}/quiz';
    final res = await _chat.api('GET', path);
    if (!mounted) return;
    setState(() {
      if (res.ok && res.data is Map) {
        _data = Map<String, dynamic>.from(res.data as Map);
        _error = null;
      } else {
        _error = res.error.isNotEmpty ? res.error : 'نتیجه‌ها بارگذاری نشد.';
      }
    });
  }

  Future<void> _setOpen(bool open) async {
    if (!open) {
      final ok = await showNopaDialog<bool>(
        context: context,
        builder: (ctx) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: ChatTheme.surfaceBottom,
            shape: ChatTheme.dialogShape,
            title: Text('بستن چالش تستی', style: ChatTheme.title),
            content: Text('پس از بستن، کسی نمی‌تواند پاسخ ثبت کند و گزینه‌ی درست هر پرسش برای شرکت‌کنندگان نمایش داده می‌شود.', style: ChatTheme.body),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('انصراف', style: ChatTheme.caption.copyWith(color: ChatTheme.text))),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('بستن چالش', style: ChatTheme.title.copyWith(color: ChatTheme.accent))),
            ],
          ),
        ),
      );
      if (ok != true || !mounted) return;
    }
    setState(() => _busy = true);
    final res = await _chat.api('POST', '/chat/topics/${widget.topicId}/${open ? 'reopen' : 'close'}');
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok) {
      AppToast.success(context, open ? 'چالش دوباره باز شد.' : 'چالش بسته شد.');
      await _load();
    } else {
      AppToast.error(context, res.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Text(_error!, style: ChatTheme.caption.copyWith(fontSize: 13));
    if (_data == null) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: ChatTheme.accent)));
    return widget.moderator ? _mentor() : _student();
  }

  Widget _student() {
    final mine = _data?['mine'] is Map ? Map<String, dynamic>.from(_data!['mine'] as Map) : null;
    if (mine == null) {
      return Text(
        _data?['canAnswer'] == true ? 'هنوز در این آزمون شرکت نکرده‌اید؛ از «ورود به چالش تستی» زیر پیام چالش پاسخ دهید.' : 'شما در این آزمون شرکت نکرده‌اید.',
        style: ChatTheme.caption.copyWith(fontSize: 13),
      );
    }
    final results = ((mine['results'] as List?) ?? const []).map((e) => e == true).toList();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: true),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${mine['score']} پاسخ درست از ${mine['total']}', style: ChatTheme.title.copyWith(color: ChatTheme.accent, fontSize: 16)),
        Text('تاریخ شرکت: ${chatDateText(mine['submittedAt'])}', style: ChatTheme.caption),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (var i = 0; i < results.length; i++)
            ChatChip(label: 'پرسش ${i + 1}: ${results[i] ? 'درست' : 'نادرست'}', color: results[i] ? AppColors.emerald : ChatTheme.danger),
        ]),
      ]),
    );
  }

  Widget _mentor() {
    final status = _data?['status']?.toString() ?? 'open';
    final rows = ((_data?['rows'] as List?) ?? const []).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    final questions = ((_data?['questions'] as List?) ?? const []).map((q) => Map<String, dynamic>.from(q as Map)).toList();
    final notTaken = ((_data?['notTaken'] as List?) ?? const []).map((u) => Map<String, dynamic>.from(u as Map)).toList();
    final total = questions.length;
    final perfect = rows.where((r) => r['score'] == total).length;
    final shown = switch (_filter) {
      'perfect' => rows.where((r) => r['score'] == total).toList(),
      'wrong' => rows.where((r) => ((r['score'] as num?) ?? 0) < total).toList(),
      _ => rows,
    };
    final average = rows.isEmpty ? 0 : rows.fold<num>(0, (s, r) => s + ((r['score'] as num?) ?? 0)) / rows.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (status == 'open') _btn('بستن چالش', _busy ? null : () => _setOpen(false)),
          if (status != 'open') _btn('بازکردن دوباره', _busy ? null : () => _setOpen(true), primary: false),
          _btn('به‌روزرسانی', _busy ? null : _load, primary: false),
        ]),
        const SizedBox(height: 10),
        Text('امتیاز هر شرکت‌کننده بلافاصله پس از ثبت پاسخ، به نسبت پاسخ‌های درست به حسابش اضافه شده است.', style: ChatTheme.caption.copyWith(fontSize: 12.5)),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: ChatTheme.card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('خلاصه', style: ChatTheme.title),
            const SizedBox(height: 4),
            Text(
              '${rows.length} نفر شرکت کرده‌اند · ${notTaken.length} نفر هنوز نه · همه‌ی پاسخ‌ها درست: $perfect نفر · میانگین ${average.toStringAsFixed(1)} از $total',
              style: ChatTheme.caption.copyWith(color: ChatTheme.text),
            ),
            const SizedBox(height: 6),
            for (var i = 0; i < questions.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'پرسش ${i + 1}: ${questions[i]['rightCount']} درست از ${rows.length} · گزینه‌ی درست: ${_optionText(questions[i], (questions[i]['correct'] as num?)?.toInt())}',
                  style: ChatTheme.caption,
                ),
              ),
          ]),
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 6, children: [
          for (final f in const {'all': 'همه', 'perfect': 'همه درست', 'wrong': 'دارای پاسخ نادرست'}.entries)
            ChoiceChip(
              label: Text(f.value, style: ChatTheme.caption.copyWith(color: _filter == f.key ? ChatTheme.surfaceBottom : ChatTheme.text)),
              selected: _filter == f.key,
              showCheckmark: false,
              selectedColor: ChatTheme.accent,
              backgroundColor: Colors.transparent,
              onSelected: (_) => setState(() => _filter = f.key),
            ),
        ]),
        const SizedBox(height: 8),
        if (rows.isEmpty) Text('هنوز کسی در این آزمون شرکت نکرده است.', style: ChatTheme.caption.copyWith(fontSize: 13)),
        for (final r in shown) _row(r, questions),
        if (notTaken.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('شرکت‌نکرده‌ها (${notTaken.length})', style: ChatTheme.title),
          const SizedBox(height: 4),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final u in notTaken)
              GestureDetector(onTap: () => widget.onOpenMember(u['id'].toString()), child: ChatChip(label: u['name']?.toString() ?? '', color: ChatTheme.muted)),
          ]),
        ],
      ],
    );
  }

  String _optionText(Map<String, dynamic> q, int? index) {
    final options = (q['options'] as List?) ?? const [];
    if (index == null || index < 0 || index >= options.length) return '-';
    return options[index].toString();
  }

  Widget _row(Map<String, dynamic> r, List<Map<String, dynamic>> questions) {
    final user = Map<String, dynamic>.from((r['user'] as Map?) ?? const {});
    final answers = ((r['answers'] as List?) ?? const []).map((a) => Map<String, dynamic>.from(a as Map)).toList();
    final reward = (r['reward'] as num?)?.toInt() ?? 0;
    final allRight = r['score'] == r['total'];
    final facts = [
      if ((user['caravanName'] ?? '').toString().isNotEmpty) 'کاروان ${user['caravanName']}',
      if ((user['phoneNumber'] ?? '').toString().isNotEmpty) user['phoneNumber'].toString(),
      'شرکت: ${chatDateText(r['submittedAt'])}',
      if (reward > 0) 'پاداش: $reward ${_data?['rewardLabel'] ?? ''}',
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: ChatTheme.card(),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          iconColor: ChatTheme.accent,
          collapsedIconColor: ChatTheme.muted,
          title: GestureDetector(
            onTap: user['id'] == null ? null : () => widget.onOpenMember(user['id'].toString()),
            child: Text(user['name']?.toString() ?? '', style: ChatTheme.title),
          ),
          subtitle: Text(facts.join(' · '), style: ChatTheme.caption),
          leading: ChatChip(label: '${r['score']} از ${r['total']}', color: allRight ? AppColors.emerald : ChatTheme.accent, filled: allRight),
          children: [
            for (var i = 0; i < answers.length && i < questions.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(
                    answers[i]['correct'] == true ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    size: 16,
                    color: answers[i]['correct'] == true ? AppColors.emerald : ChatTheme.danger,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${i + 1}. ${questions[i]['q'] ?? ''}\n'
                      'پاسخ: ${answers[i]['pickedText'] ?? 'بی‌پاسخ'}'
                      '${answers[i]['correct'] == true ? '' : ' · درست: ${_optionText(questions[i], (questions[i]['correct'] as num?)?.toInt())}'}',
                      style: ChatTheme.caption.copyWith(color: ChatTheme.text),
                    ),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }

  Widget _btn(String label, VoidCallback? onPressed, {bool primary = true}) => TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: primary ? ChatTheme.accent : Colors.transparent,
          foregroundColor: primary ? ChatTheme.surfaceBottom : ChatTheme.accent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ChatTheme.radius), side: BorderSide(color: ChatTheme.accent.withValues(alpha: 0.6))),
        ),
        child: Text(
          label,
          style: TextStyle(fontFamily: ChatTheme.title.fontFamily, fontSize: 12.5, fontWeight: FontWeight.bold, color: primary ? ChatTheme.surfaceBottom : ChatTheme.accent),
        ),
      );
}
