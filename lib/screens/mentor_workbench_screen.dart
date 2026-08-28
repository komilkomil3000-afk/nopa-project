import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'challenge_submissions_screen.dart';
import 'mentor_ticket_detail_screen.dart';

class MentorWorkbenchScreen extends StatefulWidget {
  const MentorWorkbenchScreen({super.key});

  @override
  State<MentorWorkbenchScreen> createState() => _MentorWorkbenchScreenState();
}

class _MentorWorkbenchScreenState extends State<MentorWorkbenchScreen> with SingleTickerProviderStateMixin {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _challenges = [];
  List<Map<String, dynamic>> _tickets = [];
  bool _loadingChallenges = true;
  bool _loadingTickets = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadChallenges();
    _loadTickets();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadChallenges() async {
    final list = await _api.getMentorChallenges();
    if (mounted) setState(() { _challenges = list; _loadingChallenges = false; });
  }

  Future<void> _loadTickets() async {
    final list = await _api.getTickets();
    if (mounted) setState(() { _tickets = list; _loadingTickets = false; });
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
            Tab(text: 'چالش‌ها', icon: Icon(Icons.assignment)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTicketsTab(),
          _buildChallengesTab(),
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
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (c) => MentorTicketDetailScreen(ticketId: t['id'])),
                ).then((_) => _loadTickets());
              },
              borderRadius: BorderRadius.circular(16),
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
                            color: (t['status'] == 'answered' || t['status'] == 'resolved') ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFFFFD54F).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            (t['status'] == 'answered' || t['status'] == 'resolved') ? 'پاسخ داده شده' : 'در انتظار پاسخ',
                            style: TextStyle(
                              color: (t['status'] == 'answered' || t['status'] == 'resolved') ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                              fontSize: 10,
                              fontFamily: 'Vazirmatn'
                            ),
                          ),
                        ),
                        Text('کاربر: ${t['student']?['name'] ?? 'ناشناس'}', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text('موضوع: ${t['subject'] ?? 'بدون موضوع'}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 13, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text('دسته بندی: ${t['category'] ?? '-'}', textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 11, color: Colors.white70)),
                    const SizedBox(height: 12),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text('مشاهده تاریخچه و گفتگو', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11, color: Color(0xFFD946EF))),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFFD946EF)),
                      ],
                    )
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildChallengesTab() {
    if (_loadingChallenges) return const Center(child: CircularProgressIndicator());
    if (_challenges.isEmpty) return const Center(child: Text('چالشی ثبت نکرده‌اید', style: TextStyle(fontFamily: 'Vazirmatn')));

    return RefreshIndicator(
      onRefresh: _loadChallenges,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _challenges.length,
        itemBuilder: (context, idx) {
          final c = _challenges[idx];
          return Card(
            color: const Color(0xFF1E1435),
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (ctx) => ChallengeSubmissionsScreen(challengeId: c['id'], title: c['title'])),
                );
              },
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(c['title'] ?? 'بدون عنوان', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn', fontSize: 16)),
                    const SizedBox(height: 6),
                    Text(c['type'] == 'quiz' ? 'آزمون' : (c['type'] == 'skill' ? 'مهارتی' : 'ارسال فایل'), textAlign: TextAlign.right, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 12, color: Colors.white54)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('پاداش: ${c['rewardZarik'] ?? 0} زریک', style: const TextStyle(color: Colors.amber, fontFamily: 'Vazirmatn', fontSize: 12)),
                        const Row(
                          children: [
                            Text('بررسی پاسخ‌ها', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11, color: Color(0xFF8B5CF6))),
                            SizedBox(width: 4),
                            Icon(Icons.people, size: 14, color: Color(0xFF8B5CF6)),
                          ],
                        )
                      ],
                    )
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
