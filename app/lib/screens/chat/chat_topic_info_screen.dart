import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:nopa_app/core/avatar_catalog.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/screens/chat/chat_profile_screen.dart';
import 'package:nopa_app/screens/chat/chat_quiz_results.dart';
import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:url_launcher/url_launcher.dart';

/// How much a person took part, as the mentor judges it: a name that stands for a fixed percentage.
const Map<String, ({String label, int percent})> participationLevels = {
  'flagbearer': (label: 'پرچمدار', percent: 100),
  'active': (label: 'فعال', percent: 75),
  'semi': (label: 'نیمه‌فعال', percent: 50),
  'companion': (label: 'همراه', percent: 25),
  'tired': (label: 'خسته', percent: 0),
};
final Map<String, String> tierLabels = {for (final e in participationLevels.entries) e.key: '${e.value.label} (${e.value.percent}٪)'};

/// The share of an amount a status earns, always rounded up to a whole unit.
int participationShare(int amount, String status) => ((amount * (participationLevels[status]?.percent ?? 0)) / 100).ceil();

InputDecoration chatField(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: ChatTheme.caption,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(ChatTheme.radius), borderSide: BorderSide(color: ChatTheme.stroke.withValues(alpha: 0.55))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(ChatTheme.radius), borderSide: const BorderSide(color: ChatTheme.accent)),
    );

class ChatButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  const ChatButton({super.key, required this.label, required this.onPressed, this.primary = true});

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        backgroundColor: primary ? ChatTheme.accent : Colors.transparent,
        foregroundColor: primary ? ChatTheme.surfaceBottom : ChatTheme.accent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ChatTheme.radius), side: BorderSide(color: ChatTheme.accent.withValues(alpha: 0.6))),
      ),
      child: Text(label, style: TextStyle(fontFamily: ChatTheme.title.fontFamily, fontSize: 12.5, fontWeight: FontWeight.bold)),
    );
  }
}

/// «اطلاعات چت»: closing, evaluation and payment for the mentor, the personal result for a student.
class ChatTopicInfoScreen extends StatefulWidget {
  final ChatMessage card;
  final bool moderator;
  final String spaceId;

  const ChatTopicInfoScreen({super.key, required this.card, required this.moderator, required this.spaceId});

  @override
  State<ChatTopicInfoScreen> createState() => _ChatTopicInfoScreenState();
}

class _ChatTopicInfoScreenState extends State<ChatTopicInfoScreen> {
  final ChatRepository _chat = ChatRepository.instance;
  Map<String, dynamic>? _evaluation;
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _myAnswer;
  Map<String, dynamic>? _insight;
  final Map<String, String> _statuses = {};
  final Map<String, TextEditingController> _reasons = {};
  bool _busy = false;
  bool _loading = true;

  String get _topicId => widget.card.topicId!;
  bool get _interGroup => widget.card.meta?['category'] == 'inter_group';
  String get _challengeId => widget.card.meta?['challengeId']?.toString() ?? '';
  bool get _quiz => widget.card.topicQuiz;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _reasons.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    if (_quiz) {
      // ChatQuizResults loads its own data
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (widget.moderator) {
      final evaluation = await _chat.api('GET', '/chat/topics/$_topicId/evaluation');
      final insight = await _chat.api('GET', '/chat/topics/$_topicId/insight');
      if (!mounted) return;
      setState(() {
        if (evaluation.ok) {
          _evaluation = Map<String, dynamic>.from(evaluation.data as Map);
          for (final row in _rows) {
            final id = row['userId'] as String;
            _statuses[id] = row['status']?.toString() ?? 'tired';
            _reasons.putIfAbsent(id, () => TextEditingController(text: row['reason'] ?? ''));
          }
        }
        if (insight.ok && insight.data is Map) _insight = Map<String, dynamic>.from(insight.data as Map);
      });
    } else {
      final report = await _chat.api('GET', '/chat/topics/$_topicId/my-report');
      final mine = await _chat.api('GET', '/chat/topics/$_topicId/my-answer');
      if (mounted) {
        setState(() {
          if (report.ok) _report = Map<String, dynamic>.from(report.data as Map);
          if (mine.ok && mine.data is Map) _myAnswer = Map<String, dynamic>.from(mine.data as Map);
        });
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _rows => ((_evaluation?['rows'] as List?) ?? const []).map((r) => Map<String, dynamic>.from(r as Map)).toList();
  bool get _legacy => _evaluation?['topic']?['legacy'] == true;
  String get _status => _evaluation?['topic']?['status'] ?? widget.card.topicStatus ?? 'open';

  Future<void> _run(String method, String path, {Map<String, dynamic>? body, String? done}) async {
    setState(() => _busy = true);
    final res = await _chat.api(method, path, body: body);
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok) {
      if (done != null) AppToast.success(context, done);
      await _load();
    } else {
      AppToast.error(context, res.error);
    }
  }

  /// Saves the chosen statuses and pays the kalaf: of one person ([onlyUserId]) or of everyone not yet paid.
  Future<void> _saveAndPay({String? onlyUserId}) async {
    final rows = _rows
        .where((r) => r['paid'] != true && (onlyUserId == null || r['userId'] == onlyUserId))
        .map((r) => {'userId': r['userId'], 'status': _statuses[r['userId']], 'reason': _reasons[r['userId']]?.text})
        .toList();
    setState(() => _busy = true);
    final saved = await _chat.api('PUT', '/chat/topics/$_topicId/evaluation', body: {'rows': rows});
    if (!mounted) return;
    setState(() => _busy = false);
    if (!saved.ok) {
      AppToast.error(context, saved.error);
      return;
    }
    await _run(
      'POST',
      '/chat/topics/$_topicId/pay',
      body: onlyUserId == null ? null : {'userIds': [onlyUserId]},
      done: onlyUserId == null ? 'پاداش‌ها پرداخت شد.' : 'پاداش پرداخت شد.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final meta = widget.card.meta ?? const {};
    return ChatPageScaffold(
      title: 'اطلاعات چالش',
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: ChatTheme.accent))
            : RefreshIndicator(
                color: ChatTheme.accent,
                onRefresh: _load,
                child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Text(meta['title']?.toString() ?? '', style: ChatTheme.title.copyWith(fontSize: 16)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, children: [
                    ChatChip(label: meta['tag']?.toString() ?? 'چالش'),
                    ChatChip(label: topicStatusLabels[_status] ?? _status, color: ChatTheme.accent),
                  ]),
                  if ((meta['description'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(meta['description'].toString(), style: ChatTheme.body)),
                  if (meta['reward'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('جایزه: ${meta['reward']}', style: ChatTheme.caption)),
                  const SizedBox(height: 14),
                  // A quiz is graded and paid by the system: closing it and everyone's answers, nothing to evaluate
                  if (_quiz)
                    ChatQuizResults(
                      topicId: _topicId,
                      moderator: widget.moderator,
                      onOpenMember: (id) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatMemberProfileScreen(spaceId: widget.spaceId, userId: id))),
                    ),
                  if (!_quiz && _interGroup) InterGroupSection(challengeId: _challengeId, mentor: widget.moderator, spaceId: widget.spaceId),
                  if (!_quiz && !_interGroup && !widget.moderator) ...[
                    if (_myAnswer?['answered'] == true) _answerCard('پاسخ شما', _myAnswer!['answerText'], _myAnswer!['fileUrl'], _myAnswer!['submittedAt']),
                    _studentReport(),
                  ],
                  if (!_quiz && !_interGroup && widget.moderator) ..._mentorPanel(),
                  // A mentor reads the analysis above the people (inside the panel); others see it here
                  if (!_quiz && _insight != null && !(widget.moderator && !_interGroup)) _insightCard(),
                ],
              ),
              ),
      ),
    );
  }

  /// What a member sent for the challenge (typed answer or the options picked, and the file), shown as it was sent.
  Widget _answerCard(String title, dynamic text, dynamic fileUrl, dynamic at) {
    var body = (text ?? '').toString();
    final marker = body.lastIndexOf('\nفایل: ');
    if (marker >= 0) body = body.substring(0, marker);
    body = body.trim();
    final file = (fileUrl ?? '').toString();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: ChatTheme.title),
          if (at != null) Text('ثبت: ${chatDateText(at)}', style: ChatTheme.caption),
          const SizedBox(height: 6),
          if (body.isNotEmpty) SelectableText(body, style: ChatTheme.body) else if (file.isEmpty) Text('پاسخ متنی ثبت نشده است', style: ChatTheme.caption),
          if (file.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: GestureDetector(
                onTap: () => launchUrl(Uri.parse(ApiConstants.resolveImageUrl(file)), mode: LaunchMode.externalApplication),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.attach_file_rounded, size: 16, color: ChatTheme.accent),
                  const SizedBox(width: 4),
                  Text('فایل پیوست', style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
                ]),
              ),
            ),
        ],
      ),
    );
  }

  Widget _studentReport() {
    final report = _report;
    if (report == null || report['ready'] != true) {
      return Text('نتیجه‌ی شما پس از ارزیابی راهبر اینجا نمایش داده می‌شود.', style: ChatTheme.caption.copyWith(fontSize: 13));
    }
    final criteria = Map<String, dynamic>.from(report['criteria'] as Map);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${report['finalNakh']} کلاف', style: ChatTheme.title.copyWith(color: ChatTheme.accent, fontSize: 18)),
          if (participationLevels[report['status']] != null)
            Text('وضعیت مشارکت شما: ${participationLevels[report['status']]!.label} (${participationLevels[report['status']]!.percent}٪)', style: ChatTheme.body),
          const SizedBox(height: 6),
          Text('ارتباط با موضوع: ${criteria['relevance']}  ·  کیفیت: ${criteria['quality']}  ·  همکاری: ${criteria['collaboration']}  ·  ابتکار: ${criteria['initiative']}', style: ChatTheme.caption),
          if ((report['reason'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('توضیح راهبر: ${report['reason']}', style: ChatTheme.caption)),
          if (report['canObject'] == true)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ChatButton(label: 'ثبت اعتراض', primary: false, onPressed: _object),
            ),
          if (report['objection'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(report['objectionResponse'] != null ? 'پاسخ راهبر: ${report['objectionResponse']}' : 'اعتراض شما ثبت شد.', style: ChatTheme.caption)),
        ],
      ),
    );
  }

  Future<void> _object() async {
    final controller = TextEditingController();
    final text = await showNopaDialog<String>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('اعتراض به نتیجه', style: ChatTheme.title),
          content: TextField(controller: controller, maxLines: 3, maxLength: 500, style: ChatTheme.body, decoration: chatField('دلیل اعتراض')),
          actions: [ChatButton(label: 'ثبت', onPressed: () => Navigator.pop(ctx, controller.text))],
        ),
      ),
    );
    if (text != null && text.trim().isNotEmpty) {
      await _run('POST', '/chat/topics/$_topicId/objection', body: {'text': text}, done: 'اعتراض ثبت شد.');
    }
  }

  String get _asset => _evaluation?['topic']?['assetLabel']?.toString() ?? 'کلاف';
  int get _max => (_evaluation?['topic']?['max'] as num?)?.toInt() ?? 10;

  /// Three steps, in the order a mentor does them, at the top of the page.
  Widget _guide() {
    Widget step(String n, String text) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: ChatTheme.accent, borderRadius: BorderRadius.circular(10)),
              child: Text(n, style: ChatTheme.caption.copyWith(color: ChatTheme.surfaceBottom, fontWeight: FontWeight.bold, fontSize: 11)),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: ChatTheme.caption.copyWith(color: ChatTheme.text, fontSize: 12.5, height: 1.6))),
          ]),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ChatTheme.accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(ChatTheme.radius),
        border: Border.all(color: ChatTheme.accent.withValues(alpha: 0.45)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.lightbulb_outline_rounded, color: ChatTheme.accent, size: 18),
          const SizedBox(width: 6),
          Text('ارزیابی در سه قدم', style: ChatTheme.title.copyWith(color: ChatTheme.accent)),
        ]),
        step('۱', 'در گفتگوی چالش روی پیام خوب هر نفر بزنید و «نشان پیام خوب» یا «بهترین پاسخ» را انتخاب کنید؛ این پیام‌ها امتیاز کیفیت و ابتکار او را بالا می‌برند.'),
        step('۲', 'پایین همین صفحه برای هر نفر «سهم مشارکت» را انتخاب کنید. سیستم از روی گفتگو یک سهم پیشنهاد کرده که از قبل انتخاب شده است؛ اگر قبول ندارید عوضش کنید.'),
        step('۳', 'با «تأیید و پرداخت» پاداش همان نفر (یا با «پرداخت همه» پاداش همه) به حسابش می‌رود. بعد از پرداخت، تغییر فقط با «اصلاح» ممکن است.'),
      ]),
    );
  }

  /// Who is here, who is paid and what the challenge pays at most.
  Widget _summary() {
    final paid = _rows.where((r) => r['paid'] == true).length;
    final messages = (_evaluation?['topic']?['messageCount'] as num?)?.toInt() ?? 0;
    Widget tile(String value, String label) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: ChatTheme.card(),
            child: Column(children: [
              Text(value, style: ChatTheme.title.copyWith(color: ChatTheme.accent, fontSize: 15)),
              const SizedBox(height: 2),
              Text(label, style: ChatTheme.caption.copyWith(fontSize: 11), textAlign: TextAlign.center),
            ]),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        tile('${_rows.length}', 'شرکت‌کننده'),
        const SizedBox(width: 6),
        tile('$paid از ${_rows.length}', 'پرداخت‌شده'),
        const SizedBox(width: 6),
        tile('$messages', 'پیام در گفتگو'),
        const SizedBox(width: 6),
        tile('$_max', 'سقف پاداش ($_asset)'),
      ]),
    );
  }

  List<Widget> _mentorPanel() {
    final status = _status;
    final unpaid = _rows.where((r) => r['paid'] != true).toList();
    final unpaidTotal = unpaid.fold<int>(0, (sum, r) => sum + participationShare(_max, _statuses[r['userId']] ?? 'tired'));
    return [
      if (!_legacy) _guide(),
      _summary(),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (status == 'open') ChatButton(label: 'بستن چالش', primary: false, onPressed: _busy ? null : () => _run('POST', '/chat/topics/$_topicId/close', done: 'چالش بسته شد.')),
          if (status == 'closed') ChatButton(label: 'بازکردن دوباره', primary: false, onPressed: _busy ? null : () => _run('POST', '/chat/topics/$_topicId/reopen')),
          if (unpaid.isNotEmpty && !_legacy) ChatButton(label: 'پرداخت همه (${unpaid.length} نفر · $unpaidTotal $_asset)', onPressed: _busy ? null : _confirmPayAll),
          ChatButton(label: 'خروجی', primary: false, onPressed: _export),
        ],
      ),
      const SizedBox(height: 12),
      if (_legacy) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('پاداش این چالش زریک یا کلاف نیست و از صفحه‌ی بررسی پاسخ‌ها پرداخت می‌شود.', style: ChatTheme.caption.copyWith(fontSize: 13))),
      if (_insight != null) ...[_insightCard(), const SizedBox(height: 12)],
      Text('ارزیابی هر نفر', style: ChatTheme.title.copyWith(fontSize: 15)),
      const SizedBox(height: 8),
      if (_rows.isEmpty) Text('هنوز کسی در این چالش شرکت نکرده است.', style: ChatTheme.caption.copyWith(fontSize: 13)),
      for (final row in _rows) _evaluationRow(row, status),
    ];
  }

  /// Paying everyone is not undone with one tap: say who and how much first.
  Future<void> _confirmPayAll() async {
    final unpaid = _rows.where((r) => r['paid'] != true).toList();
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('پرداخت پاداش همه', style: ChatTheme.title),
          content: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              for (final r in unpaid)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Expanded(child: Text((r['user'] as Map?)?['name']?.toString() ?? '', style: ChatTheme.body)),
                    Text(
                      '${participationLevels[_statuses[r['userId']]]?.label ?? ''} · ${participationShare(_max, _statuses[r['userId']] ?? 'tired')} $_asset',
                      style: ChatTheme.caption,
                    ),
                  ]),
                ),
              const SizedBox(height: 6),
              Text('بعد از پرداخت، تغییر فقط با «اصلاح» ممکن است.', style: ChatTheme.caption),
            ]),
          ),
          actions: [
            ChatButton(label: 'انصراف', primary: false, onPressed: () => Navigator.pop(ctx, false)),
            ChatButton(label: 'پرداخت', onPressed: () => Navigator.pop(ctx, true)),
          ],
        ),
      ),
    );
    if (ok == true) await _saveAndPay();
  }

  Future<void> _export() async {
    final url = await _chat.exportLink(_topicId);
    if (url != null) await launchUrl(Uri.parse(ApiConstants.resolveImageUrl(url)), mode: LaunchMode.externalApplication);
  }

  Widget _evaluationRow(Map<String, dynamic> row, String status) {
    final id = row['userId'] as String;
    final user = Map<String, dynamic>.from((row['user'] as Map?) ?? const {});
    final criteria = Map<String, dynamic>.from(row['criteria'] as Map);
    final flags = (row['flags'] as List).map((f) => f.toString()).toList();
    final evidence = (row['evidenceMessages'] as List?) ?? const [];
    final max = _max;
    final paid = row['paid'] == true;
    final level = _statuses[id] ?? 'tired';
    final value = paid ? (row['finalNakh'] as num).toInt() : participationShare(max, level);
    final suggestedStatus = row['suggestedStatus']?.toString();
    final previous = row['previousCount'] != null && row['previousCount'] > 0 ? row['previousAverage'] : null;

    Widget meter(String label, String hint, num? v) {
      final n = (v ?? 0).clamp(0, 100).toDouble();
      return Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Row(children: [
          SizedBox(
            width: 92,
            child: Tooltip(message: hint, child: Text(label, style: ChatTheme.caption.copyWith(fontSize: 11.5))),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: n / 100, minHeight: 6, backgroundColor: ChatTheme.stroke.withValues(alpha: 0.35), color: ChatTheme.lavender),
            ),
          ),
          SizedBox(width: 30, child: Text('${n.round()}', textAlign: TextAlign.left, style: ChatTheme.caption.copyWith(fontSize: 11.5, color: ChatTheme.text))),
        ]),
      );
    }

    Widget sectionLabel(String text) => Padding(padding: const EdgeInsets.only(top: 12, bottom: 2), child: Text(text, style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(highlighted: !paid),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: user['id'] == null
                ? null
                : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatMemberProfileScreen(spaceId: widget.spaceId, userId: user['id'].toString()))),
            child: Row(
              children: [
                SafeAvatar(imageUrl: user['avatarUrl'], name: user['name'] ?? '', radius: 18, gender: user['gender'], isMentor: AvatarCatalog.isMentorRole(user['role'])),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(user['name'] ?? '', style: ChatTheme.title),
                    Text('${row['usefulMessages']} پیام مفید · ${row['share']}٪ از کل گفتگو', style: ChatTheme.caption.copyWith(fontSize: 11.5)),
                  ]),
                ),
                paid
                    ? const ChatChip(label: 'پرداخت شد', color: Color(0xFF12945F), icon: Icons.check_rounded, filled: true)
                    : const ChatChip(label: 'منتظر پرداخت', color: ChatTheme.accent),
              ],
            ),
          ),

          if (row['answer'] is Map) ...[
            const SizedBox(height: 10),
            _answerCard('پاسخ ثبت‌شده', (row['answer'] as Map)['text'], (row['answer'] as Map)['fileUrl'], (row['answer'] as Map)['submittedAt']),
          ],
          // What the system read from the conversation: a guide, the mentor decides
          sectionLabel('تحلیل سیستم (فقط راهنماست؛ تصمیم با شماست)'),
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text('امتیاز کلی: ', style: ChatTheme.caption),
            Text('${row['score']} از ۱۰۰', style: ChatTheme.caption.copyWith(color: ChatTheme.text, fontWeight: FontWeight.bold)),
            if (previous != null) Text('  ·  میانگین چالش‌های قبلی: $previous', style: ChatTheme.caption.copyWith(fontSize: 11.5)),
          ]),
          meter('ارتباط با موضوع', 'چقدر پیام‌ها به موضوع چالش مربوط بوده‌اند', criteria['relevance'] as num?),
          meter('کیفیت', 'پیام‌های پرمحتوا و تکراری‌نبودن؛ «پیام خوب» آن را بالا می‌برد', criteria['quality'] as num?),
          meter('همکاری', 'پاسخ به دیگران و واکنش‌هایی که گرفته است', criteria['collaboration'] as num?),
          meter('ابتکار', 'پیام‌های نشان‌شده، فایل فرستادن و شروع گفتگو', criteria['initiative'] as num?),
          if (flags.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Wrap(spacing: 4, runSpacing: 4, children: [for (final f in flags) ChatChip(label: f, color: ChatTheme.danger, icon: Icons.warning_amber_rounded)])),

          if (evidence.isNotEmpty) ...[
            sectionLabel('بهترین پیام‌های او'),
            for (final e in evidence)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: ChatTheme.surfaceBottom,
                  borderRadius: BorderRadius.circular(8),
                  border: const Border(right: BorderSide(color: ChatTheme.lavender, width: 3)),
                ),
                child: Text('${e['body']}', style: ChatTheme.caption.copyWith(color: ChatTheme.text), maxLines: 3, overflow: TextOverflow.ellipsis),
              ),
          ],

          if (row['objection'] != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('اعتراض: ${row['objection']}', style: ChatTheme.caption.copyWith(color: ChatTheme.danger))),
          if (row['objectionStatus'] == 'pending')
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(spacing: 8, children: [
                ChatButton(label: 'پذیرش اعتراض', primary: false, onPressed: () => _answerObjection(id, true, value)),
                ChatButton(label: 'رد اعتراض', primary: false, onPressed: () => _answerObjection(id, false, value)),
              ]),
            ),

          // The mentor's decision
          sectionLabel(paid ? 'سهم مشارکت (پرداخت شده)' : 'سهم مشارکت را انتخاب کنید'),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final e in participationLevels.entries)
                ChoiceChip(
                  avatar: suggestedStatus == e.key ? Icon(Icons.auto_awesome_rounded, size: 14, color: level == e.key ? ChatTheme.surfaceBottom : ChatTheme.accent) : null,
                  label: Text('${e.value.label} ${e.value.percent}٪ · ${participationShare(max, e.key)}',
                      style: ChatTheme.caption.copyWith(color: level == e.key ? ChatTheme.surfaceBottom : ChatTheme.text, fontWeight: level == e.key ? FontWeight.bold : null)),
                  selected: level == e.key,
                  showCheckmark: false,
                  selectedColor: ChatTheme.accent,
                  backgroundColor: Colors.transparent,
                  side: BorderSide(color: (level == e.key ? ChatTheme.accent : ChatTheme.stroke).withValues(alpha: 0.7)),
                  onSelected: paid ? null : (_) => setState(() => _statuses[id] = e.key),
                ),
            ],
          ),
          if (suggestedStatus != null && participationLevels[suggestedStatus] != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                const Icon(Icons.auto_awesome_rounded, size: 13, color: ChatTheme.accent),
                const SizedBox(width: 4),
                Expanded(child: Text('پیشنهاد سیستم: ${participationLevels[suggestedStatus]!.label}${!paid && level != suggestedStatus ? ' (شما چیز دیگری انتخاب کرده‌اید)' : ''}', style: ChatTheme.caption.copyWith(fontSize: 11.5))),
                if (!paid && level != suggestedStatus)
                  GestureDetector(
                    onTap: () => setState(() => _statuses[id] = suggestedStatus),
                    child: Text('برگرداندن', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)),
                  ),
              ]),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text('پاداش: ', style: ChatTheme.body),
              Text('$value $_asset', style: ChatTheme.title.copyWith(color: ChatTheme.accent, fontSize: 16)),
              if (paid) ...[const Spacer(), ChatButton(label: 'اصلاح', primary: false, onPressed: () => _correct(id, value))],
            ],
          ),
          if (paid && (row['reason'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('توضیح شما: ${row['reason']}', style: ChatTheme.caption)),
          if (!paid) ...[
            const SizedBox(height: 6),
            TextField(controller: _reasons[id], style: ChatTheme.caption.copyWith(color: ChatTheme.text), decoration: chatField('توضیح برای دانش‌آموز (اختیاری)')),
          ],
          if (!paid && !_legacy) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ChatButton(label: 'تأیید و پرداخت $value $_asset', onPressed: _busy ? null : () => _saveAndPay(onlyUserId: id)),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _answerObjection(String userId, bool accept, int current) async {
    final amount = TextEditingController(text: '$current');
    final response = TextEditingController();
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text(accept ? 'پذیرش اعتراض' : 'رد اعتراض', style: ChatTheme.title),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            if (accept) ...[
              TextField(controller: amount, keyboardType: TextInputType.number, style: ChatTheme.body, decoration: chatField('کلاف نهایی')),
              const SizedBox(height: 8),
            ],
            TextField(controller: response, style: ChatTheme.body, decoration: chatField('پاسخ به دانش‌آموز')),
          ]),
          actions: [ChatButton(label: 'ثبت', onPressed: () => Navigator.pop(ctx, true))],
        ),
      ),
    );
    if (ok == true) {
      await _run('POST', '/chat/topics/$_topicId/objection/resolve', body: {
        'userId': userId,
        'accept': accept,
        'response': response.text,
        if (accept) 'finalNakh': int.tryParse(amount.text),
      }, done: 'پاسخ ثبت شد.');
    }
  }

  Future<void> _correct(String userId, int current) async {
    final amount = TextEditingController(text: '$current');
    final reason = TextEditingController();
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('اصلاح نتیجه', style: ChatTheme.title),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: amount, keyboardType: TextInputType.number, style: ChatTheme.body, decoration: chatField('$_asset نهایی')),
            const SizedBox(height: 8),
            TextField(controller: reason, style: ChatTheme.body, decoration: chatField('دلیل اصلاح')),
          ]),
          actions: [ChatButton(label: 'ثبت', onPressed: () => Navigator.pop(ctx, true))],
        ),
      ),
    );
    if (ok == true) {
      await _run('POST', '/chat/topics/$_topicId/correct', body: {'userId': userId, 'finalNakh': int.tryParse(amount.text), 'reason': reason.text}, done: 'نتیجه اصلاح شد.');
    }
  }

  Widget _insightCard() {
    final insight = _insight!;
    List<String> list(String key) => ((insight[key] as List?) ?? const []).map((e) => e.toString()).toList();
    final topics = ((insight['topics'] as List?) ?? const []).map((t) => t['word'].toString()).join('، ');
    final summary = insight['summary']?.toString().trim() ?? '';
    Widget block(IconData icon, String title, String hint, List<String> items) => items.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(icon, size: 15, color: ChatTheme.accent),
                const SizedBox(width: 4),
                Text('$title (${items.length})', style: ChatTheme.caption.copyWith(color: ChatTheme.accent, fontWeight: FontWeight.bold)),
              ]),
              Text(hint, style: ChatTheme.caption.copyWith(fontSize: 11)),
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('•  ', style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
                    Expanded(child: Text(item, style: ChatTheme.caption.copyWith(color: ChatTheme.text))),
                  ]),
                ),
            ]),
          );
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.insights_rounded, size: 18, color: ChatTheme.lavender),
            const SizedBox(width: 6),
            Text('تحلیل کلی گفتگو', style: ChatTheme.title),
          ]),
          const SizedBox(height: 2),
          Text('خلاصه‌ای که سیستم از کل گفتگو ساخته؛ کمک می‌کند پیش از ارزیابی بدانید گفتگو کجا رفت و چه چیزی جا ماند.', style: ChatTheme.caption.copyWith(fontSize: 11)),
          if (summary.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(summary, style: ChatTheme.body)),
          if (topics.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('موضوع‌های پرتکرار: $topics', style: ChatTheme.caption)),
          block(Icons.help_outline_rounded, 'پرسش‌های بی‌پاسخ', 'بهتر است پیش از بستن چالش به این‌ها جواب داده شود.', list('unanswered')),
          block(Icons.blur_on_rounded, 'نقاط مبهم', 'جاهایی که اعضا سردرگم بوده‌اند.', list('confusing')),
        ],
      ),
    );
  }
}

/// Inter-group work: the mentor's entry, members' effort and judging; a member's private question.
class InterGroupSection extends StatefulWidget {
  final String challengeId;
  final bool mentor;
  final String spaceId;
  const InterGroupSection({super.key, required this.challengeId, required this.mentor, required this.spaceId});

  @override
  State<InterGroupSection> createState() => _InterGroupSectionState();
}

class _InterGroupSectionState extends State<InterGroupSection> {
  final ChatRepository _chat = ChatRepository.instance;
  final TextEditingController _entry = TextEditingController();
  final TextEditingController _question = TextEditingController();
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _works = [];
  String? _judgingNote;
  ChatAttachment? _file;
  final Map<String, String> _chosen = {};
  List<Map<String, dynamic>> _questions = [];
  bool _asking = false;

  String get _base => '/chat/intergroup/${widget.challengeId}';

  @override
  void initState() {
    super.initState();
    if (widget.mentor) {
      _load();
    } else {
      _loadQuestions();
    }
  }

  /// The caravan's questions to the judges, with their answers (also published in the arena thread).
  Future<void> _loadQuestions() async {
    final res = await _chat.api('GET', '$_base/questions');
    if (!mounted || !res.ok || res.data is! List) return;
    setState(() => _questions = (res.data as List).map((q) => Map<String, dynamic>.from(q as Map)).toList());
  }

  @override
  void dispose() {
    _entry.dispose();
    _question.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final tiers = await _chat.api('GET', '$_base/tiers');
    final works = await _chat.api('GET', '$_base/judge');
    if (!mounted) return;
    setState(() {
      if (tiers.ok) {
        _tiers = ((tiers.data as Map)['rows'] as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
        for (final r in _tiers) {
          _chosen[r['user']['id']] = r['tier'];
        }
      }
      if (works.ok) {
        _works = (works.data as List).map((w) => Map<String, dynamic>.from(w as Map)).toList();
      } else {
        _judgingNote = works.error;
      }
    });
  }

  Future<void> _pickFile() async {
    final picked = await FilePicker.platform.pickFiles();
    final path = picked?.files.single.path;
    if (path == null) return;
    final file = await _chat.upload(io.File(path), widget.spaceId);
    if (!mounted) return;
    if (file == null) {
      AppToast.error(context, 'ارسال فایل انجام نشد.');
    } else {
      setState(() => _file = file);
    }
  }

  /// "پرسش از داور" goes to the challenge's judges desk in the panel (چالش‌ها → میز رقابت); the answer is
  /// published in the arena thread for every caravan and shown here under «پرسش‌های شما».
  Future<void> _askJudge() async {
    final text = _question.text.trim();
    if (text.isEmpty) {
      AppToast.error(context, 'متن پرسش را بنویسید.');
      return;
    }
    if (_asking) return;
    setState(() => _asking = true);
    final res = await _chat.api('POST', '$_base/question', body: {'body': text});
    if (!mounted) return;
    setState(() => _asking = false);
    if (!res.ok) {
      AppToast.error(context, res.error.isNotEmpty ? res.error : 'ارسال پرسش انجام نشد. دوباره تلاش کنید.');
      return;
    }
    _question.clear();
    AppToast.success(context, 'پرسش شما برای داور ارسال شد؛ پاسخ همین‌جا و در میدان رقابت نمایش داده می‌شود.');
    _loadQuestions();
  }

  Widget _questionTile(Map<String, dynamic> q) {
    final answer = q['answer']?.toString();
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: ChatTheme.surfaceBottom,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q['body']?.toString() ?? '', style: ChatTheme.body),
          const SizedBox(height: 4),
          Text(
            answer == null || answer.isEmpty ? 'در انتظار پاسخ داور' : 'پاسخ داور: $answer',
            style: ChatTheme.caption.copyWith(color: answer == null || answer.isEmpty ? null : ChatTheme.text),
          ),
        ],
      ),
    );
  }

  Future<void> _submit(String method, String path, Map<String, dynamic> body, String done) async {
    final res = await _chat.api(method, path, body: body);
    if (!mounted) return;
    if (res.ok) {
      AppToast.success(context, done);
      if (widget.mentor) _load();
    } else {
      AppToast.error(context, res.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.mentor) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('گفتگو درباره‌ی این رقابت در گروه چالش‌های کاروان شما انجام می‌شود. اثر را راهبر ثبت می‌کند.', style: ChatTheme.caption.copyWith(fontSize: 13)),
          const SizedBox(height: 10),
          TextField(controller: _question, style: ChatTheme.body, decoration: chatField('پرسش از داور')),
          const SizedBox(height: 6),
          ChatButton(
            label: _asking ? 'در حال ارسال…' : 'ارسال پرسش',
            primary: false,
            onPressed: _askJudge,
          ),
          if (_questions.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text('پرسش‌های شما از داور', style: ChatTheme.title),
            for (final q in _questions) _questionTile(q),
          ],
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('اثر رسمی کاروان', style: ChatTheme.title),
        const SizedBox(height: 6),
        TextField(controller: _entry, maxLines: 4, style: ChatTheme.body, decoration: chatField('متن نهایی اثر')),
        const SizedBox(height: 6),
        Row(children: [
          ChatButton(label: _file == null ? 'پیوست فایل' : _file!.name, primary: false, onPressed: _pickFile),
          const SizedBox(width: 8),
          ChatButton(label: 'ثبت اثر', onPressed: () => _submit('POST', '$_base/entry', {'body': _entry.text, 'attachmentId': _file?.id}, 'اثر کاروان ثبت شد.')),
        ]),
        const SizedBox(height: 16),
        Text('وضعیت مشارکت اعضا', style: ChatTheme.title),
        for (final r in _tiers)
          Row(
            children: [
              Expanded(child: Text('${r['user']['name']} (${r['usefulMessages']} پیام مفید)', style: ChatTheme.caption)),
              DropdownButton<String>(
                value: _chosen[r['user']['id']],
                dropdownColor: ChatTheme.surfaceBottom,
                style: ChatTheme.caption.copyWith(color: ChatTheme.text),
                underline: const SizedBox.shrink(),
                items: [for (final e in tierLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => setState(() => _chosen[r['user']['id']] = v!),
              ),
            ],
          ),
        if (_tiers.isNotEmpty) ChatButton(label: 'تأیید وضعیت‌ها', onPressed: () => _submit('PUT', '$_base/tiers', {'tiers': _chosen}, 'وضعیت‌ها ثبت شد؛ جایزه پس از نهایی شدن رتبه‌بندی پرداخت می‌شود.')),
        const SizedBox(height: 16),
        Text('داوری آثار ناشناس', style: ChatTheme.title),
        if (_works.isEmpty) Text(_judgingNote ?? 'اثری برای داوری وجود ندارد.', style: ChatTheme.caption),
        for (final w in _works) _JudgeForm(work: w, onSubmit: (body) => _submit('POST', '/chat/intergroup/entries/${w['id']}/judge', body, 'داوری ثبت شد.')),
      ],
    );
  }
}

class _JudgeForm extends StatefulWidget {
  final Map<String, dynamic> work;
  final Future<void> Function(Map<String, dynamic> body) onSubmit;
  const _JudgeForm({required this.work, required this.onSubmit});

  @override
  State<_JudgeForm> createState() => _JudgeFormState();
}

class _JudgeFormState extends State<_JudgeForm> {
  late final TextEditingController _score = TextEditingController(text: '${widget.work['myScore']?['score'] ?? ''}');
  late final TextEditingController _strength = TextEditingController(text: widget.work['myScore']?['strength'] ?? '');
  late final TextEditingController _suggestion = TextEditingController(text: widget.work['myScore']?['suggestion'] ?? '');

  @override
  void dispose() {
    _score.dispose();
    _strength.dispose();
    _suggestion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('اثر ${widget.work['code']}', style: ChatTheme.title),
          Text(widget.work['body'] ?? '', style: ChatTheme.body),
          if (widget.work['fileUrl'] != null)
            GestureDetector(
              onTap: () => launchUrl(Uri.parse(ApiConstants.resolveImageUrl(widget.work['fileUrl'])), mode: LaunchMode.externalApplication),
              child: Padding(padding: const EdgeInsets.only(top: 4), child: Text('دیدن فایل اثر', style: ChatTheme.caption.copyWith(color: ChatTheme.accent))),
            ),
          const SizedBox(height: 6),
          TextField(controller: _score, keyboardType: TextInputType.number, style: ChatTheme.body, decoration: chatField('نمره از ۱۰۰')),
          const SizedBox(height: 6),
          TextField(controller: _strength, style: ChatTheme.body, decoration: chatField('یک نقطه‌ی قوت')),
          const SizedBox(height: 6),
          TextField(controller: _suggestion, style: ChatTheme.body, decoration: chatField('یک پیشنهاد')),
          const SizedBox(height: 6),
          ChatButton(
            label: 'ثبت داوری',
            primary: false,
            onPressed: () => widget.onSubmit({'score': int.tryParse(_score.text), 'strength': _strength.text, 'suggestion': _suggestion.text}),
          ),
        ],
      ),
    );
  }
}

/// What a mentor should look at today.
class ChatDashboardScreen extends StatefulWidget {
  const ChatDashboardScreen({super.key});

  @override
  State<ChatDashboardScreen> createState() => _ChatDashboardScreenState();
}

class _ChatDashboardScreenState extends State<ChatDashboardScreen> {
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    ChatRepository.instance.api('GET', '/chat/dashboard').then((res) {
      if (mounted && res.ok) setState(() => _data = Map<String, dynamic>.from(res.data as Map));
    });
  }

  Widget _section(String title, List<String> items, String empty) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: ChatTheme.card(highlighted: items.isNotEmpty),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: ChatTheme.title),
            const SizedBox(height: 4),
            if (items.isEmpty) Text(empty, style: ChatTheme.caption),
            for (final item in items) Padding(padding: const EdgeInsets.only(top: 3), child: Text(item, style: ChatTheme.caption.copyWith(color: ChatTheme.text))),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final d = _data;
    List<dynamic> list(String key) => (d?[key] as List?) ?? const [];
    return ChatPageScaffold(
      title: 'داشبورد راهبر',
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: d == null
            ? const Center(child: CircularProgressIndicator(color: ChatTheme.accent))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _section('پرسش‌های بی‌پاسخ', [for (final q in list('unansweredQuestions')) '${q['senderName']}: ${q['body']}'], 'پرسش بی‌پاسخی وجود ندارد.'),
                  _section('چالش‌های نزدیک مهلت', [for (final t in list('dueSoon')) '${t['title']} · ${chatDateText(t['dueDate'])}'], 'چالشی نزدیک مهلت نیست.'),
                  _section('منتظر پرداخت', [if ((d['waitingForPayment'] ?? 0) > 0) '${d['waitingForPayment']} چالش بسته و پرداخت‌نشده'], 'چیزی منتظر پرداخت نیست.'),
                  _section('اعتراض‌ها', [for (final o in list('objections')) '${o['objection']}'], 'اعتراضی ثبت نشده است.'),
                  _section('اعضای ساکت در هفته‌ی اخیر', [for (final s in list('silentMembers')) '$s'], 'همه‌ی اعضا فعال بوده‌اند.'),
                ],
              ),
      ),
    );
  }
}
