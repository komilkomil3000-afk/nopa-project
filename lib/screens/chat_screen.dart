import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';

class ChatScreen extends StatefulWidget {
  final String title;
  final String? mentorId;
  final String? caravanId;

  const ChatScreen({
    super.key,
    required this.title,
    this.mentorId,
    this.caravanId,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _messages = [];
  Timer? _pollingTimer;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchMessages();
    // Poll every 5 seconds for new messages
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _fetchMessages(silent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _fetchMessages({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() => _isLoading = true);
    }
    
    List<dynamic> msgs = [];
    if (widget.mentorId != null) {
      msgs = await HttpApiService().getDirectMessages(widget.mentorId!);
    } else if (widget.caravanId != null) {
      msgs = await HttpApiService().getCaravanMessages(widget.caravanId!);
    }

    if (mounted) {
      setState(() {
        _messages = msgs;
        _isLoading = false;
      });
      // Scroll to bottom on first load or when sending
      if (!silent) {
        _scrollToBottom();
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();
    
    final success = await HttpApiService().sendChatMessage(
      receiverId: widget.mentorId,
      caravanId: widget.caravanId,
      text: text,
    );

    if (success) {
      _fetchMessages(silent: false);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('خطا در ارسال پیام')),
        );
      }
    }
  }

  void _pickAttachment() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E2C),
        title: const Text('انتخاب ضمیمه', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.image, color: Colors.blue),
              title: const Text('تصویر / گالری', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
              onTap: () {
                Navigator.pop(ctx);
                _sendMockFile('https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200', 'image');
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file, color: Colors.orange),
              title: const Text('فایل متنی / PDF', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
              onTap: () {
                Navigator.pop(ctx);
                _sendMockFile('https://example.com/file.pdf', 'document');
              },
            ),
          ],
        ),
      )
    );
  }

  Future<void> _sendMockFile(String url, String type) async {
    final success = await HttpApiService().sendChatMessage(
      receiverId: widget.mentorId,
      caravanId: widget.caravanId,
      fileUrl: url,
      fileType: type,
    );
    if (success) {
      _fetchMessages(silent: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<AppRepository>(context).currentUser;
    
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F081D),
        appBar: AppBar(
          backgroundColor: const Color(0xFF1E1E2C),
          title: Text(widget.title, style: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 16)),
        ),
        body: Column(
          children: [
            Expanded(
              child: _isLoading 
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                  ? const Center(child: Text('هیچ پیامی یافت نشد. اولین پیام را بفرستید!', style: TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn')))
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final msg = _messages[index];
                        final isMe = msg['senderId'] == currentUser.id;
                        return _buildChatBubble(msg, isMe);
                      },
                    ),
            ),
            _buildMessageInput(),
          ],
        ),
      ),
    );
  }

  Widget _buildChatBubble(dynamic msg, bool isMe) {
    final hasFile = msg['fileUrl'] != null && msg['fileUrl'].toString().isNotEmpty;
    
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFF8B5CF6) : const Color(0xFF2D2D3D),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(0),
            bottomRight: isMe ? const Radius.circular(0) : const Radius.circular(16),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isMe && widget.caravanId != null) 
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  msg['sender']?['name'] ?? 'ناشناس', 
                  style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontWeight: FontWeight.bold)
                ),
              ),
            
            if (hasFile)
              Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: msg['fileType'] == 'image'
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(msg['fileUrl'], height: 120, width: 180, fit: BoxFit.cover,
                        errorBuilder: (c, e, s) => Container(height: 100, width: 150, color: Colors.grey, child: const Icon(Icons.error)),
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.insert_drive_file, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text('فایل ضمیمه', style: TextStyle(color: Colors.white, fontSize: 12)),
                      ],
                    ),
              ),
              
            if (msg['messageText'] != null && msg['messageText'].toString().isNotEmpty)
              Text(
                msg['messageText'],
                style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontSize: 14),
              ),
              
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(msg['createdAt']),
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 10),
                ),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  Icon(
                    Icons.done_all,
                    size: 14,
                    color: msg['isRead'] == true ? Colors.blueAccent : Colors.white.withValues(alpha: 0.6),
                  ),
                ]
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Color(0xFF1E1E2C),
        border: Border(top: BorderSide(color: Colors.white10)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.attach_file, color: Colors.white70),
              onPressed: _pickAttachment,
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: TextField(
                  controller: _messageController,
                  style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
                  maxLines: null,
                  decoration: const InputDecoration(
                    hintText: 'پیام خود را بنویسید...',
                    hintStyle: TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn'),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            CircleAvatar(
              backgroundColor: const Color(0xFF8B5CF6),
              radius: 22,
              child: IconButton(
                icon: const Icon(Icons.send, color: Colors.white, size: 20),
                onPressed: _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
