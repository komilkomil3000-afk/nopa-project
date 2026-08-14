import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MentorWorkbenchScreen extends StatefulWidget {
  const MentorWorkbenchScreen({super.key});

  @override
  State<MentorWorkbenchScreen> createState() => _MentorWorkbenchScreenState();
}

class _MentorWorkbenchScreenState extends State<MentorWorkbenchScreen> {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _pending = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadPending();
  }

  Future<void> _loadPending() async {
    setState(() => _loading = true);
    final list = await _api.getPendingSubmissions();
    if (mounted) setState(() { _pending = list; _loading = false; });
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
      appBar: AppBar(title: const Text('پیشخوان تصحیح تکالیف')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
            onRefresh: _loadPending,
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _pending.length,
              itemBuilder: (context, idx) {
                final s = _pending[idx];
                return Card(
                  color: const Color(0xFF161223),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${s['student']?['name'] ?? 'دانش‌آموز'}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text('پرسش: ${s['challenge']?['title'] ?? '-'}', textAlign: TextAlign.right),
                        const SizedBox(height: 8),
                        Text('پاسخ: ${s['answerText'] ?? (s['fileUrl'] ?? '-')}', textAlign: TextAlign.right),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            ElevatedButton.icon(onPressed: () => _openReviewDialog(s), icon: const Icon(Icons.check), label: const Text('تایید')),
                            ElevatedButton.icon(onPressed: () => _openReviewDialog(s, reject: true), icon: const Icon(Icons.close), label: const Text('رد')),
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

  void _openReviewDialog(Map<String, dynamic> submission, {bool reject = false}) {
    final scoreCtrl = TextEditingController(text: submission['challenge']?['rewardZarik']?.toString() ?? '200');
    final feedbackCtrl = TextEditingController();
    showDialog(context: context, builder: (c) => AlertDialog(
      title: Text(reject ? 'رد پاسخ' : 'تایید پاسخ'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: scoreCtrl, decoration: const InputDecoration(labelText: 'پاداش (زریک)'), keyboardType: TextInputType.number),
        TextField(controller: feedbackCtrl, decoration: const InputDecoration(labelText: 'یادداشت راهبر')),
      ],),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
        ElevatedButton(onPressed: () {
          final score = int.tryParse(scoreCtrl.text) ?? 0;
          final feedback = feedbackCtrl.text;
          Navigator.pop(context);
          _review(submission['id'], !reject, score, feedback);
        }, child: const Text('ثبت'))
      ],
    ));
  }
}
