import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';

/// A quiz challenge («چالش تستی») inside its conversation. Members pick one option per question and send the
/// answers once; the server grades them and adds the reward. Whether an answer was right is never known on the
/// device before sending, and afterwards only the member sees their own right/wrong. The right option itself is
/// shown once the mentor closes the challenge. Mentors see the key and go to «اطلاعات» for everyone's results.
class ChatQuizPanel extends StatefulWidget {
  final String topicId;
  /// The challenge's status on the card ('open' | 'closed' | 'paid'): a change reloads the quiz.
  final String status;
  final VoidCallback onOpenResults;
  final Widget? header;

  const ChatQuizPanel({super.key, required this.topicId, required this.status, required this.onOpenResults, this.header});

  @override
  State<ChatQuizPanel> createState() => _ChatQuizPanelState();
}

class _ChatQuizPanelState extends State<ChatQuizPanel> {
  final ChatRepository _chat = ChatRepository.instance;
  Map<String, dynamic>? _data;
  String? _error;
  final Map<int, int> _picked = {};
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ChatQuizPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) _load();
  }

  Future<void> _load() async {
    final res = await _chat.api('GET', '/chat/topics/${widget.topicId}/quiz');
    if (!mounted) return;
    setState(() {
      if (res.ok && res.data is Map) {
        _data = Map<String, dynamic>.from(res.data as Map);
        _error = null;
      } else {
        _error = res.error.isNotEmpty ? res.error : 'آزمون بارگذاری نشد.';
      }
    });
  }

  List<Map<String, dynamic>> get _questions => ((_data?['questions'] as List?) ?? const []).map((q) => Map<String, dynamic>.from(q as Map)).toList();
  Map<String, dynamic>? get _mine => _data?['mine'] is Map ? Map<String, dynamic>.from(_data!['mine'] as Map) : null;
  bool get _moderator => _data?['moderator'] == true;
  bool get _canAnswer => _data?['canAnswer'] == true;

  Future<void> _submit() async {
    final questions = _questions;
    final blank = questions.length - _picked.length;
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('ثبت پاسخ‌ها', style: ChatTheme.title),
          content: Text(
            '${blank > 0 ? '$blank پرسش بی‌پاسخ مانده است. ' : ''}پاسخ‌ها فقط یک بار ثبت می‌شوند و پس از ثبت قابل تغییر نیستند.',
            style: ChatTheme.body,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('بازگشت', style: ChatTheme.caption.copyWith(color: ChatTheme.text))),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('ثبت نهایی', style: ChatTheme.title.copyWith(color: ChatTheme.accent))),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _sending = true);
    final res = await _chat.api('POST', '/chat/topics/${widget.topicId}/quiz', body: {
      'answers': [for (var i = 0; i < questions.length; i++) _picked[i] ?? -1],
    });
    if (!mounted) return;
    setState(() => _sending = false);
    if (!res.ok) {
      AppToast.error(context, res.error.isNotEmpty ? res.error : 'ثبت پاسخ انجام نشد. دوباره تلاش کنید.');
      await _load();
      return;
    }
    final r = Map<String, dynamic>.from(res.data as Map);
    final reward = (r['rewardAmount'] as num?)?.toInt() ?? 0;
    AppToast.success(
      context,
      'پاسخ‌های درست: ${r['score']} از ${r['total']}${reward > 0 ? ' · ${r['rewardLabel'] ?? ''} +$reward به حساب شما اضافه شد.' : ''}',
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[
      if (widget.header != null) widget.header!,
      if (_data == null && _error == null) const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator(color: ChatTheme.accent))),
      if (_error != null) _note(_error!, icon: Icons.error_outline_rounded),
      if (_data != null) ..._body(),
    ];
    return RefreshIndicator(
      color: ChatTheme.accent,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(ChatTheme.gutter, 6, ChatTheme.gutter, 16),
        children: children,
      ),
    );
  }

  List<Widget> _body() {
    final questions = _questions;
    final mine = _mine;
    final closed = (_data?['status'] ?? widget.status) != 'open';
    if (questions.isEmpty) return [_note('این چالش پرسشی ندارد.')];
    final results = ((mine?['results'] as List?) ?? const []).map((e) => e == true).toList();
    final picked = ((mine?['picked'] as List?) ?? const []).map((e) => (e as num).toInt()).toList();
    final correct = (mine?['correct'] as List?)?.map((e) => (e as num).toInt()).toList();

    return [
      if (_moderator) ...[
        _note('شما راهبر این چالش هستید؛ گزینه‌ی درست هر پرسش برای شما مشخص است و اعضا آن را نمی‌بینند. نتیجه‌ی شرکت‌کنندگان در «اطلاعات چالش» است.', icon: Icons.verified_rounded),
        Align(alignment: AlignmentDirectional.centerStart, child: _button('نتایج شرکت‌کنندگان', widget.onOpenResults, primary: false)),
        const SizedBox(height: 8),
      ] else if (mine != null)
        _summary(mine)
      else if (closed)
        _note('این چالش بسته شده است و دیگر پاسخ پذیرفته نمی‌شود.', icon: Icons.lock_rounded)
      else if (!_canAnswer)
        _note('زمان شرکت در این آزمون نرسیده یا به پایان رسیده است.', icon: Icons.schedule_rounded)
      else
        _note('برای هر پرسش یک گزینه را انتخاب کنید و در پایان «ثبت پاسخ‌ها» را بزنید. پاسخ‌ها یک بار ثبت می‌شوند و امتیاز خودکار به حسابتان اضافه می‌شود.', icon: Icons.quiz_rounded),
      for (var i = 0; i < questions.length; i++)
        _question(
          i,
          questions[i],
          picked: mine != null ? (i < picked.length ? picked[i] : -1) : _picked[i],
          right: mine != null && i < results.length ? results[i] : null,
          correctIndex: _moderator ? (questions[i]['correct'] as num?)?.toInt() : (correct != null && i < correct.length ? correct[i] : null),
          enabled: !_moderator && mine == null && _canAnswer && !_sending,
        ),
      if (!_moderator && mine == null && _canAnswer)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: SizedBox(
            width: double.infinity,
            child: _button(_sending ? 'در حال ثبت…' : 'ثبت پاسخ‌ها (${_picked.length} از ${questions.length})', _sending || _picked.isEmpty ? null : _submit),
          ),
        ),
    ];
  }

  Widget _summary(Map<String, dynamic> mine) {
    final score = (mine['score'] as num?)?.toInt() ?? 0;
    final total = (mine['total'] as num?)?.toInt() ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: true),
      child: Row(children: [
        const Icon(Icons.task_alt_rounded, color: ChatTheme.accent),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('پاسخ شما ثبت شد: $score پاسخ درست از $total', style: ChatTheme.title),
            Text('ثبت: ${chatDateText(mine['submittedAt'])}', style: ChatTheme.caption),
            Text(
              mine['correct'] == null ? 'درست یا نادرست بودن هر پاسخ فقط برای شما نمایش داده می‌شود؛ گزینه‌ی درست پس از بسته‌شدن چالش نمایش داده می‌شود.' : 'چالش بسته شده است؛ گزینه‌ی درست هر پرسش مشخص شده است.',
              style: ChatTheme.caption,
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _question(int index, Map<String, dynamic> q, {int? picked, bool? right, int? correctIndex, required bool enabled}) {
    final options = ((q['options'] as List?) ?? const []).map((o) => o.toString()).toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text('${index + 1}. ${q['q'] ?? ''}', style: ChatTheme.title)),
            if (right != null)
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 6),
                child: ChatChip(label: right ? 'درست' : 'نادرست', color: right ? AppColors.emerald : ChatTheme.danger, filled: true),
              ),
          ]),
          const SizedBox(height: 8),
          for (var o = 0; o < options.length; o++) _option(index, o, options[o], selected: picked == o, right: picked == o ? right : null, isCorrect: correctIndex == o, enabled: enabled),
        ],
      ),
    );
  }

  Widget _option(int question, int option, String text, {required bool selected, bool? right, required bool isCorrect, required bool enabled}) {
    final Color edge = right == true || (isCorrect && right == null && !selected)
        ? AppColors.emerald
        : (right == false ? ChatTheme.danger : (selected ? ChatTheme.accent : ChatTheme.stroke));
    final IconData icon = right == true
        ? Icons.check_circle_rounded
        : (right == false ? Icons.cancel_rounded : (selected ? Icons.radio_button_checked_rounded : (isCorrect ? Icons.check_circle_outline_rounded : Icons.radio_button_unchecked_rounded)));
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled ? () => setState(() => _picked[question] = option) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: edge.withValues(alpha: selected || isCorrect ? 0.14 : 0.04),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: edge.withValues(alpha: selected || isCorrect ? 0.9 : 0.45)),
        ),
        child: Row(children: [
          Icon(icon, size: 18, color: edge == ChatTheme.stroke ? ChatTheme.muted : edge),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: ChatTheme.body)),
          if (isCorrect && !selected) Text('گزینه‌ی درست', style: ChatTheme.caption.copyWith(color: AppColors.emerald)),
        ]),
      ),
    );
  }

  Widget _note(String text, {IconData icon = Icons.info_outline_rounded}) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: ChatTheme.feedback,
          borderRadius: BorderRadius.circular(ChatTheme.radius),
          border: Border.all(color: ChatTheme.stroke.withValues(alpha: 0.6)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 18, color: ChatTheme.feedbackText.withValues(alpha: 0.85)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: ChatTheme.body.copyWith(color: ChatTheme.feedbackText, fontSize: 13))),
        ]),
      );

  Widget _button(String label, VoidCallback? onPressed, {bool primary = true}) => TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          backgroundColor: primary ? ChatTheme.accent : Colors.transparent,
          disabledBackgroundColor: primary ? ChatTheme.accent.withValues(alpha: 0.35) : null,
          foregroundColor: primary ? ChatTheme.surfaceBottom : ChatTheme.accent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ChatTheme.radius), side: BorderSide(color: ChatTheme.accent.withValues(alpha: 0.6))),
        ),
        child: Text(label, style: TextStyle(fontFamily: ChatTheme.title.fontFamily, fontSize: 13, fontWeight: FontWeight.bold, color: primary ? ChatTheme.surfaceBottom : ChatTheme.accent)),
      );
}
