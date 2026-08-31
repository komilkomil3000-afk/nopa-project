import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import '../utils/constants.dart';
import '../utils/global_state.dart';

class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _tickets = [];
  bool _isLoading = true;
  int _selectedFilterIndex = 0; // 0: All, 1: Pending, 2: Answered

  @override
  void initState() {
    super.initState();
    _fetchTickets();
  }

  Future<void> _fetchTickets() async {
    setState(() => _isLoading = true);
    try {
      final remoteTickets = await _api.getTickets();
      if (mounted) {
        if (remoteTickets.isNotEmpty) {
          setState(() {
            _tickets = remoteTickets;
            _isLoading = false;
          });
        } else {
          // Fallback to local tickets if any
          final localTickets = GlobalState.tickets;
          setState(() {
            _tickets = List<Map<String, dynamic>>.from(localTickets);
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _tickets = List<Map<String, dynamic>>.from(GlobalState.tickets);
          _isLoading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredTickets {
    if (_selectedFilterIndex == 1) {
      // Pending
      return _tickets.where((t) {
        final status = t['status']?.toString().toLowerCase() ?? 'open';
        return status == 'open' || status == 'pending' || (t['replies'] == null || (t['replies'] as List).isEmpty && t['answer'] == null);
      }).toList();
    } else if (_selectedFilterIndex == 2) {
      // Answered
      return _tickets.where((t) {
        final status = t['status']?.toString().toLowerCase() ?? '';
        final hasReplies = (t['replies'] != null && (t['replies'] as List).isNotEmpty) || t['answer'] != null;
        return status == 'resolved' || status == 'answered' || hasReplies;
      }).toList();
    }
    return _tickets;
  }

  void _showNewTicketModal() {
    final TextEditingController subjectCtrl = TextEditingController();
    String selectedCategory = 'آموزشی 📚';
    final categories = ['آموزشی 📚', 'فنی و نرم‌افزار ⚙️', 'مشاوره و راهنمایی 💬', 'امور کاروان 🚩', 'عمومی 📌'];
    String? attachedFileName;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: Padding(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
                  left: 20,
                  right: 20,
                  top: 20,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 4,
                          decoration: BoxDecoration(
                            color: Colors.white24,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'ثبت سوال و تیکت جدید',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                            onPressed: () => Navigator.pop(modalContext),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Category Selector
                      const Text(
                        'دسته‌بندی موضوع:',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                      const SizedBox(height: 8),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: categories.map((cat) {
                            final isSel = selectedCategory == cat;
                            return GestureDetector(
                              onTap: () => setModalState(() => selectedCategory = cat),
                              child: Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isSel ? const Color(0xFF8B5CF6) : const Color(0xFF160E2A),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: isSel ? const Color(0xFF8B5CF6) : Colors.white10,
                                  ),
                                ),
                                child: Text(
                                  cat,
                                  style: TextStyle(
                                    color: isSel ? Colors.white : Colors.white70,
                                    fontSize: 11.5,
                                    fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Message Input
                      const Text(
                        'متن سوال یا پیام شما:',
                        style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: subjectCtrl,
                        maxLines: 4,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'Vazirmatn'),
                        textAlign: TextAlign.right,
                        decoration: InputDecoration(
                          hintText: 'سوال خود را با جزئیات بنویسید تا راهبر کاروان به آن پاسخ دهد...',
                          hintStyle: const TextStyle(color: Colors.white24, fontSize: 11.5, fontFamily: 'Vazirmatn'),
                          filled: true,
                          fillColor: const Color(0xFF160E2A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Colors.white10),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Colors.white10),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFF8B5CF6)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Attachment button
                      InkWell(
                        onTap: () {
                          setModalState(() {
                            attachedFileName = 'تصویر_ضمیمه_سوال_${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}.jpg';
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF160E2A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                attachedFileName == null ? Icons.attach_file : Icons.check_circle,
                                color: attachedFileName == null ? Colors.white38 : const Color(0xFF10B981),
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                attachedFileName ?? 'پیوست فایل یا تصویر به سوال',
                                style: TextStyle(
                                  color: attachedFileName == null ? Colors.white38 : const Color(0xFF10B981),
                                  fontSize: 12,
                                  fontWeight: attachedFileName == null ? FontWeight.normal : FontWeight.bold,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Submit Button
                      Container(
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)]),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: ElevatedButton(
                          onPressed: () async {
                            final text = subjectCtrl.text.trim();
                            if (text.isEmpty) return;

                            Navigator.pop(modalContext);

                            // Send to backend
                            final res = await _api.createTicket(
                              category: selectedCategory,
                              subject: text,
                              attachmentUrl: attachedFileName,
                            );

                            // Also record in local state for instant responsiveness
                            final newTicketLocal = {
                              'id': res?['id'] ?? 't_${DateTime.now().millisecondsSinceEpoch}',
                              'teacher': 'راهبر کاروان',
                              'category': selectedCategory,
                              'message': text,
                              'subject': text,
                              'status': 'pending',
                              'date': 'هم‌اکنون',
                              'createdAt': DateTime.now().toIso8601String(),
                              'attachment': attachedFileName,
                            };
                            GlobalState.tickets.insert(0, newTicketLocal);

                            _fetchTickets();

                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('سوال شما با موفقیت برای راهبر ارسال شد ✅', style: TextStyle(fontFamily: 'Vazirmatn')),
                                  backgroundColor: Color(0xFF10B981),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text(
                            'ارسال سوال برای راهبر کاروان',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13.5, fontFamily: 'Vazirmatn'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showTicketDetailsDialog(Map<String, dynamic> ticket) {
    final replies = (ticket['replies'] as List?) ?? [];
    final hasAnswer = replies.isNotEmpty || ticket['answer'] != null;
    final answerText = replies.isNotEmpty ? (replies.first['message'] ?? '') : (ticket['answer'] ?? '');
    int currentRating = ticket['rating'] ?? ticket['ratingGiven'] ?? 0;

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: Dialog(
                backgroundColor: const Color(0xFF1E1435),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                  side: BorderSide(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                ticket['category'] ?? 'آموزشی 📚',
                                style: const TextStyle(color: Color(0xFFD946EF), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () => Navigator.pop(dialogContext),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Question Box
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF160E2A),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'متن سوال شما:',
                                    style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                                  ),
                                  Text(
                                    ticket['date'] ?? ticket['createdAt']?.toString().substring(0, 10) ?? '',
                                    style: const TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'Vazirmatn'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                ticket['subject'] ?? ticket['message'] ?? '',
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.45, fontFamily: 'Vazirmatn'),
                              ),
                              if (ticket['attachment'] != null || ticket['attachmentUrl'] != null) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    const Icon(Icons.attach_file, color: Color(0xFF10B981), size: 14),
                                    const SizedBox(width: 4),
                                    Text(
                                      ticket['attachment'] ?? ticket['attachmentUrl'] ?? 'فایل ضمیمه',
                                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 10.5, fontFamily: 'Vazirmatn'),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Answer Box
                        if (hasAnswer) ...[
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF26154A),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: const [
                                    Text(
                                      'پاسخ راهبر کاروان 👨‍🏫',
                                      style: TextStyle(color: Color(0xFFD946EF), fontSize: 11.5, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                                    ),
                                    Icon(Icons.check_circle, color: Color(0xFF10B981), size: 16),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  answerText,
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.45, fontFamily: 'Vazirmatn'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Rating section
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF160E2A),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              children: [
                                const Text(
                                  'امتیاز شما به پاسخ و راهنمایی راهبر:',
                                  style: TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn'),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: List.generate(5, (starIdx) {
                                    final starVal = starIdx + 1;
                                    final isLit = starVal <= currentRating;
                                    return GestureDetector(
                                      onTap: () {
                                        setDialogState(() {
                                          currentRating = starVal;
                                        });
                                        ticket['rating'] = starVal;
                                        _api.resolveTicket(ticketId: ticket['id'] ?? '', rating: starVal);
                                        Provider.of<AppRepository>(context, listen: false).rateMentor('alavi', starVal.toDouble(), 'امتیاز به تیکت');
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('امتیاز شما به راهبر ثبت شد ⭐', style: TextStyle(fontFamily: 'Vazirmatn')),
                                            backgroundColor: Color(0xFF10B981),
                                          ),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 4),
                                        child: Icon(
                                          isLit ? Icons.star : Icons.star_border,
                                          color: const Color(0xFFFFD54F),
                                          size: 24,
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                              ],
                            ),
                          ),
                        ] else ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFD54F).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.2)),
                            ),
                            child: Row(
                              children: const [
                                Icon(Icons.hourglass_top_rounded, color: Color(0xFFFFD54F), size: 20),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'سوال شما در صف بررسی راهبر کاروان قرار دارد و به زودی پاسخ داده می‌شود.',
                                    style: TextStyle(color: Color(0xFFFFD54F), fontSize: 11.5, height: 1.4, fontFamily: 'Vazirmatn'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredTickets;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F081D),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
          centerTitle: true,
          title: const Text(
            'تیکت‌ها و سوالات پشتیبانی',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: 'Vazirmatn',
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(left: 12),
              child: IconButton(
                onPressed: _showNewTicketModal,
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.add, color: Color(0xFFD946EF), size: 20),
                ),
              ),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _fetchTickets,
          child: Column(
            children: [
              // Filter Tab Bar
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
                ),
                child: Row(
                  children: [
                    _buildFilterTab(title: 'همه تیکت‌ها', index: 0),
                    _buildFilterTab(title: 'در انتظار پاسخ ⏳', index: 1),
                    _buildFilterTab(title: 'پاسخ داده شده ✅', index: 2),
                  ],
                ),
              ),

              // Content List
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6)))
                    : (filtered.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final item = filtered[index];
                              return _buildTicketCard(item);
                            },
                          )),
              ),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _showNewTicketModal,
          backgroundColor: const Color(0xFFEC4899),
          icon: const Icon(Icons.edit, color: Colors.white, size: 18),
          label: const Text(
            'ثبت سوال جدید',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Vazirmatn'),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterTab({required String title, required int index}) {
    final isSel = _selectedFilterIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedFilterIndex = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF8B5CF6) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(
                color: isSel ? Colors.white : Colors.white60,
                fontSize: 11.5,
                fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTicketCard(Map<String, dynamic> item) {
    final replies = (item['replies'] as List?) ?? [];
    final isAnswered = replies.isNotEmpty || item['status'] == 'answered' || item['status'] == 'resolved' || item['answer'] != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isAnswered
              ? const Color(0xFF10B981).withValues(alpha: 0.25)
              : const Color(0xFFFFD54F).withValues(alpha: 0.25),
        ),
      ),
      child: InkWell(
        onTap: () => _showTicketDetailsDialog(item),
        borderRadius: BorderRadius.circular(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Category Tag
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item['category'] ?? 'آموزشی 📚',
                    style: const TextStyle(
                      color: Color(0xFFD946EF),
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),

                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isAnswered
                        ? const Color(0xFF10B981).withValues(alpha: 0.12)
                        : const Color(0xFFFFD54F).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isAnswered ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                      width: 0.8,
                    ),
                  ),
                  child: Text(
                    isAnswered ? 'پاسخ داده شده ✅' : 'در انتظار پاسخ ⏳',
                    style: TextStyle(
                      color: isAnswered ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Subject / Question text
            Text(
              item['subject'] ?? item['message'] ?? '',
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                height: 1.4,
                fontFamily: 'Vazirmatn',
              ),
            ),
            const SizedBox(height: 12),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'تاریخ: ${item['date'] ?? item['createdAt']?.toString().substring(0, 10) ?? 'امروز'}',
                  style: const TextStyle(color: Colors.white38, fontSize: 10.5, fontFamily: 'Vazirmatn'),
                ),
                const Row(
                  children: [
                    Text(
                      'مشاهده جزئیات و پاسخ',
                      style: TextStyle(color: Color(0xFF8B5CF6), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward_ios, color: Color(0xFF8B5CF6), size: 10),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF8B5CF6), size: 48),
            ),
            const SizedBox(height: 18),
            const Text(
              'تیکتی در این بخش یافت نشد',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
            ),
            const SizedBox(height: 8),
            const Text(
              'اگر سوال درسی، فنی یا مشاوره‌ای دارید، می‌توانید با زدن دکمه «ثبت سوال جدید» آن را برای راهبر کاروان ارسال کنید.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.5, fontFamily: 'Vazirmatn'),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _showNewTicketModal,
              icon: const Icon(Icons.add, size: 16, color: Colors.white),
              label: const Text('ثبت سوال جدید', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
