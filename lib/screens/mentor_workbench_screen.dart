import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MentorWorkbenchScreen extends StatefulWidget {
  const MentorWorkbenchScreen({super.key});

  @override
  State<MentorWorkbenchScreen> createState() => _MentorWorkbenchScreenState();
}

class _MentorWorkbenchScreenState extends State<MentorWorkbenchScreen> with SingleTickerProviderStateMixin {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _pending = [];
  List<Map<String, dynamic>> _tickets = [];
  bool _loadingSubmissions = true;
  bool _loadingTickets = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadPending();
    _loadTickets();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadPending() async {
    setState(() => _loadingSubmissions = true);
    final list = await _api.getPendingSubmissions();
    if (mounted) setState(() { _pending = list; _loadingSubmissions = false; });
  }

  Future<void> _loadTickets() async {
    setState(() => _loadingTickets = true);
    final list = await _api.getTickets();
    if (mounted) setState(() { _tickets = list; _loadingTickets = false; });
  }

  Future<void> _review(String id, bool approve, int reward, String feedback) async {
    final result = await _api.reviewSubmission(id, status: approve ? 'approved' : 'rejected', score: reward, mentorFeedback: feedback);
    if (!mounted) return;
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ثبت ارزیابی با موفقیت انجام شد')));
      _loadPending();
    } else {
      String errMsg = result['error'] == 'OVER_LIMIT' ? 'خطا: سقف پاداش شما مجاز به پرداخت این مقدار نیست.' : 'خطا در ثبت ارزیابی: ${result['error']}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errMsg), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('پیشخوان راهبر', style: TextStyle(fontFamily: 'Vazirmatn')),
        bottom: TabBar(
          controller: _tabController,
          labelStyle: const TextStyle(fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold),
          unselectedLabelStyle: const TextStyle(fontFamily: 'Vazirmatn'),
          tabs: const [
            Tab(text: 'تیکت‌ها', icon: Icon(Icons.support_agent)),
            Tab(text: 'تکالیف ارسالی', icon: Icon(Icons.assignment_turned_in)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTicketsTab(),
          _buildSubmissionsTab(),
        ],
      ),
    );
  }

  Widget _buildTicketsTab() {
    if (_loadingTickets) return const Center(child: CircularProgressIndicator());
    if (_tickets.isEmpty) return const Center(child: Text('تیکتی یافت نشد', style: TextStyle(fontFamily: 'Vazirmatn')));

    return RefreshIndicator(
      onRefresh: _loadTickets,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _tickets.length,
        itemBuilder: (context, idx) {
          final t = _tickets[idx];
          return Card(
            color: const Color(0xFF1E1435),
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: (t['status'] == 'answered') ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFFFFD54F).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          (t['status'] == 'answered') ? 'پاسخ داده شده' : 'در انتظار پاسخ',
                          style: TextStyle(
                            color: (t['status'] == 'answered') ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                            fontSize: 10,
                            fontFamily: 'Vazirmatn'
                          ),
                        ),
                      ),
                      Text('کاربر: ${t['student']?['name'] ?? 'ناشناس'}', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('پیام: ${t['message']}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 13)),
                  const SizedBox(height: 12),
                  if (t['answer'] != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('پاسخ شما:', style: TextStyle(color: Color(0xFFD946EF), fontSize: 11, fontFamily: 'Vazirmatn')),
                          const SizedBox(height: 4),
                          Text(t['answer'], textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 12)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (t['status'] != 'answered')
                    ElevatedButton.icon(
                      onPressed: () => _openReplyDialog(t),
                      icon: const Icon(Icons.reply, size: 16),
                      label: const Text('ثبت پاسخ', style: TextStyle(fontFamily: 'Vazirmatn')),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                        foregroundColor: Colors.white,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openReplyDialog(Map<String, dynamic> ticket) {
    final replyCtrl = TextEditingController();
    showDialog(context: context, builder: (c) => AlertDialog(
      title: const Text('ثبت پاسخ تیکت', textAlign: TextAlign.right, style: TextStyle(fontFamily: 'Vazirmatn')),
      content: TextField(
        controller: replyCtrl,
        maxLines: 3,
        textAlign: TextAlign.right,
        style: const TextStyle(fontFamily: 'Vazirmatn'),
        decoration: const InputDecoration(labelText: 'متن پاسخ شما', border: OutlineInputBorder()),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف', style: TextStyle(fontFamily: 'Vazirmatn'))),
        ElevatedButton(
          onPressed: () async {
            if (replyCtrl.text.isEmpty) return;
            Navigator.pop(context);
            final success = await _api.replyTicket(ticket['id'], replyCtrl.text);
            if (!mounted) return;
            if (success) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('پاسخ ثبت شد', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Color(0xFF10B981)));
              _loadTickets();
            } else {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('خطا در ثبت پاسخ', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.red));
            }
          },
          child: const Text('ارسال پاسخ', style: TextStyle(fontFamily: 'Vazirmatn')),
        )
      ],
    ));
  }

  Widget _buildSubmissionsTab() {
    if (_loadingSubmissions) return const Center(child: CircularProgressIndicator());
    if (_pending.isEmpty) return const Center(child: Text('تکلیفی در انتظار بررسی نیست', style: TextStyle(fontFamily: 'Vazirmatn')));

    return RefreshIndicator(
      onRefresh: _loadPending,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _pending.length,
        itemBuilder: (context, idx) {
          final s = _pending[idx];
          return Card(
            color: const Color(0xFF1E1435),
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${s['student']?['name'] ?? 'دانش‌آموز'}', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 6),
                  Text('پرسش: ${s['challenge']?['title'] ?? '-'}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 13, color: Colors.white70)),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('پاسخ: ${s['answerText'] ?? (s['fileUrl'] ?? '-')}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 12)),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () => _openReviewDialog(s), 
                        icon: const Icon(Icons.check, size: 16), 
                        label: const Text('تایید و پاداش', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 12)),
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), foregroundColor: Colors.white),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => _openReviewDialog(s, reject: true), 
                        icon: const Icon(Icons.close, size: 16), 
                        label: const Text('رد (اصلاح)', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 12)),
                        style: OutlinedButton.styleFrom(foregroundColor: Colors.redAccent, side: const BorderSide(color: Colors.redAccent)),
                      ),
                    ],
                  )
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openReviewDialog(Map<String, dynamic> submission, {bool reject = false}) {
    final scoreCtrl = TextEditingController(text: submission['challenge']?['rewardZarik']?.toString() ?? '200');
    final feedbackCtrl = TextEditingController();
    final challenge = submission['challenge'] ?? {};
    final type = challenge['type'];

    Widget contentWidget;
    if (type == 'quiz' || type == 'multiple_choice') {
      int correctCount = 0;
      int incorrectCount = 0;
      int totalQuestions = 0;
      try {
        final questions = challenge['questions'] != null ? 
            (challenge['questions'] is String ? jsonDecode(challenge['questions']) as List : challenge['questions'] as List) : [];
        totalQuestions = questions.length;
        if (submission['answerText'] != null) {
          final text = submission['answerText'] as String;
          final match = RegExp(r'\[(.*)\]').firstMatch(text);
          if (match != null) {
            final answersStr = match.group(0)!;
            final answers = jsonDecode(answersStr) as List;
            for (int i = 0; i < questions.length && i < answers.length; i++) {
              if (questions[i]['correct'] == answers[i]) {
                correctCount++;
              } else {
                incorrectCount++;
              }
            }
          }
        }
      } catch (e) {
        debugPrint('Error parsing quiz answers: $e');
      }

      contentWidget = Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text('نتیجه آزمون چند گزینه‌ای:', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('تعداد کل سوالات: $totalQuestions'),
          Text('تعداد پاسخ‌های صحیح: $correctCount', style: const TextStyle(color: Colors.green)),
          Text('تعداد پاسخ‌های نادرست: $incorrectCount', style: const TextStyle(color: Colors.red)),
        ],
      );
    } else if (type == 'file' || submission['fileUrl'] != null) {
      contentWidget = Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text('فایل ارسال شده:', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: () {}, 
            icon: const Icon(Icons.download),
            label: const Text('مشاهده / دانلود فایل'),
          ),
        ],
      );
    } else {
      contentWidget = Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text('متن پاسخ دانش‌آموز:', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(submission['answerText'] ?? 'پاسخی ثبت نشده است', textAlign: TextAlign.right),
          ),
        ],
      );
    }

    showDialog(context: context, builder: (c) => AlertDialog(
      title: Text(reject ? 'رد پاسخ (نیاز به اصلاح)' : 'تایید و ثبت پاداش'),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('سوال: ${challenge['title'] ?? '-'}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 16),
              contentWidget,
              const Divider(height: 32),
              TextField(
                controller: scoreCtrl, 
                decoration: const InputDecoration(labelText: 'پاداش (زریک)', border: OutlineInputBorder()), 
                keyboardType: TextInputType.number,
                textAlign: TextAlign.right,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: feedbackCtrl, 
                decoration: const InputDecoration(labelText: 'یادداشت راهبر (اختیاری)', border: OutlineInputBorder()),
                maxLines: 2,
                textAlign: TextAlign.right,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: reject ? Colors.red : Colors.green),
          onPressed: () {
            final score = int.tryParse(scoreCtrl.text) ?? 0;
            final feedback = feedbackCtrl.text;
            Navigator.pop(context);
            _review(submission['id'], !reject, score, feedback);
          }, 
          child: Text(reject ? 'رد درخواست' : 'تایید (Approve)'),
        )
      ],
    ));
  }
}
