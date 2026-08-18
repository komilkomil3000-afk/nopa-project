import 'package:flutter/material.dart';
import 'dart:async' as java_timer;
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../widgets/nopa_notification_dialog.dart';
import '../utils/tasks_repository.dart';
import '../utils/global_state.dart';
import '../widgets/create_challenge_dialog.dart';

// Simple static notification manager to simulate real-time notifications
class NotificationManager {
  static final List<String> notifications = [
    'به کاروان یاوران علاءالملک خوش آمدید!',
  ];
  static bool hasNewNotification = true;
}

class MentorTasksScreen extends StatefulWidget {
  const MentorTasksScreen({super.key});

  @override
  State<MentorTasksScreen> createState() => _MentorTasksScreenState();
}

class _MentorTasksScreenState extends State<MentorTasksScreen> {
  int _activeTab = 0; // 0: Tasks, 1: Tickets
  int _currentSlide = 0;
  final PageController _pageController = PageController();
  java_timer.Timer? _bannerTimer;

  final List<Map<String, String>> _slides = [
    {
      'title': 'برنامه‌ریزی آموزشی کاروان‌ها 🍂',
      'desc': 'ساماندهی تکالیف و پایش مستمر روند رشد اعضا',
      'image': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    },
    {
      'title': 'پویش هم‌سنگران نپا 🏆',
      'desc': 'ارزیابی شایستگی‌های عمومی و تخصصی کاروان‌ها',
      'image': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800',
    },
    {
      'title': 'پشتیبانی پاسخگو و تیکت‌ها ✉️',
      'desc': 'بررسی سریع گزارش‌ها و حل چالش‌های کارآموزان',
      'image': 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
    },
  ];


  // Read from shared repository
  final List<Map<String, dynamic>> _assignments = TasksRepository.assignments;

  @override
  void initState() {
    super.initState();
    _bannerTimer = java_timer.Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_pageController.hasClients) {
        final next = (_currentSlide + 1) % _slides.length;
        _pageController.animateToPage(
          next,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }


  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (TasksRepository.shouldAutoOpenCreateChallenge) {
      TasksRepository.shouldAutoOpenCreateChallenge = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        CreateChallengeDialog.show(context, onSuccess: () {});
      });
    }
  }

  void _showGradingDialog(Map<String, dynamic> submission, Map<String, dynamic> assignment) {
    final TextEditingController scoreController = TextEditingController(text: '50');
    String actionType = 'reward'; // reward, punish, normal

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.white70),
                            onPressed: () => Navigator.pop(context),
                          ),
                          Text(
                            'بررسی تکلیف: ${submission['name']}',
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const Divider(color: Colors.white10),
                      const SizedBox(height: 10),
                      
                      const Text('متن ارسالی تکلیف:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 6),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF160E2A),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          submission['details'],
                          textAlign: TextAlign.right,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Score Input
                      const Text('امتیازدهی (زریک):', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: scoreController,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white),
                        textAlign: TextAlign.center,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: const Color(0xFF160E2A),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Rewards & Punishments Selector
                      const Text('سیستم تشویق و تنبیه:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          // Punish Button
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setDialogState(() => actionType = 'punish'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: actionType == 'punish' ? Colors.redAccent.withValues(alpha: 0.2) : const Color(0xFF160E2A),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: actionType == 'punish' ? Colors.redAccent : Colors.transparent,
                                  ),
                                ),
                                child: const Center(
                                  child: Text('تنبیه (-۲۵ زریک) 🚨', style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Reward Button
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setDialogState(() => actionType = 'reward'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: actionType == 'reward' ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFF160E2A),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: actionType == 'reward' ? const Color(0xFF10B981) : Colors.transparent,
                                  ),
                                ),
                                child: const Center(
                                  child: Text('تشویق (+۵۰ زریک) 🏆', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      
                      // Submit Button
                      Container(
                        width: double.infinity,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)]),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context);
                            
                            // Send notification
                            String notificationMsg = 'تکلیف ${assignment['title']} شما بررسی و تایید شد. ⭐';
                            
                            // Sync with GlobalState challenges
                            final cleanTitle = assignment['title'].toString().replaceAll('منزلگاه ۳: تکلیف ', '').replaceAll('چالش ', '').trim();
                            for (var c in GlobalState.challenges) {
                              if (assignment['title'].toString().contains(c['title']) || c['title'].toString().contains(cleanTitle)) {
                                c['status'] = 'archived_completed';
                                int bonus = 0;
                                if (actionType == 'reward') bonus = 50;
                                if (actionType == 'punish') bonus = -25;
                                
                                final int finalReward = (c['reward'] as int) + bonus;
                                GlobalState.zarik += finalReward;
                                notificationMsg = 'چالش "${c['title']}" شما تایید شد و شما $finalReward زریک دریافت کردید! 🎉';
                                break;
                              }
                            }
                            
                            setState(() {
                              submission['status'] = 'approved';
                              NotificationManager.notifications.add(notificationMsg);
                              NotificationManager.hasNewNotification = true;
                            });

                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('امتیاز ثبت شد و اعلان برای مخاطب ارسال گردید', style: TextStyle(fontFamily: 'Vazirmatn')),
                                backgroundColor: Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('ثبت و ارسال به مخاطب', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Beach Sunset Backdrop Header
            _buildBackdropHeader(),
            
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 10),
                  
                  // Title "تکالیف و تیکت‌ها"
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: const [
                      Text(
                        'تکالیف و تیکت‌ها',
                        style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(width: 8),
                      Text('📝', style: TextStyle(fontSize: 18)),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Tab Selector: تکالیف / تیکت‌ها
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _activeTab = 1),
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: _activeTab == 1 ? const Color(0xFF8B5CF6) : const Color(0xFF1E1435),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
                            ),
                            child: const Center(
                              child: Text('تیکت‌ها ✉️', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _activeTab = 0),
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: _activeTab == 0 ? const Color(0xFFEC4899) : const Color(0xFF1E1435),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
                            ),
                            child: const Center(
                              child: Text('تکالیف 📌', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 20),
                  
                  // Main Content based on Tab
                  if (_activeTab == 0) ...[
                    // Create Assignment/Challenge Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => CreateChallengeDialog.show(context, onSuccess: () {}),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Color(0xFFFFD54F)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.star, color: Color(0xFFFFD54F), size: 16),
                            label: const Text('ایجاد چالش / تکلیف جدید', style: TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    
                    // Assignment Card List
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _assignments.length,
                      itemBuilder: (context, index) {
                        final assign = _assignments[index];
                        return _buildAssignmentCard(assign);
                      },
                    ),
                  ] else ...[
                    // Tickets Placeholder/Mock
                    _buildTicketsMockList(),
                  ],
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
    return SizedBox(
      height: 220,
      width: double.infinity,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            onPageChanged: (val) {
              setState(() {
                _currentSlide = val;
              });
            },
            itemCount: _slides.length,
            itemBuilder: (context, idx) {
              final slide = _slides[idx];
              return Container(
                decoration: BoxDecoration(
                  image: DecorationImage(
                    image: NetworkImage(slide['image']!),
          onError: (e, s) => debugPrint('Image load error'),
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
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          slide['title']!,
                          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          slide['desc']!,
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
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
                    Row(
                      children: [
                        const Text(
                          'پنل راهبر نپا',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFFFD700), width: 1.5),
                          ),
                          child: CircleAvatar(
                            radius: 16,
                            backgroundImage: NetworkImage('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'),
                      onBackgroundImageError: (e, s) => debugPrint('Avatar load error'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 12,
            right: 20,
            child: Row(
              children: List.generate(_slides.length, (idx) {
                final isSel = _currentSlide == idx;
                return Container(
                  margin: const EdgeInsets.only(left: 4),
                  width: isSel ? 16 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: isSel ? const Color(0xFFEC4899) : Colors.white30,
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignmentCard(Map<String, dynamic> assign) {
    final submissions = assign['submissions'] as List<Map<String, String>>;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Icon(Icons.pin_drop, color: Colors.redAccent, size: 20),
              Text(
                assign['title'],
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'ارسال شده: ${assign['submissionsCount']}',
            style: const TextStyle(color: Colors.white38, fontSize: 11),
          ),
          const SizedBox(height: 12),
          
          // Submissions status row
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: submissions.map((sub) {
              String statusIcon = '✅';
              Color statusColor = const Color(0xFF10B981);
              if (sub['status'] == 'pending') {
                statusIcon = '⏳';
                statusColor = const Color(0xFFFFD54F);
              } else if (sub['status'] == 'rejected') {
                statusIcon = '❌';
                statusColor = Colors.redAccent;
              }

              return GestureDetector(
                onTap: () {
                  if (sub['status'] == 'pending') {
                    _showGradingDialog(sub, assign);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('تکلیف ${sub['name']} در وضعیت ${sub['status']} قرار دارد')),
                    );
                  }
                },
                child: Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Text(statusIcon, style: const TextStyle(fontSize: 10)),
                      const SizedBox(width: 4),
                      Text(sub['name']!, style: const TextStyle(color: Colors.white, fontSize: 11)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          
          const SizedBox(height: 16),
          
          // View all button
          Container(
            width: double.infinity,
            height: 40,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)]),
              borderRadius: BorderRadius.circular(12),
            ),
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('مشاهده همه', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTicketsMockList() {
    final tickets = GlobalState.tickets;

    if (tickets.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1435),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
        ),
        child: Column(
          children: const [
            Icon(Icons.mark_email_unread_outlined, color: Colors.white24, size: 40),
            SizedBox(height: 10),
            Text('تیکت فعالی وجود ندارد', style: TextStyle(color: Colors.white38, fontSize: 13, fontFamily: 'Vazirmatn')),
          ],
        ),
      );
    }

    return Column(
      children: tickets.map((ticket) {
        final isAnswered = ticket['status'] == 'answered';
        final int rating = ticket['rating'] ?? 0;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1435),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isAnswered ? Colors.white10 : const Color(0xFF8B5CF6).withValues(alpha: 0.3),
              width: 1.2,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isAnswered
                          ? const Color(0xFF10B981).withValues(alpha: 0.12)
                          : const Color(0xFFFFD54F).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isAnswered ? 'پاسخ داده شده' : 'نیاز به راهنمایی ⏳',
                      style: TextStyle(
                        color: isAnswered ? const Color(0xFF10B981) : const Color(0xFFFFD54F),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ),
                  Text(
                    'درخواست راهنمایی از: ${ticket['sender']}',
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                  ),
                ],
              ),
              const Divider(color: Colors.white10, height: 20),
              Text(
                ticket['message'],
                textAlign: TextAlign.right,
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5, fontFamily: 'Vazirmatn'),
              ),
              const SizedBox(height: 14),
              if (isAnswered) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF160E2A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.15)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'پاسخ شما:',
                        style: TextStyle(color: Color(0xFFD946EF), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        ticket['answer'] ?? '',
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    rating > 0
                        ? Row(
                            children: List.generate(5, (sIdx) {
                              return Icon(
                                sIdx < rating ? Icons.star : Icons.star_border,
                                color: const Color(0xFFFFD54F),
                                size: 16,
                              );
                            }),
                          )
                        : const Text(
                            'در انتظار امتیازدهی مخاطب ⏳',
                            style: TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'Vazirmatn'),
                          ),
                    const Text(
                      'امتیاز ثبت شده مخاطب:',
                      style: TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'Vazirmatn'),
                    ),
                  ],
                ),
              ] else ...[
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: ElevatedButton.icon(
                    onPressed: () => _showAnswerTicketDialog(ticket),
                    icon: const Icon(Icons.reply, color: Colors.white, size: 16),
                    label: const Text(
                      'پاسخ و راهنمایی به تیکت',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn'),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }

  void _showAnswerTicketDialog(Map<String, dynamic> ticket) {
    final TextEditingController replyCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'ثبت پاسخ برای ${ticket['sender']}',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                ),
                const Divider(color: Colors.white10),
                const SizedBox(height: 8),
                Text(
                  'سوال: ${ticket['message']}',
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white54, fontSize: 12, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 14),
                const Text('متن راهنمایی و پاسخ شما:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
                const SizedBox(height: 6),
                TextField(
                  controller: replyCtrl,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white),
                  textAlign: TextAlign.right,
                  decoration: InputDecoration(
                    hintText: 'راهنمایی خود را بنویسید...',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                    filled: true,
                    fillColor: const Color(0xFF160E2A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: () {
                      if (replyCtrl.text.isEmpty) return;
                      Navigator.pop(context);

                      final cleanText = ticket['message'].toString().length > 15
                          ? '${ticket['message'].toString().substring(0, 15)}...'
                          : ticket['message'];

                      final notificationMsg = 'راهبر به سوال شما با عنوان «$cleanText» پاسخ داد. لطفا امتیاز دهید! 💬⭐';

                      setState(() {
                        ticket['status'] = 'answered';
                        ticket['answer'] = replyCtrl.text;
                        NotificationManager.notifications.add(notificationMsg);
                        NotificationManager.hasNewNotification = true;
                      });

                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('پاسخ با موفقیت ارسال شد و برای مخاطب نوتیفیکیشن صادر گردید ✅', style: TextStyle(fontFamily: 'Vazirmatn')),
                          backgroundColor: Color(0xFF10B981),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6)),
                    child: const Text('ارسال پاسخ به مخاطب', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
