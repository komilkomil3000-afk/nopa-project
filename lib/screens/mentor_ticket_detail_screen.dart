import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MentorTicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const MentorTicketDetailScreen({super.key, required this.ticketId});

  @override
  State<MentorTicketDetailScreen> createState() => _MentorTicketDetailScreenState();
}

class _MentorTicketDetailScreenState extends State<MentorTicketDetailScreen> {
  final HttpApiService _api = HttpApiService();
  Map<String, dynamic>? _ticket;
  bool _loading = true;
  final TextEditingController _msgCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadTicket();
  }

  Future<void> _loadTicket() async {
    setState(() => _loading = true);
    final data = await _api.getMentorTicketDetails(widget.ticketId);
    if (mounted) {
      setState(() {
        _ticket = data;
        _loading = false;
      });
    }
  }

  Future<void> _sendReply() async {
    if (_msgCtrl.text.isEmpty) return;
    
    final success = await _api.replyMentorTicket(widget.ticketId, _msgCtrl.text);
    if (success) {
      _msgCtrl.clear();
      _loadTicket();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('پیام ارسال شد', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Color(0xFF10B981))
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('خطا در ارسال پیام', style: TextStyle(fontFamily: 'Vazirmatn')), backgroundColor: Colors.red)
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F0823),
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_ticket == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F0823),
        appBar: AppBar(title: const Text('خطا')),
        body: const Center(child: Text('تیکت یافت نشد', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'))),
      );
    }

    final replies = _ticket!['replies'] as List<dynamic>? ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFF0F0823),
      appBar: AppBar(
        title: const Text('گفتگوی تیکت', style: TextStyle(fontFamily: 'Vazirmatn')),
        backgroundColor: const Color(0xFF1E1435),
      ),
      body: Column(
        children: [
          // Header info
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1E1435),
            width: double.infinity,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('دانش‌آموز: ${_ticket!['student']?['name'] ?? 'ناشناس'}', style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn', color: Colors.white)),
                Text('موضوع: ${_ticket!['subject']}', style: const TextStyle(fontFamily: 'Vazirmatn', color: Colors.white70)),
                Text('وضعیت: ${_ticket!['status'] == 'answered' ? 'پاسخ داده شده' : 'در حال بررسی'}', style: const TextStyle(fontFamily: 'Vazirmatn', color: Colors.amber)),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: replies.length + 1,
              itemBuilder: (context, idx) {
                // The first item is the original ticket message
                if (idx == 0) {
                  return _buildChatBubble(
                    text: _ticket!['subject'] ?? 'بدون متن', // Fallback, usually tickets have a message field, but in this schema it's subject and attachments
                    isMentor: false,
                    time: _ticket!['createdAt'] ?? '',
                  );
                }

                final reply = replies[idx - 1];
                final isMentor = reply['mentorId'] != null;
                return _buildChatBubble(
                  text: reply['message'] ?? '',
                  isMentor: isMentor,
                  time: reply['createdAt'] ?? '',
                );
              },
            ),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildChatBubble({required String text, required bool isMentor, required String time}) {
    return Align(
      alignment: isMentor ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMentor ? const Color(0xFF8B5CF6) : const Color(0xFF1E1435),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMentor ? 16 : 0),
            bottomRight: Radius.circular(isMentor ? 0 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: isMentor ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            Text(text, style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: const Color(0xFF1E1435),
      child: SafeArea(
        child: Row(
          children: [
            FloatingActionButton(
              mini: true,
              backgroundColor: const Color(0xFF10B981),
              onPressed: _sendReply,
              child: const Icon(Icons.send, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _msgCtrl,
                textAlign: TextAlign.right,
                style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
                decoration: InputDecoration(
                  hintText: 'پاسخ خود را بنویسید...',
                  hintStyle: const TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn'),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: 0.1),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
