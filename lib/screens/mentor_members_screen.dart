import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../utils/global_state.dart';
import '../widgets/nopa_notification_dialog.dart';
import '../widgets/safe_avatar.dart';


class MentorMembersScreen extends StatefulWidget {
  const MentorMembersScreen({super.key});

  @override
  State<MentorMembersScreen> createState() => _MentorMembersScreenState();
}

class _MarketMember {
  final String id;
  final String name;
  final String caravan;
  final String lastActive;
  final String gender; // male, female
  final ProfileLevel profileLevel;
  final String xp;
  final double progress;
  final List<String> completedClasses;
  final List<Map<String, String>> reports;
  final String avatarUrl;

  _MarketMember({
    required this.id,
    required this.name,
    required this.caravan,
    required this.lastActive,
    required this.gender,
    required this.profileLevel,
    required this.xp,
    required this.progress,
    required this.completedClasses,
    required this.reports,
    required this.avatarUrl,
  });
}

class _MentorMembersScreenState extends State<MentorMembersScreen> {
  String _selectedCaravan = 'یاوران علاءالملک';
  List<String> _caravans = [];
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  List<_MarketMember> _allMembers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMembers();
  }

  Future<void> _loadMembers() async {
    final repository = Provider.of<AppRepository>(context, listen: false);
    final caravanId = repository.currentUser.caravanId;
    if (caravanId == null || caravanId.isEmpty) {
      setState(() {
        _isLoading = false;
      });
      return;
    }

    final details = await HttpApiService().getCaravanDetails(caravanId);
    if (details != null && details['membersList'] != null) {
      final List<dynamic> list = details['membersList'];
      final mapped = list.map((m) {
        return _MarketMember(
          id: m['id'] ?? '',
          name: m['name'] ?? 'بدون نام',
          caravan: repository.currentUser.caravanName ?? 'فاقد کاروان',
          lastActive: 'نامشخص',
          gender: 'unknown',
          profileLevel: m['levelFrame'] == 2 ? ProfileLevel.silver : ProfileLevel.newcomer,
          xp: '${m['zarikBalance'] ?? 0} زریک',
          progress: 0.0,
          completedClasses: [],
          reports: [],
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
        );
      }).toList();

      setState(() {
        _allMembers = mapped;
        _caravans = [repository.currentUser.caravanName ?? 'فاقد کاروان'];
        _selectedCaravan = _caravans.first;
        _isLoading = false;
      });
    } else {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Filter members by selected caravan and search query
    final filteredMembers = _allMembers.where((m) {
      final matchesCaravan = m.caravan == _selectedCaravan;
      final matchesSearch = m.name.contains(_searchQuery);
      return matchesCaravan && matchesSearch;
    }).toList();

    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F081D),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildBackdropHeader(),
            
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 10),
                  _buildCaravanSelector(),
                  const SizedBox(height: 20),
                  
                  // Section Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: const [
                      Text(
                        'اعضای کاروان فعال',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                      SizedBox(width: 8),
                      Text('👥', style: TextStyle(fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Search Row
                  Row(
                    children: [
                      Container(
                        height: 52,
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                        ),
                        child: TextButton.icon(
                          onPressed: () {},
                          icon: const Icon(Icons.arrow_drop_down, color: Colors.white, size: 18),
                          label: const Text('فیلتر سطح', style: TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'Vazirmatn')),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          textAlign: TextAlign.right,
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val;
                            });
                          },
                          decoration: InputDecoration(
                            hintText: 'جستجوی نام عضو کاروان...',
                            hintStyle: const TextStyle(color: Colors.white30, fontSize: 12, fontFamily: 'Vazirmatn'),
                            filled: true,
                            fillColor: const Color(0xFF1E1435),
                            contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  
                  // Members List
                  if (filteredMembers.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 40.0),
                        child: Text(
                          'عضوی در این کاروان با این مشخصات یافت نشد 🧐',
                          style: TextStyle(color: Colors.white38, fontFamily: 'Vazirmatn', fontSize: 12),
                        ),
                      ),
                    )
                  else
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredMembers.length,
                      itemBuilder: (context, index) {
                        final member = filteredMembers[index];
                        return _buildMemberCard(member);
                      },
                    ),
                  const SizedBox(height: 16),
                  
                  // Show more button
                  Container(
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: ElevatedButton(
                      onPressed: () => _showAllMembersBottomSheet(context, filteredMembers),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        'نمایش بیشتر اعضا (+${filteredMembers.length} نفر)',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn'),
                      ),
                    ),
                  ),
                  const SizedBox(height: 100),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  void _showAllMembersBottomSheet(BuildContext context, List<_MarketMember> members) {
    String localQuery = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final filtered = members.where((m) {
              return m.name.contains(localQuery);
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              padding: const EdgeInsets.all(20),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Column(
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 5,
                        decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'لیست کامل اعضای کاروان',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        Text(
                          'تعداد: ${filtered.length} نفر',
                          style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontFamily: 'Vazirmatn'),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white10, height: 24),
                    
                    TextField(
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      textAlign: TextAlign.right,
                      onChanged: (val) {
                        setSheetState(() {
                          localQuery = val;
                        });
                      },
                      decoration: InputDecoration(
                        hintText: 'جستجوی عضو...',
                        hintStyle: const TextStyle(color: Colors.white30, fontSize: 12, fontFamily: 'Vazirmatn'),
                        filled: true,
                        fillColor: const Color(0xFF160E2A),
                        prefixIcon: const Icon(Icons.search, color: Colors.white30, size: 20),
                        contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    Expanded(
                      child: filtered.isEmpty
                          ? const Center(child: Text('عضوی یافت نشد 🧐', style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')))
                          : ListView.builder(
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final member = filtered[index];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF160E2A),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Row(
                                    children: [
                                      SafeAvatar(
                                        radius: 20,
                                        imageUrl: member.avatarUrl,
                                        name: member.name,
                                        backgroundColor: Colors.white10,
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(member.name, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                                            Text('پیشرفت: ${(member.progress * 100).toInt()}%  ·  فعالیت: ${member.lastActive}', style: const TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'Vazirmatn')),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.arrow_forward_ios, color: Colors.white24, size: 12),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            );
          }
        );
      },
    );
  }

  Widget _buildBackdropHeader() {
    return Container(
      height: 180,
      width: double.infinity,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: NetworkImage('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'),
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
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
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
                  const Text(
                    'پنل راهبر نپا',
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFFFD700), width: 1.5),
                    ),
                    child: SafeAvatar(
                      radius: 18,
                      imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
                      name: 'ناشناس',
                    ),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCaravanSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedCaravan,
          dropdownColor: const Color(0xFF1E1435),
          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
          icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFFEC4899)),
          isExpanded: true,
          items: _caravans.map((String c) {
            return DropdownMenuItem<String>(
              value: c,
              child: Align(
                alignment: Alignment.centerRight,
                child: Text('کاروان فعال: $c'),
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedCaravan = val;
              });
            }
          },
        ),
      ),
    );
  }

  Widget _buildMemberCard(_MarketMember member) {
    final frameColor = GlobalState.getLevelColor(member.profileLevel);
    final frameGlow = GlobalState.getLevelGlow(member.profileLevel);

    return GestureDetector(
      onTap: () => _showMemberDetailsDialog(member),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1435),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.02)),
        ),
        child: Row(
          children: [
            // Left Action Icons
            Row(
              children: [
                Tooltip(
                  message: "سیستم گفتگو به‌زودی فعال می‌شود",
                  child: _buildActionCircle(Icons.chat_bubble_outline, disabled: true),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _showStudentPerformanceModal(context, member),
                  child: _buildActionCircle(Icons.insert_drive_file_outlined),
                ),
              ],
            ),
            const Spacer(),
            
            // Member Info
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  member.name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      GlobalState.getLevelLabel(member.profileLevel),
                      style: TextStyle(color: frameColor, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'فعالیت: ${member.lastActive}',
                      style: const TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'Vazirmatn'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(width: 14),
            
            // Member Profile Avatar with Level frame & glow
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: frameColor, width: 2),
                boxShadow: frameGlow,
              ),
              child: SafeAvatar(
                radius: 18,
                imageUrl: member.avatarUrl,
                name: member.name,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCircle(IconData icon, {bool disabled = false, Color color = Colors.white}) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: disabled ? Colors.grey.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.1),
      ),
      child: Icon(icon, color: disabled ? Colors.grey : color, size: 18),
    );
  }

  void _showStudentPerformanceModal(BuildContext context, _MarketMember member) async {
    // Show a loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (c) => const Center(child: CircularProgressIndicator()),
    );

    // Call API via repository
    final repository = Provider.of<AppRepository>(context, listen: false);
    // Since we mock users in the UI, if API fails we will show a mock response or an error
    final dynamic response = await repository.getStudentPerformance(member.id);
    
    // ignore: use_build_context_synchronously
    Navigator.pop(context); // close loader

    if (response == null) {
      // Show fallback error or mock
      // ignore: use_build_context_synchronously
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('خطا در دریافت اطلاعات زنده، یا کاربر در دیتابیس یافت نشد.')));
      // You can call the old _showMemberDetailsDialog here if you want a fallback
      // ignore: use_build_context_synchronously
      _showMemberDetailsDialog(member);
      return;
    }

    final data = response;
    final userMap = data['user'] ?? {};
    final watchRecords = data['watchRecords'] as List? ?? [];
    final quizzes = data['quizzes'] as List? ?? [];
    
    // Parse Real-Data Overview
    final name = userMap['name'] ?? member.name;
    final phone = userMap['phoneNumber'] ?? '0912***0000';
    final zarikBalance = userMap['zarikBalance'] ?? 0;
    
    // Calculate station overall progress (mocking out of total 10 classes)
    final completedClasses = watchRecords.where((r) => r['watchedPercentage'] >= 70).length;
    final stationProgress = watchRecords.isEmpty ? 0.0 : (completedClasses / watchRecords.length);

    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (BuildContext context) {
        final frameColor = GlobalState.getLevelColor(member.profileLevel);
        final frameGlow = GlobalState.getLevelGlow(member.profileLevel);

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
                      const Text(
                        'پرونده عملکرد کارآموز (داده واقعی)',
                        style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 10),
                  
                  // Personal Overview
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                          const SizedBox(height: 4),
                          Text(
                            'شماره تماس: $phone',
                            style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn'),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'موجودی فعال زریک: $zarikBalance',
                            style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: frameColor, width: 2),
                          boxShadow: frameGlow,
                        ),
                        child: SafeAvatar(
                          radius: 22,
                          imageUrl: member.avatarUrl,
                          name: member.name,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Station Overall Progress
                  const Text('میزان پیشرفت در ایستگاه فعال:', style: TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: stationProgress,
                      minHeight: 6,
                      backgroundColor: const Color(0xFF160E2A),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFEC4899)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Chronological Class Attendance List
                  const Text('📚 روند حضور در کلاس‌ها:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 8),
                  if (watchRecords.isEmpty)
                    const Text('رکوردی یافت نشد', style: TextStyle(color: Colors.white30, fontSize: 11, fontFamily: 'Vazirmatn'))
                  else
                    ...watchRecords.map((r) {
                      final isCompleted = r['watchedPercentage'] >= 70;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF160E2A),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Icon(isCompleted ? Icons.check_circle : Icons.cancel, color: isCompleted ? Colors.green : Colors.red, size: 16),
                            Expanded(
                              child: Text(
                                r['session']?['title'] ?? 'کلاس',
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'Vazirmatn'),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  
                  const SizedBox(height: 16),

                  // Challenges & Quizzes Ledger
                  const Text('📝 دفترچه چالش‌ها و آزمون‌ها:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 8),
                  if (quizzes.isEmpty)
                    const Text('چالشی ثبت نشده است', style: TextStyle(color: Colors.white30, fontSize: 11, fontFamily: 'Vazirmatn'))
                  else
                    ...quizzes.map((q) {
                      final status = q['status'] ?? 'pending';
                      final isApproved = status == 'approved';
                      final isRejected = status == 'rejected';
                      final score = q['score'] ?? 0;
                      final challengeName = q['challenge']?['title'] ?? 'چالش';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF160E2A),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isApproved ? '+$score زریک' : (isRejected ? 'رد شده' : 'در انتظار'),
                              style: TextStyle(
                                color: isApproved ? Colors.green : (isRejected ? Colors.red : Colors.orange),
                                fontSize: 10,
                                fontFamily: 'Vazirmatn',
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                challengeName,
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'Vazirmatn'),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showMemberDetailsDialog(_MarketMember member) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        final frameColor = GlobalState.getLevelColor(member.profileLevel);
        final frameGlow = GlobalState.getLevelGlow(member.profileLevel);

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
                      const Text(
                        'مشخصات و عملکرد کارآموز',
                        style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 10),
                  
                  // Profile Overview
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(member.name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                          const SizedBox(height: 4),
                          Text(
                            'سطح ${GlobalState.getLevelLabel(member.profileLevel)} · ${member.xp}',
                            style: TextStyle(color: frameColor, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: frameColor, width: 2),
                          boxShadow: frameGlow,
                        ),
                        child: SafeAvatar(
                          radius: 22,
                          imageUrl: member.avatarUrl,
                          name: member.name,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Progress Bar
                  const Text('میزان پیشرفت در کاروان:', style: TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: member.progress,
                      minHeight: 6,
                      backgroundColor: const Color(0xFF160E2A),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFEC4899)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Passed Classes
                  const Text('📚 دوره‌های گذرانده شده:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 8),
                  if (member.completedClasses.isEmpty)
                    const Text('هنوز دوره‌ای کامل نشده است', style: TextStyle(color: Colors.white30, fontSize: 11, fontFamily: 'Vazirmatn'))
                  else
                          // Work Reports
                  const Text('📝 تکالیف و گزارش‌های ارسالی:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 8),
                  Builder(
                    builder: (context) {
                      final repository = Provider.of<AppRepository>(context, listen: false);
                      final studentSubmissions = repository.submissions.where((s) => s.studentName == member.name).toList();

                      if (studentSubmissions.isEmpty) {
                        return const Text('گزارش یا تکلیفی یافت نشد', style: TextStyle(color: Colors.white30, fontSize: 11, fontFamily: 'Vazirmatn'));
                      }

                      return ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: studentSubmissions.length,
                        itemBuilder: (context, index) {
                          final rep = studentSubmissions[index];
                          final isPending = rep.status == 'pending';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF160E2A),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: rep.status == 'approved'
                                            ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                            : (rep.status == 'rejected' ? Colors.redAccent.withValues(alpha: 0.15) : const Color(0xFFFFD54F).withValues(alpha: 0.15)),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        rep.status == 'approved' ? 'تایید شده' : (rep.status == 'rejected' ? 'رد شده' : 'در انتظار بررسی'),
                                        style: TextStyle(
                                          color: rep.status == 'approved' ? const Color(0xFF10B981) : (rep.status == 'rejected' ? Colors.redAccent : const Color(0xFFFFD54F)),
                                          fontSize: 9,
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        rep.answerText,
                                        textAlign: TextAlign.right,
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500, fontFamily: 'Vazirmatn'),
                                      ),
                                    ),
                                  ],
                                ),
                                if (isPending) ...[
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.start,
                                    children: [
                                      ElevatedButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                          repository.reviewSubmission(rep.id, true, 200.0);
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('🎉 پاداش مبارک! +۲۰۰ زریک به ولت شما اضافه شد', style: TextStyle(fontFamily: 'Vazirmatn')),
                                              backgroundColor: Color(0xFF10B981),
                                              behavior: SnackBarBehavior.floating,
                                            ),
                                          );
                                        },
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF10B981),
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                                          minimumSize: Size.zero,
                                        ),
                                        child: const Text('تایید تکلیف', style: TextStyle(color: Colors.white, fontSize: 10, fontFamily: 'Vazirmatn')),
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                          repository.reviewSubmission(rep.id, false, 0.0);
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('تکلیف رد شد ❌'), backgroundColor: Colors.redAccent),
                                          );
                                        },
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.redAccent,
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                                          minimumSize: Size.zero,
                                        ),
                                        child: const Text('رد تکلیف', style: TextStyle(color: Colors.white, fontSize: 10, fontFamily: 'Vazirmatn')),
                                      ),
                                    ],
                                  ),
                                ]
                              ],
                            ),
                          );
                        },
                      );
                    }
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
