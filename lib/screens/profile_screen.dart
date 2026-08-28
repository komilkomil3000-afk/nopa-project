import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../utils/rating_manager.dart';
import '../utils/global_state.dart';
import '../widgets/contact_us_dialog.dart';
import 'certificate_view_screen.dart';
import 'mentor_qualification_detail_screen.dart';
import '../main.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';

import '../services/app_state_repository.dart';
import '../services/theme_provider.dart';
import '../services/audio_exclusivity_service.dart';
import '../widgets/safe_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _mentorName; // Initialize in build

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final userRole = repository.currentUser.role;

    if (userRole == UserRole.mentor || userRole == UserRole.superMentor) {
      return _buildMentorProfile(context, repository.currentUser);
    } else {
      return _buildMemberProfile(context, repository.currentUser);
    }
  }

  // --- MENTOR PROFILE LAYOUT ---
  Widget _buildMentorProfile(BuildContext context, UserModel currentUser) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: RefreshIndicator(
        onRefresh: () =>
            Provider.of<AppRepository>(context, listen: false).refreshUser(),
        child: SingleChildScrollView(
          child: Column(
            children: [
              // Mentor Header Section
              _buildMentorHeader(currentUser),

              const SizedBox(height: 24),

              // Section 1: Mentoring Stats Grid
              _buildMentorStatsGrid(context, currentUser),

              const SizedBox(height: 30),

              // Section 1.5: Identity & Financials
              _buildIdentityAndFinancialCards(currentUser),

              const SizedBox(height: 30),

              const SizedBox(height: 30),

              // Mentor Certificates / Capabilities
              _buildMentorCertificatesSection(),

              const SizedBox(height: 30),

              // Section 3: Mentor Management Options
              _buildMentorManagementSection(context, currentUser),
              const SizedBox(height: 30),
              _buildSettingsSection(context),
              const SizedBox(height: 30),
              _buildSupportSection(context),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMentorHeader(UserModel currentUser) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF26123D), Color(0xFF160E2A)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
      child: Column(
        children: [
          // Profile image with a glowing border ring
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: GlobalState.getLevelColor(GlobalState.mentorLevel),
              boxShadow: GlobalState.getLevelGlow(GlobalState.mentorLevel),
              border: Border.all(
                color: GlobalState.getLevelColor(GlobalState.mentorLevel),
                width: 3,
              ),
            ),
            child: SafeAvatar(
              radius: 54,
              imageUrl: currentUser.avatarUrl,
              name: currentUser.name,
              backgroundColor: Colors.transparent,
            ),
          ),
          const SizedBox(height: 16),

          // Mentor Name
          Text(
            currentUser.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),

          // Title tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: const Text(
              'راهبر ارشد سرزمین نپا 🚩',
              style: TextStyle(
                color: Color(0xFFFFD54F),
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: GlobalState.getLevelColor(
                GlobalState.mentorLevel,
              ).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: GlobalState.getLevelColor(
                  GlobalState.mentorLevel,
                ).withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              'سطح پروفایل: ${GlobalState.getLevelLabel(GlobalState.mentorLevel)}',
              style: TextStyle(
                color: GlobalState.getLevelColor(GlobalState.mentorLevel),
                fontWeight: FontWeight.bold,
                fontSize: 12,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMentorStatsGrid(BuildContext context, UserModel currentUser) {
    final repo = Provider.of<AppRepository>(context);
    final activeCaravansCount = repo.caravans.length;
    
    // Calculate avg satisfaction rating from mentorRatings
    final mentorId = currentUser.id;
    final ratingsForMentor = repo.mentorRatings.where((r) => r.mentorId == mentorId).toList();
    double total = 0.0;
    for (var r in ratingsForMentor) {
      total += r.ratingValue;
    }
    double satisfactionScore = (total + (5.0 * 4)) / (ratingsForMentor.length + 4);
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              'امتیاز رضایتمندی',
              satisfactionScore.toStringAsFixed(1),
              Icons.star,
              const Color(0xFFFFD54F),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: () => _showCaravanSelectorBottomSheet(context, repo),
              child: _buildStatItem(
                'کاروان‌های تحت مدیریت',
                '$activeCaravansCount',
                Icons.groups,
                const Color(0xFF8B5CF6),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showCaravanSelectorBottomSheet(BuildContext context, AppRepository repo) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'انتخاب کاروان فعال',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Vazirmatn',
                ),
              ),
              const SizedBox(height: 20),
              if (repo.caravans.isEmpty)
                const Text('شما در حال حاضر کاروانی تحت مدیریت ندارید', style: TextStyle(color: Colors.white70))
              else
                ListView.builder(
                  shrinkWrap: true,
                  itemCount: repo.caravans.length,
                  itemBuilder: (context, index) {
                    final caravan = repo.caravans[index];
                    final isActive = caravan.id == repo.selectedCaravanId;
                    return ListTile(
                      title: Text(caravan.name, style: const TextStyle(color: Colors.white)),
                      subtitle: Text('${caravan.memberCount} عضو', style: const TextStyle(color: Colors.white70)),
                      trailing: isActive ? const Icon(Icons.check_circle, color: Color(0xFF10B981)) : null,
                      onTap: () {
                        repo.switchCaravan(caravan.id);
                        Navigator.pop(ctx);
                        final mainState = ctx.findAncestorStateOfType<MainScreenState>();
                        if (mainState != null) {
                          mainState.setIndex(0);
                        }
                      },
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }





  Widget _buildMentorManagementSection(
    BuildContext context,
    UserModel currentUser,
  ) {
    return Column(
      children: [
        _buildSettingTile(
          'مشاهده کارنامه ارزیابی راهبری 📊',
          Icons.analytics_outlined,
          () {
            Navigator.pushNamed(context, '/mentor_ratings');
          },
        ),
        _buildSettingTile('ویرایش مشخصات شخصی راهبر', Icons.edit_note, () {
          _showEditProfileDialog(currentUser);
        }),
        _buildSettingTile(
          'تنظیم جلسات توجیهی آنلاین',
          Icons.calendar_month_outlined,
          () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('سامانه هماهنگی جلسات بارگذاری شد')),
            );
          },
        ),
        _buildSettingTile(
          'ارسال پیام همگانی به کل اعضا',
          Icons.broadcast_on_personal,
          () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('پیام همگانی در انتظار تایید سرور')),
            );
          },
        ),
        _buildSettingTile('خروج از حساب کاربری', Icons.logout, () async {
          await Provider.of<AppRepository>(context, listen: false).logout();
          if (context.mounted) {
            Navigator.pushReplacementNamed(context, '/auth');
          }
        }, isDestructive: true),
      ],
    );
  }

  void _showEditProfileDialog(UserModel currentUser) {
    final TextEditingController nameCtrl = TextEditingController(
      text: currentUser.name,
    );
    final TextEditingController phoneCtrl = TextEditingController(
      text: currentUser.phoneNumber,
    );
    final TextEditingController countryCtrl = TextEditingController(
      text: currentUser.city ?? 'ایران',
    );
    final TextEditingController nationalIdCtrl = TextEditingController(
      text: currentUser.nationalId ?? '',
    );
    final TextEditingController emailCtrl = TextEditingController(
      text: '',
    );

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'ویرایش مشخصات شخصی',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const Divider(color: Colors.white10),
                const SizedBox(height: 12),
                const Text(
                  'نام و نام خانوادگی راهبر:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: nameCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'شماره تماس:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: phoneCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'کشور:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: countryCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'کد ملی:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: nationalIdCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'پست الکترونیکی (ایمیل):',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: emailCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                Center(
                  child: ElevatedButton(
                    onPressed: () {
                      setState(() {
                        if (nameCtrl.text.isNotEmpty) {
                          _mentorName = nameCtrl.text;
                        }
                      });
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 12,
                      ),
                    ),
                    child: const Text(
                      'ذخیره مشخصات',
                      style: TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --- MEMBER PROFILE LAYOUT (Retained from previous changes) ---
  Widget _buildMemberProfile(BuildContext context, UserModel currentUser) {
    final List<Map<String, dynamic>> tokens = [
      {
        'name': 'زریک (Zarik)',
        'desc': 'ارز اصلی',
        'image': 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=200',
        'status': 'unlocked',
        'statusLabel': '${currentUser.zarik}',
        'color': const Color(0xFFFFD54F),
      },
      {
        'name': 'نخ (Nakh)',
        'desc': 'بافت فرش',
        'image': 'https://images.unsplash.com/photo-1590725121839-892f45b2049d?w=200',
        'status': 'unlocked',
        'statusLabel': '${currentUser.nakh}',
        'color': const Color(0xFF10B981),
      },
      {
        'name': 'فرش (Farsh)',
        'desc': 'مبادله بزرگ',
        'image': 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=200',
        'status': 'unlocked',
        'statusLabel': '${currentUser.farsh}',
        'color': const Color(0xFFEC4899),
      },
      {
        'name': 'بیرق (Beyragh)',
        'desc': 'نماد قدرت',
        'image': 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?w=200',
        'status': 'unlocked',
        'statusLabel': '${currentUser.beyragh}',
        'color': const Color(0xFF8B5CF6),
      },
    ];

    final List<Map<String, dynamic>> certificates = currentUser.certificates?.map((c) => {
      'title': c['title'] ?? 'گواهی ثبت نام نپا',
      'date': c['date'] ?? 'سیستم',
      'status': c['status'] ?? 'issued',
      'icon': c['icon'] ?? '🎓',
    }).toList().cast<Map<String, dynamic>>() ?? [
      {
        'title': 'گواهی ثبت نام نپا',
        'date': 'سیستم',
        'status': 'issued',
        'icon': '🎓',
      }
    ];

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: RefreshIndicator(
        onRefresh: () =>
            Provider.of<AppRepository>(context, listen: false).refreshUser(),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _buildMemberPremiumHeader(currentUser),
              const SizedBox(height: 24),
              _buildMemberStatsGrid(currentUser),
              const SizedBox(height: 30),
              _buildIdentityAndFinancialCards(currentUser),
              const SizedBox(height: 30),
              _buildMemberTokensSection(tokens),
              const SizedBox(height: 30),
              _buildMemberCertificatesSection(certificates, currentUser),
              const SizedBox(height: 30),
              _buildSettingsList(context),
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMemberPremiumHeader(UserModel currentUser) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF26123D), Color(0xFF160E2A)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: GlobalState.getLevelColor(GlobalState.getLevelForFrame(currentUser.levelFrame)),
              boxShadow: GlobalState.getLevelGlow(GlobalState.getLevelForFrame(currentUser.levelFrame)),
              border: Border.all(
                color: GlobalState.getLevelColor(GlobalState.getLevelForFrame(currentUser.levelFrame)),
                width: 3,
              ),
            ),
            child: ClipOval(
              child: Image.network(
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
                width: 108,
                height: 108,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 108,
                  height: 108,
                  color: Colors.white10,
                  child: const Icon(
                    Icons.person,
                    color: Colors.white30,
                    size: 54,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            currentUser.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: GlobalState.getLevelColor(
                GlobalState.getLevelForFrame(currentUser.levelFrame),
              ).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: GlobalState.getLevelColor(
                  GlobalState.getLevelForFrame(currentUser.levelFrame),
                ).withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              'سطح پروفایل: ${GlobalState.getLevelLabel(GlobalState.getLevelForFrame(currentUser.levelFrame))}',
              style: TextStyle(
                color: GlobalState.getLevelColor(GlobalState.getLevelForFrame(currentUser.levelFrame)),
                fontWeight: FontWeight.bold,
                fontSize: 12,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      currentUser.caravanName ?? 'فاقد کاروان',
                      style: const TextStyle(
                        color: Color(0xFFFFD54F),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    SizedBox(width: 6),
                    Text(
                      '🐫 عضو کاروان:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      currentUser.caravanMentor ?? 'تعیین نشده',
                      style: const TextStyle(
                        color: Color(0xFFEC4899),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    SizedBox(width: 6),
                    Text(
                      '👤 راهبر کاروان:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () => _showMentorEvaluationDialog(context),
                  icon: const Icon(Icons.star_border, size: 16),
                  label: const Text(
                    'ارزیابی و امتیازدهی به راهبر کاروان ⭐️',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8B5CF6),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'سطح ${currentUser.levelFrame + 1}',
                style: const TextStyle(color: Colors.white60, fontSize: 12),
              ),
              Text(
                '${currentUser.zarikBalance % 1000} / ۱۰۰۰ امتیاز تجربه',
                style: const TextStyle(
                  color: Color(0xFF8B5CF6),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'سطح ${currentUser.levelFrame}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (currentUser.zarikBalance % 1000) / 1000.0,
              minHeight: 6,
              backgroundColor: const Color(0xFF0F081D),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF8B5CF6)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberStatsGrid(UserModel currentUser) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.6,
        children: [
          _buildStatItem(
            'منزلگاه گذرانده',
            '${currentUser.completedStationsCount}',
            Icons.emoji_flags,
            const Color(0xFF10B981),
          ),
          _buildStatItem(
            'کلاس تکمیل شده',
            '۱۲',
            Icons.menu_book,
            const Color(0xFF8B5CF6),
          ),
          _buildStatItem(
            'گواهی صادر شده',
            '${currentUser.certificates?.length ?? 0}',
            Icons.verified,
            const Color(0xFFFFD54F),
          ),
          _buildStatItem(
            'امتیاز کل (زریک)',
            '${currentUser.zarikBalance}',
            Icons.stars,
            const Color(0xFFEC4899),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberTokensSection(List<Map<String, dynamic>> tokens) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'سرمایه‌های کسب شده',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 160,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            reverse: true,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: tokens.length,
            itemBuilder: (context, index) {
              final token = tokens[index];
              bool isLocked = token['status'] == 'locked';
              bool isActive = token['status'] == 'active';
              Color accentColor = token['color'];

              return Container(
                width: 105,
                margin: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: isLocked
                      ? const Color(0xFF160E2A).withValues(alpha: 0.5)
                      : const Color(0xFF1E1435),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isActive
                        ? accentColor
                        : (isLocked ? Colors.white10 : Colors.white24),
                    width: isActive ? 2.0 : 1.0,
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(10.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 8),
                          ClipOval(
                            child: Image.network(
                              token['image'],
                              width: 38,
                              height: 38,
                              fit: BoxFit.cover,
                              color: isLocked ? Colors.black54 : null,
                              colorBlendMode: isLocked
                                  ? BlendMode.saturation
                                  : null,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  width: 38,
                                  height: 38,
                                  color: Colors.white10,
                                  child: const Icon(
                                    Icons.broken_image,
                                    color: Colors.white30,
                                    size: 16,
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            token['name'],
                            style: TextStyle(
                              color: isLocked ? Colors.white30 : Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            token['desc'],
                            style: TextStyle(
                              color: isLocked ? Colors.white12 : Colors.white54,
                              fontSize: 9,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      top: -10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: isLocked
                              ? const Color(0xFF2C224D)
                              : accentColor,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          token['statusLabel'],
                          style: TextStyle(
                            color: isLocked
                                ? Colors.white38
                                : (isActive ? Colors.black : Colors.white),
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMemberCertificatesSection(
    List<Map<String, dynamic>> certificates,
    UserModel currentUser,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'گواهی‌های من',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 110,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            reverse: true,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: certificates.length,
            itemBuilder: (context, index) {
              final cert = certificates[index];
              bool isPending = cert['status'] == 'pending';

              return GestureDetector(
                onTap: () {
                  if (isPending) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'این گواهی هنوز در حال بررسی و تایید است.',
                          style: TextStyle(fontFamily: 'Vazirmatn'),
                        ),
                        backgroundColor: Colors.orange,
                      ),
                    );
                  } else {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => CertificateViewScreen(
                          certificate: cert,
                          userName: currentUser.name,
                        ),
                      ),
                    );
                  }
                },
                child: Container(
                  width: 200,
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1435),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.04),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: isPending
                              ? const Color(0xFF2C224D)
                              : const Color(0xFF123E33),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            cert['icon'],
                            style: const TextStyle(fontSize: 20),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              cert['title'],
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              cert['date'],
                              style: TextStyle(
                                color: isPending
                                    ? const Color(0xFFF97316)
                                    : const Color(0xFF10B981),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatItem(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(color: Colors.white54, fontSize: 11),
          ),
        ],
      ),
    );
  }

  void _showMentorEvaluationDialog(BuildContext context) {
    int selectedStars = 5;
    final List<String> availableStrengths = [
      'برخورد محترمانه',
      'توضیحات شفاف',
      'پاسخگویی سریع',
    ];
    final List<String> availableWeaknesses = [
      'کمی تاخیر در پاسخ',
      'پیچیدگی در توضیح',
    ];
    final List<String> selectedStrengths = [];
    final List<String> selectedWeaknesses = [];
    final TextEditingController commentCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(
                              Icons.close,
                              color: Colors.white70,
                            ),
                            onPressed: () => Navigator.pop(context),
                          ),
                          const Text(
                            'ارزیابی عملکرد راهبر کاروان',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const Divider(color: Colors.white10),
                      const SizedBox(height: 12),

                      // Stars selector
                      const Center(
                        child: Text(
                          'به راهبر خود چه امتیازی می‌دهید؟',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          int starVal = index + 1;
                          bool isLit = starVal <= selectedStars;
                          return IconButton(
                            icon: Icon(
                              isLit ? Icons.star : Icons.star_border,
                              color: const Color(0xFFFFD54F),
                              size: 32,
                            ),
                            onPressed: () {
                              setDialogState(() {
                                selectedStars = starVal;
                              });
                            },
                          );
                        }),
                      ),
                      const SizedBox(height: 16),

                      // Strengths Checklist
                      const Text(
                        'نقاط قوت راهبر (نمونه سوالات امتیازدهی):',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ...availableStrengths.map((str) {
                        bool isSel = selectedStrengths.contains(str);
                        return CheckboxListTile(
                          title: Text(
                            str,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          value: isSel,
                          activeColor: const Color(0xFF10B981),
                          onChanged: (val) {
                            setDialogState(() {
                              if (val == true) {
                                selectedStrengths.add(str);
                              } else {
                                selectedStrengths.remove(str);
                              }
                            });
                          },
                          controlAffinity: ListTileControlAffinity.trailing,
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        );
                      }),
                      const SizedBox(height: 12),

                      // Weaknesses Checklist
                      const Text(
                        'نقاط ضعف یا پیشنهادات ارتقا:',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ...availableWeaknesses.map((weak) {
                        bool isSel = selectedWeaknesses.contains(weak);
                        return CheckboxListTile(
                          title: Text(
                            weak,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          value: isSel,
                          activeColor: const Color(0xFFF97316),
                          onChanged: (val) {
                            setDialogState(() {
                              if (val == true) {
                                selectedWeaknesses.add(weak);
                              } else {
                                selectedWeaknesses.remove(weak);
                              }
                            });
                          },
                          controlAffinity: ListTileControlAffinity.trailing,
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        );
                      }),
                      const SizedBox(height: 16),

                      // Comments input
                      const Text(
                        'نظرات و پیشنهادات شما:',
                        style: TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: commentCtrl,
                        maxLines: 3,
                        style: const TextStyle(color: Colors.white),
                        textAlign: TextAlign.right,
                        decoration: InputDecoration(
                          hintText: 'تجربه تعامل با راهبر خود را بنویسید...',
                          hintStyle: const TextStyle(
                            color: Colors.white24,
                            fontSize: 11,
                          ),
                          filled: true,
                          fillColor: const Color(0xFF160E2A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Submit Button
                      Container(
                        width: double.infinity,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context);

                            // Save rating globally
                            RatingManager.addRating(
                              selectedStars,
                              selectedStrengths,
                              selectedWeaknesses,
                              commentCtrl.text,
                            );

                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'ارزیابی شما با موفقیت ثبت شد و امتیاز راهبر کاروان به‌روزرسانی گردید ⭐',
                                ),
                                backgroundColor: Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text(
                            'ثبت ارزیابی',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
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

  Widget _buildMentorCertificatesSection() {
    final List<String> mentorCerts = [
      'گواهی عالی مربیگری تربیتی نپا',
      'گواهی تخصصی رسانه و تولید محتوا',
      'گواهی شایستگی مدیریت کاروان نپا',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'گواهی‌ها و قابلیت‌های راهبر',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1435),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
          ),
          child: Column(
            children: mentorCerts
                .map(
                  (cert) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => MentorQualificationDetailScreen(
                              qualification: {
                                'title': cert,
                                'authority': 'آکادمی مرکزی سواد تربیتی نپا',
                                'date': 'کد استعلام: NP-1087263',
                                'description':
                                    'این گواهی نشان‌دهنده صلاحیت تربیتی، توانایی مربیگری کار گروهی و هدایت نوجوانان در مسیر کاروان نپا است.',
                              },
                            ),
                          ),
                        );
                      },
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          const Icon(
                            Icons.arrow_back_ios,
                            color: Colors.white30,
                            size: 12,
                          ),
                          const Spacer(),
                          Text(
                            cert,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Icon(
                            Icons.verified,
                            color: Color(0xFF10B981),
                            size: 18,
                          ),
                        ],
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsList(BuildContext context) {
    return Column(
      children: [
        _buildSettingTile('تنظیمات حساب کاربری', Icons.person_outline, () {
          _showAccountSettingsDialog(context);
        }),
        _buildSettingTile('امنیت و حریم خصوصی', Icons.lock_outline, () {
          _showSecurityPrivacyDialog(context);
        }),
        _buildSettingTile('تغییر رمز عبور', Icons.vpn_key_outlined, () {
          _showChangePasswordDialog(context);
        }),
        _buildSettingTile(
          'پشتیبانی و تماس با ما',
          Icons.headset_mic_outlined,
          () {
            ContactUsDialog.show(context);
          },
        ),
        _buildSettingTile('خروج از حساب', Icons.logout, () async {
          await Provider.of<AppRepository>(context, listen: false).logout();
          if (context.mounted) {
            Navigator.pushReplacementNamed(context, '/auth');
          }
        }, isDestructive: true),
      ],
    );
  }

  void _showAccountSettingsDialog(BuildContext context) {
    final TextEditingController nameCtrl = TextEditingController(
      text: _mentorName,
    );
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'تنظیمات حساب کاربری',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 12),
                  const Text(
                    'نام و نام خانوادگی:',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: nameCtrl,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      filled: true,
                      fillColor: Color(0xFF160E2A),
                      border: OutlineInputBorder(borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'کاروان پیش‌فرض:',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF160E2A),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'کاروان شماره ۳ (رصدخانه)',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        if (nameCtrl.text.isNotEmpty) {
                          setState(() {
                            _mentorName = nameCtrl.text;
                          });
                        }
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'تنظیمات حساب کاربری با موفقیت ذخیره شد ✅',
                              style: TextStyle(fontFamily: 'Vazirmatn'),
                            ),
                            backgroundColor: Color(0xFF10B981),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                      ),
                      child: const Text(
                        'ذخیره تغییرات',
                        style: TextStyle(
                          color: Colors.white,
                          fontFamily: 'Vazirmatn',
                          fontWeight: FontWeight.bold,
                        ),
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
  }

  void _showSecurityPrivacyDialog(BuildContext context) {
    bool is2faEnabled = true;
    bool isPublicLevel = true;

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'امنیت و حریم خصوصی',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const Divider(color: Colors.white10),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      title: const Text(
                        'تایید دومرحله‌ای با رمز یکبار مصرف (OTP)',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      value: is2faEnabled,
                      activeThumbColor: const Color(0xFFEC4899),
                      onChanged: (val) {
                        setDialogState(() {
                          is2faEnabled = val;
                        });
                      },
                      contentPadding: EdgeInsets.zero,
                    ),
                    SwitchListTile(
                      title: const Text(
                        'نمایش عمومی نشان‌ها و سطح کاربری',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontFamily: 'Vazirmatn',
                        ),
                      ),
                      value: isPublicLevel,
                      activeThumbColor: const Color(0xFF10B981),
                      onChanged: (val) {
                        setDialogState(() {
                          isPublicLevel = val;
                        });
                      },
                      contentPadding: EdgeInsets.zero,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'تنظیمات امنیتی با موفقیت به‌روزرسانی شد 🔒',
                                style: TextStyle(fontFamily: 'Vazirmatn'),
                              ),
                              backgroundColor: Color(0xFF10B981),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B5CF6),
                        ),
                        child: const Text(
                          'ثبت تنظیمات امنیتی',
                          style: TextStyle(
                            color: Colors.white,
                            fontFamily: 'Vazirmatn',
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showChangePasswordDialog(BuildContext context) {
    final TextEditingController currentCtrl = TextEditingController();
    final TextEditingController newCtrl = TextEditingController();
    final TextEditingController confirmCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1435),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'تغییر رمز عبور',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const Divider(color: Colors.white10),
                const SizedBox(height: 12),
                const Text(
                  'رمز عبور فعلی:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: currentCtrl,
                  obscureText: true,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'رمز عبور جدید:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: newCtrl,
                  obscureText: true,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'تکرار رمز عبور جدید:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: confirmCtrl,
                  obscureText: true,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    filled: true,
                    fillColor: Color(0xFF160E2A),
                    border: OutlineInputBorder(borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final currentDialogContext = context;
                      final messenger = ScaffoldMessenger.of(
                        currentDialogContext,
                      );
                      final navigator = Navigator.of(currentDialogContext);

                      if (newCtrl.text != confirmCtrl.text) {
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text(
                              'رمز عبور جدید و تکرار آن یکسان نیستند',
                              style: TextStyle(fontFamily: 'Vazirmatn'),
                            ),
                            backgroundColor: Colors.redAccent,
                          ),
                        );
                        return;
                      }

                      final success = await AppRepository().apiService
                          .changePassword(
                            currentCtrl.text.trim(),
                            newCtrl.text.trim(),
                          );
                      if (!mounted) return;

                      navigator.pop();
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text(
                            success
                                ? 'رمز عبور با موفقیت تغییر یافت'
                                : 'تغییر رمز عبور ناموفق بود',
                            style: const TextStyle(fontFamily: 'Vazirmatn'),
                          ),
                          backgroundColor: success
                              ? const Color(0xFF10B981)
                              : Colors.redAccent,
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                    ),
                    child: const Text(
                      'ثبت رمز جدید',
                      style: TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSettingTile(
    String title,
    IconData icon,
    VoidCallback onTap, {
    bool isDestructive = false,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 30),
      leading: Icon(
        icon,
        color: isDestructive ? Colors.redAccent : Colors.white70,
      ),
      title: Text(
        title,
        textAlign: TextAlign.right,
        style: TextStyle(
          color: isDestructive ? Colors.redAccent : Colors.white,
          fontFamily: 'Vazirmatn',
          fontSize: 13,
        ),
      ),
      trailing: Icon(
        isDestructive ? Icons.keyboard_arrow_left : Icons.chevron_left,
        color: Colors.white24,
        size: 18,
      ),
      onTap: onTap,
    );
  }

  // --- NEW IDENTITY & FINANCIAL CARDS ---
  Widget _buildIdentityAndFinancialCards(UserModel user) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Identity Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1435),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: user.identityVerified
                    ? const Color(0xFF10B981).withValues(alpha: 0.5)
                    : Colors.white10,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    user.identityVerified
                        ? const Icon(
                            Icons.verified,
                            color: Color(0xFF10B981),
                            size: 20,
                          )
                        : const Icon(
                            Icons.pending_actions,
                            color: Color(0xFFFFD54F),
                            size: 20,
                          ),
                    const Text(
                      'شناسنامه و هویت',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildInfoRow('شماره تماس', user.phoneNumber),
                _buildInfoRow('کد ملی', user.nationalId ?? 'ثبت نشده'),
                _buildInfoRow('تاریخ تولد', user.dateOfBirth ?? 'ثبت نشده'),
                _buildInfoRow('شهر', user.city ?? 'ثبت نشده'),
                _buildInfoRow(
                  'وضعیت احراز',
                  user.identityVerified ? 'تایید شده' : 'در انتظار بررسی',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Financial Stats Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1435),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'آمار مالی و تعاملات',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                const SizedBox(height: 12),
                _buildInfoRow(
                  'تعداد تراکنش‌های زریک',
                  '${user.totalTransactions} تراکنش',
                ),
                _buildInfoRow(
                  'تعداد خریدهای موفق',
                  '${user.totalZarikPurchases} خرید',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontFamily: 'Vazirmatn',
            ),
          ),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white54,
              fontSize: 12,
              fontFamily: 'Vazirmatn',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'تنظیمات نمایشی',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              fontFamily: 'Vazirmatn',
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'حالت تاریک',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    Switch(
                      value: themeProvider.isDarkMode,
                      activeThumbColor: const Color(0xFFD946EF),
                      onChanged: (val) {
                        themeProvider.toggleTheme(val);
                      },
                    ),
                  ],
                ),
                const Divider(color: Colors.white12, height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'اندازه متن',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    Expanded(
                      child: Slider(
                        value: themeProvider.fontScale,
                        min: 0.8,
                        max: 1.5,
                        divisions: 7,
                        activeColor: const Color(0xFFD946EF),
                        onChanged: (val) {
                          themeProvider.setFontScale(val);
                        },
                      ),
                    ),
                    Text(
                      themeProvider.fontScale.toStringAsFixed(1),
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSupportSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'پشتیبانی',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              fontFamily: 'Vazirmatn',
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => const SupportTicketDialog(),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF10b981).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFF10b981).withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.support_agent, color: Color(0xFF10b981)),
                  SizedBox(width: 8),
                  Text(
                    'ثبت تیکت پشتیبانی',
                    style: TextStyle(
                      color: Color(0xFF10b981),
                      fontSize: 16,
                      fontFamily: 'Vazirmatn',
                      fontWeight: FontWeight.bold,
                    ),
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

class SupportTicketDialog extends StatefulWidget {
  const SupportTicketDialog({super.key});
  @override
  State<SupportTicketDialog> createState() => _SupportTicketDialogState();
}

class _SupportTicketDialogState extends State<SupportTicketDialog> {
  final _subjectCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController(text: 'عمومی');
  final _audioRecorder = AudioRecorder();
  final _audioPlayer = AudioPlayer();
  bool _isRecording = false;
  String? _audioPath;

  @override
  void initState() {
    super.initState();
    AudioExclusivityService.registerAudioPlayer(_audioPlayer);
  }

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _categoryCtrl.dispose();
    _audioRecorder.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    if (await _audioRecorder.hasPermission()) {
      final path = 'ticket_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _audioRecorder.start(const RecordConfig(), path: path);
      setState(() {
        _isRecording = true;
        _audioPath = null;
      });
    }
  }

  Future<void> _stopRecording() async {
    final path = await _audioRecorder.stop();
    setState(() {
      _isRecording = false;
      _audioPath = path;
    });
  }

  Future<void> _playRecording() async {
    if (_audioPath != null) {
      await _audioPlayer.play(DeviceFileSource(_audioPath!));
    }
  }

  Future<void> _submitTicket() async {
    final subject = _subjectCtrl.text;
    if (subject.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('موضوع الزامی است')));
      return;
    }
    // Upload audio and submit (Mock implementation for UI flow)
    // ignore: unused_local_variable
    final repo = Provider.of<AppRepository>(context, listen: false);
    // await repo.apiService.createSupportTicket(subject, category, voicePath: _audioPath);
    Navigator.pop(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('تیکت با موفقیت ثبت شد')));
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1435),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        padding: const EdgeInsets.all(20),
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'ثبت تیکت جدید',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
                fontFamily: 'Vazirmatn',
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _subjectCtrl,
              style: const TextStyle(
                color: Colors.white,
                fontFamily: 'Vazirmatn',
              ),
              decoration: InputDecoration(
                hintText: 'موضوع تیکت',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: Colors.black26,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text(
                    'ارسال پیام صوتی',
                    style: TextStyle(
                      color: Colors.white70,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      GestureDetector(
                        onTap: _isRecording ? _stopRecording : _startRecording,
                        child: CircleAvatar(
                          radius: 25,
                          backgroundColor: _isRecording
                              ? Colors.red
                              : const Color(0xFFD946EF),
                          child: Icon(
                            _isRecording ? Icons.stop : Icons.mic,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      if (_audioPath != null) ...[
                        const SizedBox(width: 20),
                        GestureDetector(
                          onTap: _playRecording,
                          child: const CircleAvatar(
                            radius: 25,
                            backgroundColor: Color(0xFF10b981),
                            child: Icon(Icons.play_arrow, color: Colors.white),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'انصراف',
                      style: TextStyle(
                        color: Colors.white54,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitTicket,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD946EF),
                    ),
                    child: const Text(
                      'ارسال تیکت',
                      style: TextStyle(
                        fontFamily: 'Vazirmatn',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
