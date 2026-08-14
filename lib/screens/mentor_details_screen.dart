import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/global_state.dart';
import '../services/app_state_repository.dart';
import 'mentor_qualification_detail_screen.dart';


class MentorDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> mentor;

  const MentorDetailsScreen({
    super.key,
    required this.mentor,
  });

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final activeMentor = repository.mentorData[mentor['id']] ?? mentor;

    // Determine level color and display (1: Bronze, 2: Silver, 3: Gold)
    final int mLevel = activeMentor['mentorLevel'] ?? 1;
    final ProfileLevel level = mLevel == 3 ? ProfileLevel.golden : (mLevel == 2 ? ProfileLevel.silver : ProfileLevel.bronze);
    
    // Custom label for mentors
    final String levelLabel = mLevel == 3 ? 'راهنمای کل' : (mLevel == 2 ? 'استاد' : 'یاور');
    final Color levelColor = GlobalState.getLevelColor(level);

    // List of certifications of the mentor
    final List<Map<String, String>> certs = [
      {
        'title': 'گواهی عالی مربیگری تربیتی نپا',
        'authority': 'آکادمی مرکزی سواد تربیتی نپا',
        'date': '۱۴۰۲/۰۵/۱۲ - کد استعلام: NEP-8493',
        'description': 'شایستگی در هدایت گروه‌های نوجوان، حل تعارضات گروهی و برگزاری دوره‌های کار تیمی در بستر بازی‌وار کاروان.',
      },
      {
        'title': 'گواهی تخصصی رسانه و تولید محتوا',
        'authority': 'وزارت فرهنگ و ارشاد اسلامی',
        'date': '۱۴۰۱/۰۹/۲۰ - کد استعلام: MED-1932',
        'description': 'صلاحیت حرفه‌ای در آموزش ابزارهای نوین رسانه‌ای، سناریونویسی و مربیگری تولید محتوای دیجیتال خلاق.',
      },
      {
        'title': 'گواهی شایستگی مدیریت کاروان نپا',
        'authority': 'سازمان ملی بازی‌وار سازی آموزشی',
        'date': '۱۴۰۲/۱۱/۰۵ - کد استعلام: CRV-7742',
        'description': 'صلاحیت در مدیریت پروژه آموزشی، بودجه‌بندی زریک و ارزیابی تکالیف دانش‌آموزان در مسیر کاروان.',
      },
      {
        'title': 'گواهی رهبری ارتباطی و حل چالش‌های گروهی',
        'authority': 'دانشگاه تهران - دانشکده علوم تربیتی',
        'date': '۱۴۰۲/۰۲/۱۸ - کد استعلام: LDR-6110',
        'description': 'توانایی در مشاوره فردی و گروهی نوجوانان، ارتقای انگیزه تحصیلی و مربیگری مهارت‌های فردی هوش هیجانی.',
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        title: const Text('مشخصات و شناسنامه راهبر', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn')),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          children: [
            const SizedBox(height: 10),
            // Avatar with glowing level border
            Center(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Glow effect
                  Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: GlobalState.getLevelGlow(level),
                    ),
                  ),
                  // Border frame
                  Container(
                    width: 106,
                    height: 106,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: levelColor, width: 4),
                    ),
                  ),
                  ClipOval(
                    child: Image.network(
                      mentor['avatar'],
                      width: 96,
                      height: 96,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        width: 96,
                        height: 96,
                        color: Colors.white10,
                        child: const Icon(Icons.person, color: Colors.white30, size: 48),
                      ),
                    ),
                  ),
                  // Level Badge label
                  Positioned(
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: levelColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        levelLabel,
                        style: const TextStyle(
                          color: Colors.black,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
             Text(
              activeMentor['name'],
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
            ),
            const SizedBox(height: 6),
            
            // Rating
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.star, color: Color(0xFFFFD54F), size: 16),
                const SizedBox(width: 4),
                Text(
                  '${activeMentor['rating']} از ۵ (ارزیابی‌ها)',
                  style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Vazirmatn'),
                ),
              ],
            ),
            const SizedBox(width: 15),

            // Chat Action Button
            Tooltip(
              message: "سیستم گفتگو به‌زودی فعال می‌شود",
              child: ElevatedButton.icon(
                onPressed: null, // Disabled
                icon: const Icon(Icons.chat, color: Colors.white),
                label: const Text(
                  "شروع گفتگو",
                  style: TextStyle(fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold, fontSize: 16),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey,
                  padding: const EdgeInsets.symmetric(horizontal: 25, vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                ),
              ),
            ),
            
            const SizedBox(height: 25),

            // Statistics Grid (matching the mentor panel)
            _buildStatsGrid(activeMentor),
            const SizedBox(height: 25),

            // Bio Section
            _buildSectionCard(
              title: 'بیوگرافی راهبر',
              child: Text(
                activeMentor['bio'],
                textAlign: TextAlign.right,
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.6, fontFamily: 'Vazirmatn'),
              ),
            ),
            const SizedBox(height: 20),

            // Certifications Section (شناسنامه و گواهی‌ها)
            _buildSectionCard(
              title: '🎖️ گواهی‌ها و قابلیت‌های راهبر',
              child: Column(
                children: certs.map((cert) => InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => MentorQualificationDetailScreen(qualification: cert),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text(
                            cert['title']!,
                            textAlign: TextAlign.right,
                            style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Icon(Icons.verified, color: Color(0xFF10B981), size: 18),
                      ],
                    ),
                  ),
                )).toList(),
              ),
            ),
            const SizedBox(height: 50),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            title,
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildStatsGrid(Map<String, dynamic> mentor) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _buildStatItem('کاروان‌های تحت مدیریت', '${mentor['caravans']} کاروان', Icons.emoji_transportation, const Color(0xFFFFD54F)),
        _buildStatItem('اعضای تحت پوشش', '${mentor['members']} نفر', Icons.people, const Color(0xFF8B5CF6)),
        _buildStatItem('سقوط یاوران موفق', '۱۲ چالش', Icons.military_tech, const Color(0xFF10B981)),
        _buildStatItem('رضایت اعضا از راهبر', '${mentor['rating']} / ۵', Icons.star, const Color(0xFFEC4899)),
      ],
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.1)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
          const SizedBox(height: 2),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'Vazirmatn')),
        ],
      ),
    );
  }
}
