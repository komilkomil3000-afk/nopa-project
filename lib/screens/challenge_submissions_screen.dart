import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ChallengeSubmissionsScreen extends StatefulWidget {
  final String challengeId;
  final String title;

  const ChallengeSubmissionsScreen({super.key, required this.challengeId, required this.title});

  @override
  State<ChallengeSubmissionsScreen> createState() => _ChallengeSubmissionsScreenState();
}

class _ChallengeSubmissionsScreenState extends State<ChallengeSubmissionsScreen> {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _submissions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSubmissions();
  }

  Future<void> _loadSubmissions() async {
    setState(() => _loading = true);
    final data = await _api.getChallengeSubmissions(widget.challengeId);
    if (mounted) {
      setState(() {
        _submissions = data;
        _loading = false;
      });
    }
  }

  Future<void> _reviewSubmission(String submissionId, bool approve, int reward, String feedback) async {
    final result = await _api.reviewMentorSubmission(submissionId, approve, reward, feedback);
    if (!mounted) return;
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ثبت ارزیابی با موفقیت انجام شد', style: TextStyle(fontFamily: 'Vazirmatn'))));
      _loadSubmissions();
    } else {
      String errMsg = 'خطا در ثبت ارزیابی: ${result['error']}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errMsg, style: const TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.red));
    }
  }

  void _openReviewDialog(Map<String, dynamic> submission, {bool reject = false}) {
    final scoreCtrl = TextEditingController(text: '200'); // default reward
    final feedbackCtrl = TextEditingController();

    Widget contentWidget = Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const Text('متن پاسخ دانش‌آموز:', style: TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
          ),
          child: Text(submission['answerText'] ?? 'پاسخی ثبت نشده است', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn')),
        ),
      ],
    );

    showDialog(context: context, builder: (c) => AlertDialog(
      title: Text(reject ? 'رد پاسخ (نیاز به اصلاح)' : 'تایید و ثبت پاداش', style: const TextStyle(fontFamily: 'Vazirmatn')),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('تکلیف: ${widget.title}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn')),
              const SizedBox(height: 16),
              contentWidget,
              const Divider(height: 32),
              TextField(
                controller: scoreCtrl, 
                decoration: const InputDecoration(labelText: 'پاداش (زریک)', border: OutlineInputBorder()), 
                keyboardType: TextInputType.number,
                textAlign: TextAlign.right,
                style: const TextStyle(fontFamily: 'Vazirmatn'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: feedbackCtrl, 
                decoration: const InputDecoration(labelText: 'یادداشت راهبر (اختیاری)', border: OutlineInputBorder()),
                maxLines: 2,
                textAlign: TextAlign.right,
                style: const TextStyle(fontFamily: 'Vazirmatn'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف', style: TextStyle(fontFamily: 'Vazirmatn'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: reject ? Colors.red : Colors.green),
          onPressed: () {
            final score = int.tryParse(scoreCtrl.text) ?? 0;
            final feedback = feedbackCtrl.text;
            Navigator.pop(context);
            _reviewSubmission(submission['id'], !reject, score, feedback);
          }, 
          child: Text(reject ? 'رد درخواست' : 'تایید و اعطای جایزه', style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
        )
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0823),
      appBar: AppBar(
        title: const Text('پاسخ‌های ثبت شده', style: TextStyle(fontFamily: 'Vazirmatn')),
        backgroundColor: const Color(0xFF1E1435),
      ),
      body: _loading 
        ? const Center(child: CircularProgressIndicator())
        : _submissions.isEmpty
          ? const Center(child: Text('تاکنون پاسخی ارسال نشده است', style: TextStyle(fontFamily: 'Vazirmatn', color: Colors.white)))
          : RefreshIndicator(
              onRefresh: _loadSubmissions,
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _submissions.length,
                itemBuilder: (context, idx) {
                  final s = _submissions[idx];
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
                                  color: (s['status'] == 'APPROVED' || s['status'] == 'approved') 
                                    ? const Color(0xFF10B981).withValues(alpha: 0.2) 
                                    : const Color(0xFFFFD54F).withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  (s['status'] == 'APPROVED' || s['status'] == 'approved') ? 'تایید شده' : 'در حال بررسی',
                                  style: TextStyle(
                                    color: (s['status'] == 'APPROVED' || s['status'] == 'approved') ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                                    fontSize: 10,
                                    fontFamily: 'Vazirmatn'
                                  ),
                                ),
                              ),
                              Text('${s['student']?['name'] ?? 'دانش‌آموز'}', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn', color: Colors.white)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text('پاسخ: ${s['answerText'] ?? (s['fileUrl'] ?? '-')}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 12, color: Colors.white)),
                          ),
                          const SizedBox(height: 12),
                          if (s['status'] != 'APPROVED' && s['status'] != 'approved')
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                ElevatedButton.icon(
                                  onPressed: () => _openReviewDialog(s), 
                                  icon: const Icon(Icons.check, size: 16), 
                                  label: const Text('تایید و اعطای جایزه', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 12)),
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
            ),
    );
  }
}
