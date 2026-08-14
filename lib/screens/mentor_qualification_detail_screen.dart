import 'package:flutter/material.dart';

class MentorQualificationDetailScreen extends StatelessWidget {
  final Map<String, dynamic> qualification;

  const MentorQualificationDetailScreen({
    super.key,
    required this.qualification,
  });

  @override
  Widget build(BuildContext context) {
    final title = qualification['title'] ?? 'گواهی صلاحیت راهبری';
    final authority = qualification['authority'] ?? 'آکادمی مرکزی سواد تربیتی نپا';
    final date = qualification['date'] ?? 'کد استعلام: NP-1087263';
    final desc = qualification['description'] ?? 'این گواهی نشان‌دهنده صلاحیت تربیتی، توانایی مربیگری کار گروهی و هدایت نوجوانان در مسیر کاروان نپا است.';
    
    final List<String> takeaways = qualification['takeaways'] != null
        ? List<String>.from(qualification['takeaways'])
        : [
            'توانایی هدایت گروه‌های دانش‌آموزی تا ۵۰ نفر',
            'تسلط بر سیستم‌های پاداش‌دهی و مبادلات زریک',
            'مهارت در حل تعارضات تربیتی و کار تیمی نوجوانان',
            'آشنایی کامل با سرفصل‌های سواد رسانه‌ای نپا',
          ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        title: const Text('شناسنامه صلاحیت علمی راهبر', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15, fontFamily: 'Vazirmatn')),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            children: [
              // Premium Certificate Card Wrapper
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF26123D), Color(0xFF1E1435)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.2), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD54F).withValues(alpha: 0.05),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    )
                  ],
                ),
                child: Column(
                  children: [
                    const Icon(Icons.workspace_premium, color: Color(0xFFFFD54F), size: 60),
                    const SizedBox(height: 16),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 12),
                    
                    // Verification badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.verified, color: Color(0xFF10B981), size: 14),
                          SizedBox(width: 6),
                          Text(
                            'تایید اصالت مدرک نپا',
                            style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                    ),
                    const Divider(color: Colors.white10, height: 32),
                    
                    // Authority & Date details
                    _buildDetailRow('مرجع صادرکننده:', authority),
                    const SizedBox(height: 12),
                    _buildDetailRow('تاریخ صدور / مرجع استعلام:', date),
                    
                    const Divider(color: Colors.white10, height: 32),
                    
                    // Description
                    const Align(
                      alignment: Alignment.centerRight,
                      child: Text('شرح صلاحیت و مأموریت:', style: TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'Vazirmatn')),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      desc,
                      textAlign: TextAlign.justify,
                      style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.6, fontFamily: 'Vazirmatn'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              
              // Takeaways/skills card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '🔑 مهارت‌ها و قابلیت‌های کلیدی تأیید شده',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(height: 14),
                    ...takeaways.map((skill) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('• ', style: TextStyle(color: Color(0xFF8B5CF6), fontSize: 14, fontWeight: FontWeight.bold)),
                          Expanded(
                            child: Text(
                              skill,
                              style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.5, fontFamily: 'Vazirmatn'),
                            ),
                          ),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'Vazirmatn')),
        Text(value, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
      ],
    );
  }
}
