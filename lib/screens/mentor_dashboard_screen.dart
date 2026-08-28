import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../widgets/create_challenge_dialog.dart';
import '../services/app_state_repository.dart';
import '../widgets/nopa_notification_dialog.dart';
import '../widgets/safe_avatar.dart';
import '../main.dart';


class MentorDashboardScreen extends StatefulWidget {
  const MentorDashboardScreen({super.key});

  @override
  State<MentorDashboardScreen> createState() => _MentorDashboardScreenState();
}

class _MentorDashboardScreenState extends State<MentorDashboardScreen> {
  final ScrollController _scrollController = ScrollController();
  List<String> _caravans = [];
  String _selectedCaravan = '';

  Map<String, String> _caravanNameToId = {};


  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    
    _caravans = [repository.currentUser.caravanName ?? 'فاقد کاروان'];
    _caravanNameToId = {repository.currentUser.caravanName ?? 'فاقد کاروان': repository.currentUser.caravanId ?? ''};
    
    _selectedCaravan = _caravans.first;
    
    final currentUser = repository.currentUser;
    final activeData = repository.activeCaravanStats;

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      body: SingleChildScrollView(
        controller: _scrollController,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Backdrop Header with Hamburger drawer triggers & Notification bell
            _buildBackdropHeader(),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Caravan Selection Box
                  _buildCaravanSelectionCard(),
                  const SizedBox(height: 20),

                  // Grid of Stats (2x2)
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.5,
                    children: [
                      _buildStatCard(
                        activeData['progress'],
                        'میانگین پیشرفت',
                        const Color(0xFFEC4899),
                        activeData['progressVal'],
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('میانگین پیشرفت کاروان بر اساس کلاس‌های گذرانده اعضا محاسبه شده است.', style: TextStyle(fontFamily: 'Vazirmatn')),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                      ),
                      _buildStatCard(
                        '${currentUser.managedMembersCount}',
                        'اعضای تحت پوشش',
                        const Color(0xFF3B82F6),
                        currentUser.managedMembersCount / 25.0, // assuming 25 capacity
                        onTap: () {
                          context.findAncestorStateOfType<MainScreenState>()?.setIndex(1); // MentorMembersScreen
                        },
                      ),
                      _buildStatCard(
                        activeData['tickets'],
                        'تیکت باز',
                        const Color(0xFFF97316),
                        activeData['ticketsVal'],
                        onTap: () {
                          _scrollController.animateTo(
                            _scrollController.position.maxScrollExtent,
                            duration: const Duration(milliseconds: 600),
                            curve: Curves.easeInOut,
                          );
                        },
                      ),
                      _buildStatCard(
                        '${currentUser.satisfactionScore}',
                        'امتیاز رضایت',
                        const Color(0xFF10B981),
                        currentUser.satisfactionScore / 5.0,
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('میانگین امتیاز رضایت دانش‌آموزان از شما', style: TextStyle(fontFamily: 'Vazirmatn')),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 25),

                  // Progress group section
                  _buildGroupProgressSection(activeData),
                  const SizedBox(height: 25),

                  // Tickets Section
                  _buildTicketsSection(),
                  const SizedBox(height: 25),

                  // Management challenges section
                  _buildChallengesManagementSection(),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackdropHeader() {
    return Container(
      height: 180,
      width: double.infinity,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: NetworkImage('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800'),
          onError: (e, s) => debugPrint('Image failed to load: $e'),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.black54, Color(0xFF0F081D)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: Menu & Notification Icons (Forced LTR for correct edge rendering)
              Directionality(
                textDirection: TextDirection.ltr,
                child: Row(
                  children: [
                    // Hamburger Menu Button (Leftmost)
                    GestureDetector(
                      onTap: () {
                        Scaffold.of(context).openDrawer();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(color: Colors.black38, shape: BoxShape.circle),
                        child: const Icon(Icons.menu, color: Colors.white, size: 20),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Consumer<AppRepository>(
                      builder: (context, repository, _) {
                        final count = repository.unreadNotificationsCount;
                        return Stack(
                          children: [
                            GestureDetector(
                              onTap: () => NopaNotificationDialog.show(context),
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(color: Colors.black38, shape: BoxShape.circle),
                                child: const Icon(Icons.notifications_none, color: Colors.white, size: 20),
                              ),
                            ),
                            if (count > 0)
                              Positioned(
                                right: 0,
                                top: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: const BoxDecoration(
                                    color: Colors.red,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Text(
                                    '$count',
                                    style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
              // Right: Title & Avatar
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Text(
                        'پنل راهبر نپا',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'مدیریت کاروان‌ها',
                        style: TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'Vazirmatn'),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFFFD700), width: 1.5),
                    ),
                    child: SafeAvatar(
                      radius: 20,
                      backgroundColor: Colors.white24,
                      imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
                      name: 'راهبر',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCaravanSelectionCard() {
    final repository = Provider.of<AppRepository>(context, listen: false);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Farsi Dropdown Select
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedCaravan,
              dropdownColor: const Color(0xFF1E1435),
              icon: const Icon(Icons.arrow_drop_down, color: Colors.white70),
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              items: _caravans.map((String c) {
                return DropdownMenuItem<String>(
                  value: c,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(c, textDirection: TextDirection.rtl),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _selectedCaravan = val;
                  });
                  final caravanId = _caravanNameToId[val] ?? 'c1';
                  repository.switchCaravan(caravanId);
                }
              },
            ),
          ),
          const Row(
            children: [
              Text(
                'کاروان فعال جهت رصد:',
                style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
              ),
              SizedBox(width: 6),
              Icon(Icons.emoji_transportation, color: Color(0xFF8B5CF6), size: 16),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String value, String label, Color color, double progressVal, {VoidCallback? onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1435),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                value,
                style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(color: Colors.white60, fontSize: 11, fontFamily: 'Vazirmatn'),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progressVal,
                  minHeight: 4,
                  backgroundColor: const Color(0xFF160E2A),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGroupProgressSection(Map<String, dynamic> activeData) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                activeData['progress'],
                style: const TextStyle(color: Color(0xFFEC4899), fontWeight: FontWeight.bold, fontSize: 16, fontFamily: 'Vazirmatn'),
              ),
              const Text(
                'پیشرفت آموزشی گروه',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildProgressRow('منزلگاه ۱', activeData['progressM1'], '${(activeData['progressM1'] * 100).toInt()}%', const Color(0xFF8B5CF6)),
          const SizedBox(height: 12),
          _buildProgressRow('منزلگاه ۲', activeData['progressM2'], '${(activeData['progressM2'] * 100).toInt()}%', const Color(0xFF8B5CF6)),
          const SizedBox(height: 12),
          _buildProgressRow('منزلگاه ۳ (فعلی)', activeData['progressM3'], '${(activeData['progressM3'] * 100).toInt()}%', const Color(0xFFEC4899)),
          const SizedBox(height: 12),
          _buildProgressRow('منزلگاه ۴', activeData['progressM4'], '${(activeData['progressM4'] * 100).toInt()}%', const Color(0xFFF97316)),
          const SizedBox(height: 12),
          _buildProgressRow('منزلگاه ۵', activeData['progressM5'] ?? 0.0, '${((activeData['progressM5'] ?? 0.0) * 100).toInt()}%', const Color(0xFF10B981)),
        ],
      ),
    );
  }

  Widget _buildProgressRow(String label, double value, String percentageText, Color color) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(percentageText, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn')),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 6,
            backgroundColor: const Color(0xFF160E2A),
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }

  Widget _buildTicketsSection() {
    final repository = Provider.of<AppRepository>(context);
    final pendingSubmissions = repository.submissions.where((s) => s.status == 'pending').toList();
    final List<Map<String, String>> mappedTickets = pendingSubmissions.map((s) => {
      'id': s.id,
      'user': s.studentName,
      'type': 'task',
      'desc': s.answerText,
      'time': 'هم‌اکنون',
      'isPending': 'true',
    }).toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(Icons.mark_chat_unread, color: Colors.white30, size: 20),
              Text(
                'تیکت‌ها و درخواست‌های معلق کاروان',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
            ],
          ),
          const SizedBox(height: 14),
            if (mappedTickets.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 20.0),
                  child: Text(
                    'درخواستی وجود ندارد',
                    style: TextStyle(color: Colors.white30, fontSize: 13, fontFamily: 'Vazirmatn'),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: mappedTickets.length,
                itemBuilder: (context, index) {
                  final ticket = mappedTickets[index];

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF160E2A),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(ticket['time']!, style: const TextStyle(color: Colors.white24, fontSize: 11, fontFamily: 'Vazirmatn')),
                          Text(
                            ticket['user']!,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        ticket['desc']!,
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                context.findAncestorStateOfType<MainScreenState>()?.setIndex(2); // MentorWorkbenchScreen index
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              child: const Text('انتقال به میزکار جهت بررسی تخصصی', style: TextStyle(color: Color(0xFF8B5CF6), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildChallengesManagementSection() {
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
          const Text(
            'بخش ابلاغ چالش‌های جدید',
            style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
          ),
          const SizedBox(height: 6),
          const Text(
            'چالش‌های چند گزینه‌ای و مهارتی بنویسید و مقدار زریک پاداش آنها را مشخص کنید.',
            textAlign: TextAlign.right,
            style: TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'Vazirmatn'),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)]),
              borderRadius: BorderRadius.circular(14),
            ),
            child: ElevatedButton(
              onPressed: () {
                CreateChallengeDialog.show(context, onSuccess: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('چالش جدید طراحی شد و برای اعضا ابلاغ گردید 🚀', style: TextStyle(fontFamily: 'Vazirmatn')),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'ایجاد چالش مهارتی جدید ➕',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Vazirmatn'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

