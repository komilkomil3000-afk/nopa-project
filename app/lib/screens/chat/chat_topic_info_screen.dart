import 'package:nopa_app/core/avatar_catalog.dart';
import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:nopa_app/screens/chat/chat_profile_screen.dart';
import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/services/api_service.dart';
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
  Map<String, dynamic>? _insight;
  final Map<String, String> _statuses = {};
  final Map<String, TextEditingController> _reasons = {};
  bool _busy = false;
  bool _loading = true;

  String get _topicId => widget.card.topicId!;
  bool get _interGroup => widget.card.meta?['category'] == 'inter_group';
  String get _challengeId => widget.card.meta?['challengeId']?.toString() ?? '';

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
      if (mounted && report.ok) setState(() => _report = Map<String, dynamic>.from(report.data as Map));
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

  Future<void> _saveAndPay() async {
    final rows = _rows
        .where((r) => r['paid'] != true)
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
    await _run('POST', '/chat/topics/$_topicId/pay', done: 'پاداش‌ها پرداخت شد.');
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
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(meta['title']?.toString() ?? '', style: ChatTheme.title.copyWith(fontSize: 16)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, children: [
                    ChatChip(label: meta['tag']?.toString() ?? 'چالش'),
                    ChatChip(label: topicStatusLabels[_status] ?? _status, color: ChatTheme.accent),
                  ]),
                  if (meta['reward'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('جایزه: ${meta['reward']}', style: ChatTheme.caption)),
                  const SizedBox(height: 14),
                  if (_interGroup) InterGroupSection(challengeId: _challengeId, mentor: widget.moderator, spaceId: widget.spaceId),
                  if (!_interGroup && !widget.moderator) _studentReport(),
                  if (!_interGroup && widget.moderator) ..._mentorPanel(),
                  if (_insight != null) _insightCard(),
                ],
              ),
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
    final text = await showDialog<String>(
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

  List<Widget> _mentorPanel() {
    final status = _status;
    return [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (status == 'open') ChatButton(label: 'بستن چالش', onPressed: _busy ? null : () => _run('POST', '/chat/topics/$_topicId/close', done: 'چالش بسته شد.')),
          if (status == 'closed') ChatButton(label: 'بازکردن دوباره', primary: false, onPressed: _busy ? null : () => _run('POST', '/chat/topics/$_topicId/reopen')),
          if (status == 'closed' && _rows.isNotEmpty && !_legacy) ChatButton(label: 'تأیید و پرداخت', onPressed: _busy ? null : _saveAndPay),
          ChatButton(label: 'خروجی', primary: false, onPressed: _export),
        ],
      ),
      const SizedBox(height: 14),
      if (_legacy) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('این چالش زریکی است و از صفحه‌ی بررسی پاسخ‌ها پرداخت می‌شود.', style: ChatTheme.caption.copyWith(fontSize: 13))),
      if (_rows.isEmpty) Text('هنوز کسی در این چالش شرکت نکرده است.', style: ChatTheme.caption.copyWith(fontSize: 13)),
      for (final row in _rows) _evaluationRow(row, status),
    ];
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
    final max = (_evaluation?['topic']?['max'] as num?)?.toInt() ?? 10;
    final paid = row['paid'] == true;
    final level = _statuses[id] ?? 'tired';
    final value = paid ? (row['finalNakh'] as num).toInt() : participationShare(max, level);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
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
                SafeAvatar(imageUrl: user['avatarUrl'], name: user['name'] ?? '', radius: 16, gender: user['gender'], isMentor: AvatarCatalog.isMentorRole(user['role'])),
                const SizedBox(width: 8),
                Expanded(child: Text(user['name'] ?? '', style: ChatTheme.title)),
                Text('سهم ${row['share']}٪ · امتیاز ${row['score']}', style: ChatTheme.caption),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text('موضوع ${criteria['relevance']} · کیفیت ${criteria['quality']} · همکاری ${criteria['collaboration']} · ابتکار ${criteria['initiative']}', style: ChatTheme.caption),
          Text('${row['usefulMessages']} پیام مفید · پیشنهاد سیستم: ${row['suggested']} کلاف'
              '${row['previousCount'] != null && row['previousCount'] > 0 ? ' · میانگین قبلی ${row['previousAverage']}' : ''}', style: ChatTheme.caption),
          if (flags.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Wrap(spacing: 4, children: [for (final f in flags) ChatChip(label: f, color: ChatTheme.danger)])),
          for (final e in evidence) Padding(padding: const EdgeInsets.only(top: 4), child: Text('«${e['body']}»', style: ChatTheme.caption, maxLines: 2, overflow: TextOverflow.ellipsis)),
          if (row['objection'] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('اعتراض: ${row['objection']}', style: ChatTheme.caption.copyWith(color: ChatTheme.danger))),
          if (row['objectionStatus'] == 'pending')
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(spacing: 8, children: [
                ChatButton(label: 'پذیرش', primary: false, onPressed: () => _answerObjection(id, true, value)),
                ChatButton(label: 'رد', primary: false, onPressed: () => _answerObjection(id, false, value)),
              ]),
            ),
          const SizedBox(height: 6),
          Text('وضعیت مشارکت', style: ChatTheme.caption),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final e in participationLevels.entries)
                ChoiceChip(
                  label: Text('${e.value.label} ${e.value.percent}٪', style: ChatTheme.caption.copyWith(color: level == e.key ? ChatTheme.surfaceBottom : ChatTheme.text)),
                  selected: level == e.key,
                  showCheckmark: false,
                  selectedColor: ChatTheme.accent,
                  backgroundColor: Colors.transparent,
                  onSelected: paid ? null : (_) => setState(() => _statuses[id] = e.key),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text('پاداش: $value کلاف', style: ChatTheme.title),
              if (paid) ...[const Spacer(), ChatButton(label: 'اصلاح', primary: false, onPressed: () => _correct(id, value))],
            ],
          ),
          if (!paid) TextField(controller: _reasons[id], style: ChatTheme.caption.copyWith(color: ChatTheme.text), decoration: chatField('توضیح برای دانش‌آموز (اختیاری)')),
        ],
      ),
    );
  }

  Future<void> _answerObjection(String userId, bool accept, int current) async {
    final amount = TextEditingController(text: '$current');
    final response = TextEditingController();
    final ok = await showDialog<bool>(
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
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          title: Text('اصلاح نتیجه', style: ChatTheme.title),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: amount, keyboardType: TextInputType.number, style: ChatTheme.body, decoration: chatField('کلاف نهایی')),
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
    Widget block(String title, List<String> items) => items.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: ChatTheme.caption.copyWith(color: ChatTheme.accent)),
              for (final item in items) Text(item, style: ChatTheme.caption),
            ]),
          );
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(12),
      decoration: ChatTheme.card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('تحلیل گفتگو', style: ChatTheme.title),
          Text(insight['summary']?.toString() ?? '', style: ChatTheme.caption),
          if (topics.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('موضوع‌های پرتکرار: $topics', style: ChatTheme.caption)),
          block('پرسش‌های بی‌پاسخ', list('unanswered')),
          block('نقاط مبهم', list('confusing')),
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

  String get _base => '/chat/intergroup/${widget.challengeId}';

  @override
  void initState() {
    super.initState();
    if (widget.mentor) _load();
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

  /// "پرسش از داور" goes to the admin / head arbiter's support tickets, not to a mentor's chat.
  Future<void> _askAdmin() async {
    final text = _question.text.trim();
    if (text.isEmpty) {
      AppToast.error(context, 'متن پرسش را بنویسید.');
      return;
    }
    final ticket = await HttpApiService().createTicket(
      category: 'پرسش از داور',
      subject: 'پرسش از داور (چالش ${widget.challengeId}): $text',
    );
    if (!mounted) return;
    if (ticket == null) {
      AppToast.error(context, 'ارسال پرسش انجام نشد. دوباره تلاش کنید.');
      return;
    }
    _question.clear();
    AppToast.success(context, 'پرسش شما برای داور ارشد (مدیر) ارسال شد.');
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
            label: 'ارسال پرسش',
            primary: false,
            onPressed: _askAdmin,
          ),
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
        if (_tiers.isNotEmpty) ChatButton(label: 'تأیید وضعیت‌ها', onPressed: () => _submit('PUT', '$_base/tiers', {'tiers': _chosen}, 'وضعیت‌ها ثبت شد.')),
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
