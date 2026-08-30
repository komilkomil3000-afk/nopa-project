import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../utils/rating_manager.dart';
import '../utils/global_state.dart';
import '../widgets/contact_us_dialog.dart';
import 'certificate_view_screen.dart';
import 'mentor_qualification_detail_screen.dart';
import 'map_screen.dart';
import '../main.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';

import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../services/theme_provider.dart';
import '../services/audio_exclusivity_service.dart';
import '../widgets/safe_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _expandedStatType;
  bool _isIdentityDossierExpanded = false;
  List<Map<String, dynamic>> _lmsStations = [];
  List<Map<String, dynamic>> _userProgressList = [];

  @override
  void initState() {
    super.initState();
    _loadLmsProgressData();
  }

  Future<void> _loadLmsProgressData() async {
    try {
      final stations = await HttpApiService().getStations();
      final progress = await HttpApiService().getUserProgress();
      if (mounted) {
        setState(() {
          _lmsStations = stations.cast<Map<String, dynamic>>();
          _userProgressList = progress.cast<Map<String, dynamic>>();
        });
      }
    } catch (_) {}
  }

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
    final ratingsForMentor = repo.mentorRatings
        .where((r) => r.mentorId == mentorId)
        .toList();
    double total = 0.0;
    for (var r in ratingsForMentor) {
      total += r.ratingValue;
    }
    double satisfactionScore =
        (total + (5.0 * 4)) / (ratingsForMentor.length + 4);

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

  void _showCaravanSelectorBottomSheet(
    BuildContext context,
    AppRepository repo,
  ) {
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
                const Text(
                  'شما در حال حاضر کاروانی تحت مدیریت ندارید',
                  style: TextStyle(color: Colors.white70),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  itemCount: repo.caravans.length,
                  itemBuilder: (context, index) {
                    final caravan = repo.caravans[index];
                    final isActive = caravan.id == repo.selectedCaravanId;
                    return ListTile(
                      title: Text(
                        caravan.name,
                        style: const TextStyle(color: Colors.white),
                      ),
                      subtitle: Text(
                        '${caravan.memberCount} عضو',
                        style: const TextStyle(color: Colors.white70),
                      ),
                      trailing: isActive
                          ? const Icon(
                              Icons.check_circle,
                              color: Color(0xFF10B981),
                            )
                          : null,
                      onTap: () {
                        repo.switchCaravan(caravan.id);
                        Navigator.pop(ctx);
                        final mainState = ctx
                            .findAncestorStateOfType<MainScreenState>();
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
    final TextEditingController emailCtrl = TextEditingController(text: '');

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
              color: GlobalState.getLevelColor(
                GlobalState.getLevelForFrame(currentUser.levelFrame),
              ),
              boxShadow: GlobalState.getLevelGlow(
                GlobalState.getLevelForFrame(currentUser.levelFrame),
              ),
              border: Border.all(
                color: GlobalState.getLevelColor(
                  GlobalState.getLevelForFrame(currentUser.levelFrame),
                ),
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
        ],
      ),
    );
  }

  Widget _buildMemberStatsGrid(UserModel currentUser) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (_expandedStatType != null)
                  InkWell(
                    onTap: () => setState(() => _expandedStatType = null),
                    child: const Text(
                      'بستن پنجره ▴',
                      style: TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                  )
                else
                  const Text(
                    'لمس کنید برای باز شدن جزئیات ▾',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 11,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                const Text(
                  'کارنامه و شاخص‌های دستاورد',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 115,
            child: ListView(
              scrollDirection: Axis.horizontal,
              reverse: true,
              children: [
                _buildInteractiveStatCard(
                  title: 'منزلگاه گذرانده',
                  value: '${currentUser.completedStationsCount}',
                  unit: 'منزلگاه',
                  icon: Icons.flag_circle_outlined,
                  color: const Color(0xFF10B981),
                  isSelected: _expandedStatType == 'stations',
                  onTap: () => _toggleStatExpansion('stations'),
                ),
                _buildInteractiveStatCard(
                  title: 'کلاس تکمیل شده',
                  value: '${currentUser.completedSessionsCount}',
                  unit: 'جلسه',
                  icon: Icons.play_lesson_outlined,
                  color: const Color(0xFF8B5CF6),
                  isSelected: _expandedStatType == 'sessions',
                  onTap: () => _toggleStatExpansion('sessions'),
                ),
                _buildInteractiveStatCard(
                  title: 'گواهی صادر شده',
                  value: '${currentUser.certificates?.length ?? 0}',
                  unit: 'مدرک رسمی',
                  icon: Icons.workspace_premium_outlined,
                  color: const Color(0xFFFFD54F),
                  isSelected: _expandedStatType == 'certificates',
                  onTap: () => _toggleStatExpansion('certificates'),
                ),
                _buildInteractiveStatCard(
                  title: 'امتیاز کل (زریک)',
                  value: '${currentUser.zarikBalance}',
                  unit: 'زریک فعال',
                  icon: Icons.stars_rounded,
                  color: const Color(0xFFEC4899),
                  isSelected: _expandedStatType == 'zarik',
                  onTap: () => _toggleStatExpansion('zarik'),
                ),
              ],
            ),
          ),

          // --- INLINE EXPANDABLE DETAILS DRAWER (OPENS RIGHT BELOW STAT CARDS) ---
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: _expandedStatType == null
                ? const SizedBox.shrink()
                : Container(
                    margin: const EdgeInsets.only(top: 14),
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF190F2F),
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: _getStatColor(
                          _expandedStatType!,
                        ).withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: _getStatColor(
                            _expandedStatType!,
                          ).withValues(alpha: 0.15),
                          blurRadius: 15,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Header of the expanded inline drawer
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              onPressed: () =>
                                  setState(() => _expandedStatType = null),
                              icon: const Icon(
                                Icons.close,
                                size: 20,
                                color: Colors.white60,
                              ),
                              tooltip: 'بستن',
                              style: IconButton.styleFrom(
                                backgroundColor: Colors.white.withValues(
                                  alpha: 0.06,
                                ),
                                padding: const EdgeInsets.all(6),
                              ),
                            ),
                            Row(
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _getStatTitle(_expandedStatType!),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14.5,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'Vazirmatn',
                                      ),
                                    ),
                                    Text(
                                      _getStatSubtitle(_expandedStatType!),
                                      style: const TextStyle(
                                        color: Colors.white54,
                                        fontSize: 10.5,
                                        fontFamily: 'Vazirmatn',
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 10),
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: _getStatColor(
                                      _expandedStatType!,
                                    ).withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    _getStatIcon(_expandedStatType!),
                                    color: _getStatColor(_expandedStatType!),
                                    size: 20,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Divider(color: Colors.white12, height: 1),
                        const SizedBox(height: 14),

                        // Authentic Content based on selected stat type
                        _buildExpandedStatContent(
                          context,
                          _expandedStatType!,
                          currentUser,
                        ),

                        const SizedBox(height: 14),
                        const Divider(color: Colors.white12, height: 1),
                        const SizedBox(height: 8),

                        // Bottom Action: Single concise collapse button
                        Center(
                          child: InkWell(
                            onTap: () =>
                                setState(() => _expandedStatType = null),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.white12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  Icon(
                                    Icons.keyboard_arrow_up,
                                    size: 16,
                                    color: Colors.white70,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'بستن ▴',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                ],
                              ),
                            ),
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

  void _toggleStatExpansion(String type) {
    setState(() {
      if (_expandedStatType == type) {
        _expandedStatType = null;
      } else {
        _expandedStatType = type;
      }
    });
  }

  String _getStatTitle(String type) {
    switch (type) {
      case 'stations':
        return 'سوابق منزلگاه‌های گذرانده شده';
      case 'sessions':
        return 'آمار جلسات و کلاس‌های تکمیل شده';
      case 'certificates':
        return 'گواهینامه‌ها و مدارک صادر شده';
      case 'zarik':
        return 'موجودی کل زریک و دارایی‌ها';
      default:
        return 'جزئیات شاخص';
    }
  }

  String _getStatSubtitle(String type) {
    switch (type) {
      case 'stations':
        return 'وضعیت طی منزلگاه‌ها و پیشرفت در مسیر نپا';
      case 'sessions':
        return 'کلاس‌ها و دوره‌های ویدیویی با تماشای کامل';
      case 'certificates':
        return 'مدارک و تاییدیه‌های رسمی صادرشده از سامانه';
      case 'zarik':
        return 'کیف پول امتیازات و دارایی‌های اکوسیستم نپا';
      default:
        return '';
    }
  }

  IconData _getStatIcon(String type) {
    switch (type) {
      case 'stations':
        return Icons.emoji_flags;
      case 'sessions':
        return Icons.play_lesson_outlined;
      case 'certificates':
        return Icons.workspace_premium_outlined;
      case 'zarik':
        return Icons.stars_rounded;
      default:
        return Icons.info_outline;
    }
  }

  Color _getStatColor(String type) {
    switch (type) {
      case 'stations':
        return const Color(0xFF10B981);
      case 'sessions':
        return const Color(0xFF8B5CF6);
      case 'certificates':
        return const Color(0xFFFFD54F);
      case 'zarik':
        return const Color(0xFFEC4899);
      default:
        return Colors.blue;
    }
  }

  Widget _buildExpandedStatContent(
    BuildContext context,
    String type,
    UserModel user,
  ) {
    switch (type) {
      case 'stations':
        return _buildStationsDetailContent(user);
      case 'sessions':
        return _buildSessionsDetailContent(user);
      case 'certificates':
        return _buildCertificatesDetailContent(context, user);
      case 'zarik':
        return _buildZarikDetailContent(user);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildInteractiveStatCard({
    required String title,
    required String value,
    required String unit,
    required IconData icon,
    required Color color,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Container(
      width: 140,
      margin: const EdgeInsets.symmetric(horizontal: 5),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  isSelected
                      ? color.withValues(alpha: 0.32)
                      : color.withValues(alpha: 0.16),
                  isSelected
                      ? const Color(0xFF261845)
                      : const Color(0xFF1B1232),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isSelected ? color : color.withValues(alpha: 0.35),
                width: isSelected ? 2.0 : 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: isSelected ? 0.3 : 0.1),
                  blurRadius: isSelected ? 12 : 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(
                      isSelected
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 16,
                      color: isSelected ? color : color.withValues(alpha: 0.7),
                    ),
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, color: color, size: 16),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          unit,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 9.5,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          value,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
                    Text(
                      title,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 11,
                        fontFamily: 'Vazirmatn',
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStationsDetailContent(UserModel user) {
    final int completed = user.completedStationsCount;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFF10B981).withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                completed > 0
                    ? '$completed منزلگاه تکمیل‌شده'
                    : '۰ منزلگاه (در حال یادگیری)',
                style: const TextStyle(
                  color: Color(0xFF10B981),
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Vazirmatn',
                ),
              ),
              const Text(
                'سوابق گذرانده شده:',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _buildDrawerInfoRow(
          'وضعیت پیشرفت',
          completed > 0
              ? 'گذراندن موفق $completed منزلگاه مصوب'
              : 'در حال مطالعه و پیشروی در اولین منزلگاه',
        ),
        _buildDrawerInfoRow('کاروان عضویت', user.caravanName ?? 'فاقد کاروان'),
        _buildDrawerInfoRow('راهبر ارزیاب', user.caravanMentor ?? 'تعیین نشده'),
        _buildDrawerInfoRow(
          'سطح مهارتی',
          'سطح ${user.levelFrame} (${GlobalState.getLevelLabel(GlobalState.getLevelForFrame(user.levelFrame))})',
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () {
            final mainState = context
                .findAncestorStateOfType<MainScreenState>();
            if (mainState != null) {
              mainState.setIndex(1); // 1 is MapScreen (مسیر کاروان به سوی گنج)
            } else {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const MapScreen()),
              );
            }
          },
          icon: const Icon(Icons.explore_outlined, size: 17),
          label: const Text(
            'ورود به نقشه (مسیر کاروان به سوی گنج) 🗺️',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.bold,
              fontFamily: 'Vazirmatn',
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSessionsDetailContent(UserModel user) {
    int totalSessions = 0;
    int completedSessions = 0;
    int totalClips = 0;
    int watchedClips = 0;
    int totalQuizzes = 0;
    int passedQuizzes = 0;
    final Set<String> categoryTitles = {};

    for (var station in _lmsStations) {
      if (station['categories'] != null) {
        for (var cat in station['categories']) {
          final catTitle = cat['title']?.toString().trim();
          if (catTitle != null && catTitle.isNotEmpty) {
            categoryTitles.add(catTitle);
          }

          if (cat['sessions'] != null) {
            for (var sess in cat['sessions']) {
              totalSessions++;
              int sessClipsCount = 0;
              int sessWatchedCount = 0;

              if (sess['quizzes'] != null) {
                totalQuizzes += (sess['quizzes'] as List).length;
              }

              if (sess['videoClips'] != null) {
                final clips = sess['videoClips'] as List;
                sessClipsCount = clips.length;
                totalClips += sessClipsCount;
                for (var clip in clips) {
                  final rec = _userProgressList.firstWhere(
                    (p) => p['clipId'] == clip['id'],
                    orElse: () => <String, dynamic>{},
                  );
                  if (rec['isWatched'] == true) {
                    watchedClips++;
                    sessWatchedCount++;
                  }
                  if (rec['quizPassed'] == true) {
                    passedQuizzes++;
                  }
                }
              }

              if (sessClipsCount > 0 && sessWatchedCount == sessClipsCount) {
                completedSessions++;
              }
            }
          }
        }
      }
    }

    if (totalSessions == 0) {
      totalSessions = user.completedSessionsCount > 0
          ? user.completedSessionsCount + 8
          : 12;
      completedSessions = user.completedSessionsCount;
      totalClips = totalSessions * 3;
      watchedClips = completedSessions * 3;
      totalQuizzes = totalSessions;
      passedQuizzes = completedSessions;
      categoryTitles.addAll(['آموزش مهارتی', 'بینش و معارف', 'تولید رسانه‌ای']);
    } else {
      if (user.completedSessionsCount > completedSessions) {
        completedSessions = user.completedSessionsCount;
      }
    }

    final int remainingSessions = (totalSessions - completedSessions).clamp(
      0,
      totalSessions,
    );
    final int remainingClips = (totalClips - watchedClips).clamp(0, totalClips);
    final int remainingQuizzes = (totalQuizzes - passedQuizzes).clamp(
      0,
      totalQuizzes,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Top categories badge row
        if (categoryTitles.isNotEmpty) ...[
          const Text(
            'دسته‌بندی و سرفصل‌های کلاس‌ها:',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              fontFamily: 'Vazirmatn',
            ),
            textAlign: TextAlign.right,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            alignment: WrapAlignment.end,
            children: categoryTitles.map((title) {
              return Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Color(0xFFC4B5FD),
                        fontSize: 11,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.school_outlined,
                      size: 12,
                      color: Color(0xFF8B5CF6),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
        ],

        // Metric 1: Sessions Breakdown
        _buildMetricBreakdownCard(
          title: 'جلسات آموزشی',
          icon: Icons.play_lesson_outlined,
          color: const Color(0xFF8B5CF6),
          doneCount: completedSessions,
          remainingCount: remainingSessions,
          totalCount: totalSessions,
          unit: 'جلسه',
        ),
        const SizedBox(height: 10),

        // Metric 2: Video Parts Breakdown
        _buildMetricBreakdownCard(
          title: 'پارت‌ها و ویدیوهای آموزشی',
          icon: Icons.video_collection_outlined,
          color: const Color(0xFF38BDF8),
          doneCount: watchedClips,
          remainingCount: remainingClips,
          totalCount: totalClips,
          unit: 'پارت',
        ),
        const SizedBox(height: 10),

        // Metric 3: Quizzes Breakdown
        _buildMetricBreakdownCard(
          title: 'آزمونک‌ها و ارزیابی‌ها',
          icon: Icons.quiz_outlined,
          color: const Color(0xFFFFB74D),
          doneCount: passedQuizzes,
          remainingCount: remainingQuizzes,
          totalCount: totalQuizzes,
          unit: 'آزمونک',
        ),

        const SizedBox(height: 14),
        ElevatedButton.icon(
          onPressed: () {
            final mainState = context
                .findAncestorStateOfType<MainScreenState>();
            if (mainState != null) {
              mainState.setIndex(1); // 1 is MapScreen / Classes pathway
            } else {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const MapScreen()),
              );
            }
          },
          icon: const Icon(Icons.play_circle_filled, size: 17),
          label: const Text(
            'ادامه یادگیری و تماشای کلاس‌ها 🎬',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.bold,
              fontFamily: 'Vazirmatn',
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF8B5CF6),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMetricBreakdownCard({
    required String title,
    required IconData icon,
    required Color color,
    required int doneCount,
    required int remainingCount,
    required int totalCount,
    required String unit,
  }) {
    final double percent = totalCount > 0
        ? (doneCount / totalCount).clamp(0.0, 1.0)
        : 0.0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${(percent * 100).toInt()}% پیشرفت',
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
              ),
              Row(
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(icon, color: color, size: 18),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: percent,
              minHeight: 6,
              backgroundColor: Colors.white10,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.hourglass_empty_rounded,
                    size: 14,
                    color: Colors.white54,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$remainingCount $unit باقی‌مانده',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  const Icon(
                    Icons.check_circle_outline,
                    size: 14,
                    color: Color(0xFF10B981),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$doneCount $unit انجام‌شده (از $totalCount)',
                    style: const TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCertificatesDetailContent(BuildContext ctx, UserModel user) {
    final certs = user.certificates ?? [];
    if (certs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          children: const [
            Icon(
              Icons.workspace_premium_outlined,
              color: Color(0xFFFFD54F),
              size: 36,
            ),
            SizedBox(height: 10),
            Text(
              'هنوز گواهینامه فعالی صادر نشده است',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.bold,
                fontFamily: 'Vazirmatn',
              ),
            ),
            SizedBox(height: 6),
            Text(
              'با تکمیل منزلگاه‌های دوره و تایید آزمون‌های نهایی توسط راهبر کاروان، مدارک رسمی شما در این بخش فعال خواهد شد.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white54,
                fontSize: 12,
                fontFamily: 'Vazirmatn',
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: certs.map((cert) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFD54F).withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFFFD54F).withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => CertificateViewScreen(
                        certificate: Map<String, dynamic>.from(
                          cert is Map ? cert : {},
                        ),
                        userName: user.name,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.visibility, size: 14),
                label: const Text(
                  'مشاهده مدرک',
                  style: TextStyle(fontSize: 11, fontFamily: 'Vazirmatn'),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD54F),
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    cert['title'] ?? 'گواهی پایان دوره نپا',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  Text(
                    'تاریخ صدور: ${cert['issueDate'] ?? 'نامشخص'}',
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildZarikDetailContent(UserModel user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFEC4899).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFEC4899).withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${user.zarikBalance} زریک',
                style: const TextStyle(
                  color: Color(0xFFEC4899),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Vazirmatn',
                ),
              ),
              const Text(
                'موجودی فعال زریک:',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _buildDrawerInfoRow('موجودی نخ (Nakh)', '${user.nakh} واحد'),
        _buildDrawerInfoRow('موجودی بیرق (Beyragh)', '${user.beyragh} واحد'),
        _buildDrawerInfoRow('موجودی فرش (Farsh)', '${user.farsh} تخته'),
        _buildDrawerInfoRow(
          'کاربرد دارایی‌ها',
          'استفاده در لیگ‌های کاروانی و چالش‌های هفتگی',
        ),
      ],
    );
  }

  Widget _buildDrawerInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
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
        _buildSettingTile('تنظیمات رمز عبور', Icons.password_rounded, () {
          _showChangePasswordDialog(context);
        }),
        _buildSettingTile(
          'ارزیابی و امتیازدهی به راهبر کاروان',
          Icons.star_rate_outlined,
          () {
            _showMentorEvaluationDialog(context);
          },
        ),
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

  void _showChangePasswordDialog(BuildContext context) {
    final TextEditingController newCtrl = TextEditingController();
    final TextEditingController confirmCtrl = TextEditingController();
    bool obscureNew = true;
    bool obscureConfirm = true;
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: BorderSide(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(
                              Icons.close,
                              color: Colors.white60,
                              size: 20,
                            ),
                            onPressed: () => Navigator.pop(dialogContext),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                          Row(
                            children: const [
                              Text(
                                'تنظیمات رمز عبور ورود',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(
                                Icons.lock_reset,
                                color: Color(0xFF38BDF8),
                                size: 22,
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Divider(color: Colors.white12, height: 1),
                      const SizedBox(height: 14),

                      // Description
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF38BDF8,
                          ).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(
                              0xFF38BDF8,
                            ).withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          children: const [
                            Expanded(
                              child: Text(
                                'با تعیین رمز عبور ثابت، می‌توانید در ورودهای بعدی مستقیماً و بدون نیاز به انتظار برای پیامک، با شماره و رمز خود وارد پنل شوید.',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  color: Color(0xFFBAE6FD),
                                  fontSize: 11,
                                  height: 1.5,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                            ),
                            SizedBox(width: 8),
                            Icon(
                              Icons.info_outline,
                              color: Color(0xFF38BDF8),
                              size: 18,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // New Password Field
                      const Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'رمز عبور ثابت جدید:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: newCtrl,
                        obscureText: obscureNew,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontFamily: 'Vazirmatn',
                        ),
                        decoration: InputDecoration(
                          hintText: 'حداقل ۴ رقم یا حرف',
                          hintStyle: const TextStyle(
                            color: Colors.white30,
                            fontSize: 11,
                            fontFamily: 'Vazirmatn',
                          ),
                          filled: true,
                          fillColor: const Color(0xFF160E2A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Colors.white12),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Colors.white12),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF8B5CF6),
                            ),
                          ),
                          prefixIcon: IconButton(
                            icon: Icon(
                              obscureNew
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: Colors.white38,
                              size: 18,
                            ),
                            onPressed: () =>
                                setDialogState(() => obscureNew = !obscureNew),
                          ),
                          suffixIcon: const Icon(
                            Icons.key,
                            color: Color(0xFF8B5CF6),
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Confirm Password Field
                      const Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'تکرار رمز عبور جدید:',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: confirmCtrl,
                        obscureText: obscureConfirm,
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontFamily: 'Vazirmatn',
                        ),
                        decoration: InputDecoration(
                          hintText: 'تکرار دقیق رمز عبور',
                          hintStyle: const TextStyle(
                            color: Colors.white30,
                            fontSize: 11,
                            fontFamily: 'Vazirmatn',
                          ),
                          filled: true,
                          fillColor: const Color(0xFF160E2A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Colors.white12),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Colors.white12),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF8B5CF6),
                            ),
                          ),
                          prefixIcon: IconButton(
                            icon: Icon(
                              obscureConfirm
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: Colors.white38,
                              size: 18,
                            ),
                            onPressed: () => setDialogState(
                              () => obscureConfirm = !obscureConfirm,
                            ),
                          ),
                          suffixIcon: const Icon(
                            Icons.check_circle_outline,
                            color: Color(0xFF10B981),
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Submit Button
                      SizedBox(
                        height: 46,
                        child: ElevatedButton.icon(
                          onPressed: isSubmitting
                              ? null
                              : () async {
                                  final String pass = newCtrl.text.trim();
                                  final String confirm = confirmCtrl.text
                                      .trim();

                                  if (pass.length < 4) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'رمز عبور باید حداقل ۴ رقم یا کاراکتر باشد',
                                          style: TextStyle(
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                        backgroundColor: Colors.redAccent,
                                      ),
                                    );
                                    return;
                                  }

                                  if (pass != confirm) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'رمز عبور و تکرار آن مطابقت ندارند',
                                          style: TextStyle(
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                        backgroundColor: Colors.redAccent,
                                      ),
                                    );
                                    return;
                                  }

                                  setDialogState(() => isSubmitting = true);

                                  final bool success =
                                      await Provider.of<AppRepository>(
                                        context,
                                        listen: false,
                                      ).apiService.changePassword(null, pass);

                                  setDialogState(() => isSubmitting = false);

                                  if (context.mounted) {
                                    Navigator.pop(dialogContext);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          success
                                              ? 'رمز عبور ثابت شما با موفقیت ذخیره و فعال شد ✅'
                                              : 'خطا در ثبت رمز عبور. لطفاً دوباره تلاش کنید.',
                                          style: const TextStyle(
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                        backgroundColor: success
                                            ? const Color(0xFF10B981)
                                            : Colors.redAccent,
                                      ),
                                    );
                                  }
                                },
                          icon: isSubmitting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.save_rounded, size: 18),
                          label: Text(
                            isSubmitting
                                ? 'در حال ذخیره‌سازی...'
                                : 'ذخیره و ثبت رمز عبور ثابت',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'Vazirmatn',
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF8B5CF6),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
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

  // --- COMPREHENSIVE STUDENT IDENTITY & CARAVAN DOSSIER CARD ---
  Widget _buildIdentityAndFinancialCards(UserModel user) {
    final bool isMentor =
        user.role == UserRole.mentor || user.role == UserRole.superMentor;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Official Collapsible Identity & Profile Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF241544), Color(0xFF190F2F)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: user.identityVerified
                    ? const Color(0xFF10B981).withValues(alpha: 0.6)
                    : const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 15,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Row (Always Visible - Proper RTL: Title on Right, Actions on Left)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Right in RTL: Title and Shield/Lock Icon
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF38BDF8,
                            ).withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _isIdentityDossierExpanded
                                ? Icons.badge_outlined
                                : Icons.lock_outline,
                            color: const Color(0xFF38BDF8),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isMentor ? 'اطلاعات فردی راهبر' : 'اطلاعات فردی',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                            Text(
                              _isIdentityDossierExpanded
                                  ? 'اطلاعات هویتی و کاروانی'
                                  : 'اطلاعات هویتی (برای حفظ حریم خصوصی بسته است)',
                              style: const TextStyle(
                                color: Colors.white38,
                                fontSize: 9.5,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // Left in RTL: Edit button & Toggle View button
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Edit Info Button
                        InkWell(
                          onTap: () =>
                              _showEditStudentIdentityDialog(context, user),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF38BDF8,
                              ).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(
                                  0xFF38BDF8,
                                ).withValues(alpha: 0.4),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Text(
                                  'ویرایش',
                                  style: TextStyle(
                                    color: Color(0xFF38BDF8),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(
                                  Icons.edit_note,
                                  size: 16,
                                  color: Color(0xFF38BDF8),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Toggle Expand/Collapse (Show/Hide) Button
                        InkWell(
                          onTap: () {
                            setState(() {
                              _isIdentityDossierExpanded =
                                  !_isIdentityDossierExpanded;
                            });
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: _isIdentityDossierExpanded
                                  ? Colors.white.withValues(alpha: 0.08)
                                  : const Color(
                                      0xFF8B5CF6,
                                    ).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _isIdentityDossierExpanded
                                    ? Colors.white24
                                    : const Color(
                                        0xFF8B5CF6,
                                      ).withValues(alpha: 0.5),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _isIdentityDossierExpanded
                                      ? 'بستن'
                                      : 'مشاهده',
                                  style: TextStyle(
                                    color: _isIdentityDossierExpanded
                                        ? Colors.white70
                                        : const Color(0xFFC4B5FD),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(
                                  _isIdentityDossierExpanded
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: 15,
                                  color: _isIdentityDossierExpanded
                                      ? Colors.white70
                                      : const Color(0xFFC4B5FD),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // Collapsible Full Dossier Details
                AnimatedSize(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  child: !_isIdentityDossierExpanded
                      ? const SizedBox.shrink()
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 14),
                            const Divider(color: Colors.white12, height: 1),
                            const SizedBox(height: 14),

                            // Verification Badge in expanded view (Right aligned)
                            Align(
                              alignment: Alignment.centerRight,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: user.identityVerified
                                      ? const Color(
                                          0xFF10B981,
                                        ).withValues(alpha: 0.15)
                                      : const Color(
                                          0xFFFFD54F,
                                        ).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: user.identityVerified
                                        ? const Color(
                                            0xFF10B981,
                                          ).withValues(alpha: 0.4)
                                        : const Color(
                                            0xFFFFD54F,
                                          ).withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      user.identityVerified
                                          ? Icons.verified
                                          : Icons.pending_actions,
                                      color: user.identityVerified
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFFFFD54F),
                                      size: 14,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      user.identityVerified
                                          ? 'هویت تایید شده'
                                          : 'احراز هویت پایه',
                                      style: TextStyle(
                                        color: user.identityVerified
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFFFFD54F),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'Vazirmatn',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),

                            // Section A: Personal Details
                            _buildDossierSectionTitle(
                              '👤 مشخصات فردی',
                              const Color(0xFF38BDF8),
                            ),
                            const SizedBox(height: 8),
                            _buildInfoRow(
                              'نام و نام خانوادگی',
                              user.name,
                              icon: Icons.person_outline,
                            ),
                            _buildInfoRow(
                              'شماره همراه',
                              user.phoneNumber,
                              icon: Icons.phone_android,
                            ),
                            _buildInfoRow(
                              'کد ملی',
                              user.nationalId ?? 'ثبت نشده',
                              icon: Icons.credit_card,
                            ),
                            _buildInfoRow(
                              'تاریخ تولد',
                              user.dateOfBirth ?? 'ثبت نشده',
                              icon: Icons.cake_outlined,
                            ),
                            if (user.city != null && user.city!.isNotEmpty) ...[
                              _buildInfoRow(
                                'استان و شهر',
                                user.city!.contains(' - ')
                                    ? '${user.city!.split(' - ')[0]} / ${user.city!.split(' - ')[1]}'
                                    : user.city!,
                                icon: Icons.location_on_outlined,
                              ),
                              if (user.city!.contains(' - ') &&
                                  user.city!.split(' - ').length > 2)
                                _buildInfoRow(
                                  'نشانی دقیق',
                                  user.city!
                                      .split(' - ')
                                      .sublist(2)
                                      .join(' - '),
                                  icon: Icons.home_work_outlined,
                                  valueColor: const Color(0xFF38BDF8),
                                ),
                            ] else ...[
                              _buildInfoRow(
                                'استان و شهر',
                                'ثبت نشده',
                                icon: Icons.location_on_outlined,
                              ),
                            ],

                            const SizedBox(height: 14),
                            const Divider(color: Colors.white10, height: 1),
                            const SizedBox(height: 14),

                            // Section B: Caravan & Mentor Assignment
                            if (!isMentor) ...[
                              _buildDossierSectionTitle(
                                '🐫 کاروان و هم‌کاروانی‌ها',
                                const Color(0xFFFFD54F),
                              ),
                              const SizedBox(height: 8),
                              _buildInfoRow(
                                'کاروان عضویت',
                                user.caravanName ?? 'فاقد کاروان',
                                icon: Icons.groups_outlined,
                                valueColor: const Color(0xFFFFD54F),
                              ),
                              _buildInfoRow(
                                'راهبر کاروان',
                                user.caravanMentor ?? 'تعیین نشده',
                                icon: Icons.supervisor_account_outlined,
                                valueColor: const Color(0xFFEC4899),
                              ),
                              if (user.mentorPhone != null &&
                                  user.mentorPhone!.isNotEmpty)
                                _buildInfoRow(
                                  'شماره راهبر',
                                  user.mentorPhone!,
                                  icon: Icons.support_agent,
                                  valueColor: const Color(0xFF38BDF8),
                                ),
                              const SizedBox(height: 8),

                              // Peer members list (Proper RTL layout)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 4.0,
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: const [
                                        Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              Icons.people_outline,
                                              size: 15,
                                              color: Colors.white38,
                                            ),
                                            SizedBox(width: 6),
                                            Text(
                                              'هم‌کاروانی‌ها',
                                              style: TextStyle(
                                                color: Colors.white54,
                                                fontSize: 12,
                                                fontFamily: 'Vazirmatn',
                                              ),
                                            ),
                                          ],
                                        ),
                                        Text(
                                          '(فقط نام اعضا)',
                                          style: TextStyle(
                                            color: Colors.white30,
                                            fontSize: 10,
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    if (user.caravanMembers != null &&
                                        user.caravanMembers!.isNotEmpty)
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        alignment: WrapAlignment.start,
                                        children: user.caravanMembers!.map((m) {
                                          final String memberName =
                                              (m is Map
                                                  ? m['name']
                                                  : m?.toString()) ??
                                              'عضو کاروان';
                                          final bool isCurrent =
                                              (m is Map &&
                                                  m['id'] == user.id) ||
                                              memberName == user.name;
                                          return Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 9,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: isCurrent
                                                  ? const Color(
                                                      0xFF8B5CF6,
                                                    ).withValues(alpha: 0.25)
                                                  : Colors.white.withValues(
                                                      alpha: 0.07,
                                                    ),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                              border: Border.all(
                                                color: isCurrent
                                                    ? const Color(
                                                        0xFF8B5CF6,
                                                      ).withValues(alpha: 0.6)
                                                    : Colors.white12,
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  isCurrent
                                                      ? Icons.person
                                                      : Icons.person_outline,
                                                  size: 12,
                                                  color: isCurrent
                                                      ? const Color(0xFFC4B5FD)
                                                      : Colors.white38,
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  isCurrent
                                                      ? '$memberName (شما)'
                                                      : memberName,
                                                  style: TextStyle(
                                                    color: isCurrent
                                                        ? const Color(
                                                            0xFFC4B5FD,
                                                          )
                                                        : Colors.white70,
                                                    fontSize: 11,
                                                    fontWeight: isCurrent
                                                        ? FontWeight.bold
                                                        : FontWeight.normal,
                                                    fontFamily: 'Vazirmatn',
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        }).toList(),
                                      )
                                    else
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 8,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(
                                            alpha: 0.03,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                          border: Border.all(
                                            color: Colors.white10,
                                          ),
                                        ),
                                        child: const Align(
                                          alignment: Alignment.centerRight,
                                          child: Text(
                                            'در حال حاضر عضو دیگری در کاروان ثبت نشده است',
                                            style: TextStyle(
                                              color: Colors.white38,
                                              fontSize: 11,
                                              fontFamily: 'Vazirmatn',
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 14),
                              const Divider(color: Colors.white10, height: 1),
                              const SizedBox(height: 14),
                            ],

                            // Section C: Academic & Progression Stats
                            _buildDossierSectionTitle(
                              '🏆 وضعیت و سوابق آموزشی نپا',
                              const Color(0xFF10B981),
                            ),
                            const SizedBox(height: 8),
                            _buildInfoRow(
                              'سطح آموزشی',
                              'سطح ${user.levelFrame} (${GlobalState.getLevelLabel(GlobalState.getLevelForFrame(user.levelFrame))})',
                              icon: Icons.military_tech_outlined,
                              valueColor: GlobalState.getLevelColor(
                                GlobalState.getLevelForFrame(user.levelFrame),
                              ),
                            ),
                            _buildInfoRow(
                              'منزلگاه‌های گذرانده',
                              '${user.completedStationsCount} منزلگاه مصوب',
                              icon: Icons.flag_outlined,
                              valueColor: const Color(0xFF10B981),
                            ),
                            _buildInfoRow(
                              'گواهینامه‌های رسمی',
                              '${user.certificates?.length ?? 0} مدرک صادره',
                              icon: Icons.workspace_premium_outlined,
                              valueColor: const Color(0xFFFFD54F),
                            ),
                            _buildInfoRow(
                              'موجودی کل زریک',
                              '${user.zarikBalance} زریک فعال',
                              icon: Icons.stars_outlined,
                              valueColor: const Color(0xFFEC4899),
                            ),

                            const SizedBox(height: 16),
                            const Divider(color: Colors.white12, height: 1),
                            const SizedBox(height: 12),

                            // Collapse bottom button
                            Center(
                              child: InkWell(
                                onTap: () => setState(
                                  () => _isIdentityDossierExpanded = false,
                                ),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white12),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      Icon(
                                        Icons.keyboard_arrow_up,
                                        size: 16,
                                        color: Colors.white70,
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'بستن و مخفی‌سازی اطلاعات ▴',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDossierSectionTitle(String title, Color color) {
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        title,
        textAlign: TextAlign.right,
        style: TextStyle(
          color: color,
          fontSize: 12.5,
          fontWeight: FontWeight.bold,
          fontFamily: 'Vazirmatn',
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    String label,
    String value, {
    IconData? icon,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 15, color: Colors.white38),
                const SizedBox(width: 6),
              ],
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
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.left,
              style: TextStyle(
                color: valueColor ?? Colors.white.withValues(alpha: 0.85),
                fontSize: 13,
                fontWeight: FontWeight.w600,
                fontFamily: 'Vazirmatn',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  static const Map<String, List<String>> _iranProvincesAndCities = {
    'تهران': [
      'تهران',
      'ری',
      'شمیرانات',
      'اسلامشهر',
      'ورامین',
      'شهریار',
      'قدس',
      'ملارد',
      'پاکدشت',
      'دماوند',
      'پردیس',
      'رباط‌کریم',
      'بهارستان',
      'فیروزکوه',
    ],
    'خراسان رضوی': [
      'مشهد',
      'نیشابور',
      'سبزوار',
      'تربت حیدریه',
      'کاشمر',
      'قوچان',
      'تربت جام',
      'تایباد',
      'چناران',
      'سرخس',
      'گناباد',
      'فریمان',
      'درگز',
    ],
    'اصفهان': [
      'اصفهان',
      'کاشان',
      'خمینی‌شهر',
      'نجف‌آباد',
      'شاهین‌شهر',
      'شهرضا',
      'فولادشهر',
      'لنجان',
      'فلاورجان',
      'مبارکه',
      'آران و بیدگل',
      'گلپایگان',
      'نطنز',
      'نایین',
    ],
    'فارس': [
      'شیراز',
      'مرودشت',
      'جهرم',
      'فسا',
      'کازرون',
      'لارستان',
      'داراب',
      'فیروزآباد',
      'آباده',
      'اقلید',
      'لامرد',
      'استهبان',
      'نی‌ریز',
    ],
    'خوزستان': [
      'اهواز',
      'دزفول',
      'آبادان',
      'ماهشهر',
      'خرمشهر',
      'اندیمشک',
      'ایذه',
      'بهبهان',
      'شوشتر',
      'مسجدسلیمان',
      'بندر امام خمینی',
      'رامهرمز',
      'امیدیه',
      'شوش',
    ],
    'آذربایجان شرقی': [
      'تبریز',
      'مراغه',
      'مرند',
      'میانه',
      'اهر',
      'بناب',
      'سراب',
      'آذرشهر',
      'عجب‌شیر',
      'شبستر',
      'ملکان',
      'بستان‌آباد',
      'اسکو',
    ],
    'مازندران': [
      'ساری',
      'بابل',
      'آمل',
      'قائم‌شهر',
      'بابلسر',
      'تنکابن',
      'چالوس',
      'نوشهر',
      'بهشهر',
      'رامسر',
      'نور',
      'محمودآباد',
      'نکا',
      'فریدونکنار',
    ],
    'گیلان': [
      'رشت',
      'انزلی',
      'لاهیجان',
      'لنگرود',
      'تالش',
      'آستارا',
      'صومعه‌سرا',
      'آستانه اشرفیه',
      'رودسر',
      'فومن',
      'رودبار',
      'رضوانشهر',
    ],
    'البرز': [
      'کرج',
      'فردیس',
      'کمال‌شهر',
      'نظرآباد',
      'محمدشهر',
      'ماهدشت',
      'هشتگرد',
      'چهارباغ',
      'اشتهارد',
      'طالقان',
    ],
    'کرمان': [
      'کرمان',
      'سیرجان',
      'رفسنجان',
      'جیرفت',
      'بم',
      'زرند',
      'کهنوج',
      'شهربابک',
      'بافت',
      'بردسیر',
      'راور',
      'عنبرآباد',
    ],
    'یزد': [
      'یزد',
      'میبد',
      'اردکان',
      'بافق',
      'مهریز',
      'ابرکوه',
      'تفت',
      'اشکذر',
      'هرات',
      'مروست',
      'بهاباد',
    ],
    'قم': ['قم', 'جعفریه', 'کهک', 'قنوات', 'دستجرد', 'سلفچگان'],
    'کرمانشاه': [
      'کرمانشاه',
      'اسلام‌آباد غرب',
      'کنگاور',
      'جوانرود',
      'سنقر',
      'سرپل ذهاب',
      'هرسین',
      'صحنه',
      'پاوه',
      'گیلانغرب',
    ],
    'هرمزگان': [
      'بندرعباس',
      'میناب',
      'قشم',
      'کیش',
      'بندرلنگه',
      'رودان',
      'حاجی‌آباد',
      'بستک',
      'جاسک',
      'بندر خمیر',
      'پارسیان',
    ],
    'آذربایجان غربی': [
      'ارومیه',
      'خوی',
      'بوکان',
      'مهاباد',
      'میاندوآب',
      'سلماس',
      'پیرانشهر',
      'نقده',
      'سردشت',
      'شاهین‌دژ',
      'تکاب',
      'اشنویه',
    ],
    'کردستان': [
      'سنندج',
      'سقز',
      'مریوان',
      'بانه',
      'قروه',
      'کامیاران',
      'بیجار',
      'دیواندره',
      'دهگلان',
      'سروآباد',
    ],
    'همدان': [
      'همدان',
      'ملایر',
      'نهاوند',
      'اسدآباد',
      'تویسرکان',
      'بهار',
      'کبودرآهنگ',
      'رزن',
      'فامنین',
    ],
    'لرستان': [
      'خرم‌آباد',
      'بروجرد',
      'دورود',
      'کوهدشت',
      'الیگودرز',
      'نورآباد',
      'ازنا',
      'الشتر',
      'پلدختر',
    ],
    'مرکزی': [
      'اراک',
      'ساوه',
      'خمین',
      'محلات',
      'دلیجان',
      'زرندیه',
      'شازند',
      'تفرش',
      'آشتیان',
      'کمیجان',
    ],
    'بوشهر': [
      'بوشهر',
      'برازجان',
      'بندر کنگان',
      'گناوه',
      'خورموج',
      'عسلویه',
      'دیلم',
      'جم',
      'دیر',
      'دلوار',
    ],
    'گلستان': [
      'گرگان',
      'گنبد کاووس',
      'علی‌آباد کتول',
      'بندر ترکمن',
      'کردکوی',
      'کلاله',
      'آق‌قلا',
      'آزادشهر',
      'مینودشت',
    ],
    'زنجان': [
      'زنجان',
      'ابهر',
      'خرمدره',
      'قیدار',
      'هیدج',
      'صائین‌قلعه',
      'آب‌بر',
      'سلطانیه',
      'ماه‌نشان',
    ],
    'اردبیل': [
      'اردبیل',
      'پارس‌آباد',
      'مشگین‌شهر',
      'خلخال',
      'گرمی',
      'نمین',
      'بیله‌سوار',
      'سرعین',
      'گیوی',
      'اصلاندوز',
    ],
    'قزوین': [
      'قزوین',
      'الوند',
      'محمدیه',
      'تاکستان',
      'آبیک',
      'بویین‌زهرا',
      'شریفیه',
      'محمودآباد نمونه',
      'اقبالیه',
      'اسفرورین',
    ],
    'سیستان و بلوچستان': [
      'زاهدان',
      'چابهار',
      'زابل',
      'ایرانشهر',
      'سراوان',
      'خاش',
      'کنارک',
      'نیک‌شهر',
      'پیشین',
      'میرجاوه',
    ],
    'چهارمحال و بختیاری': [
      'شهرکرد',
      'بروجن',
      'فرخ‌شهر',
      'فارسان',
      'لردگان',
      'هفشجان',
      'سامان',
      'کیار',
      'بن',
      'اردل',
    ],
    'خراسان جنوبی': [
      'بیرجند',
      'قائن',
      'فردوس',
      'طبس',
      'نهبندان',
      'سرایان',
      'سربیشه',
      'بشرویه',
      'اسدیه',
      'خوسف',
    ],
    'کهگیلویه و بویراحمد': [
      'یاسوج',
      'دوگنبدان (گچساران)',
      'دهدشت',
      'لیکک',
      'چرام',
      'لنده',
      'باشت',
      'سی‌سخت',
    ],
    'سمنان': [
      'سمنان',
      'شاهرود',
      'دامغان',
      'گرمسار',
      'مهدی‌شهر',
      'ایوانکی',
      'سرخه',
      'شهمیرزاد',
      'میامی',
      'بسطام',
    ],
    'خراسان شمالی': [
      'بجنورد',
      'شیروان',
      'اسفراین',
      'آشخانه',
      'جاجرم',
      'گرمه',
      'فاروج',
      'راز',
    ],
    'ایلام': [
      'ایلام',
      'دهلران',
      'ایوان',
      'آبدانان',
      'دره‌شهر',
      'مهران',
      'سرابله',
      'ملکشاهی',
      'چوار',
    ],
  };

  void _showEditStudentIdentityDialog(BuildContext context, UserModel user) {
    final TextEditingController nameCtrl = TextEditingController(
      text: user.name,
    );
    final TextEditingController nationalIdCtrl = TextEditingController(
      text: user.nationalId ?? '',
    );
    final TextEditingController dobCtrl = TextEditingController(
      text: user.dateOfBirth ?? '',
    );

    // Parse existing city/address components
    String initialProvince = 'تهران';
    String initialCity = 'تهران';
    String initialAddress = '';

    if (user.city != null && user.city!.isNotEmpty) {
      final parts = user.city!.split(' - ');
      if (parts.isNotEmpty &&
          _iranProvincesAndCities.containsKey(parts[0].trim())) {
        initialProvince = parts[0].trim();
        if (parts.length > 1 &&
            _iranProvincesAndCities[initialProvince]!.contains(
              parts[1].trim(),
            )) {
          initialCity = parts[1].trim();
        } else {
          initialCity = _iranProvincesAndCities[initialProvince]!.first;
        }
        if (parts.length > 2) {
          initialAddress = parts.sublist(2).join(' - ').trim();
        }
      } else {
        initialAddress = user.city!;
      }
    }

    String selectedProvince = initialProvince;
    String selectedCity = initialCity;
    final TextEditingController addressCtrl = TextEditingController(
      text: initialAddress,
    );
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final List<String> currentCities =
                _iranProvincesAndCities[selectedProvince] ?? ['تهران'];
            if (!currentCities.contains(selectedCity)) {
              selectedCity = currentCities.first;
            }

            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white54),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                        const Text(
                          'ویرایش اطلاعات هویتی و آدرس',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Vazirmatn',
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12),
                    const SizedBox(height: 12),

                    // Name
                    _buildDialogInputLabel('نام و نام خانوادگی:'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nameCtrl,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                      ),
                      decoration: _dialogInputDecoration('مثال: محمد احمدی'),
                    ),
                    const SizedBox(height: 12),

                    // National ID
                    _buildDialogInputLabel('کد ملی (۱۰ رقم):'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nationalIdCtrl,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                      ),
                      decoration: _dialogInputDecoration('مثال: 0012345678'),
                    ),
                    const SizedBox(height: 12),

                    // Date of Birth
                    _buildDialogInputLabel('تاریخ تولد (روز / ماه / سال):'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: dobCtrl,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                      ),
                      decoration: _dialogInputDecoration('مثال: ۱۳۸۸/۰۵/۲۲'),
                    ),
                    const SizedBox(height: 14),

                    // 1. Province Dropdown
                    _buildDialogInputLabel('۱. انتخاب استان:'),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF150D27),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: selectedProvince,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1E1435),
                          icon: const Icon(
                            Icons.arrow_drop_down,
                            color: Color(0xFF38BDF8),
                          ),
                          style: const TextStyle(
                            color: Colors.white,
                            fontFamily: 'Vazirmatn',
                            fontSize: 13,
                          ),
                          items: _iranProvincesAndCities.keys.map((prov) {
                            return DropdownMenuItem<String>(
                              value: prov,
                              alignment: Alignment.centerRight,
                              child: Text(
                                prov,
                                style: const TextStyle(fontFamily: 'Vazirmatn'),
                              ),
                            );
                          }).toList(),
                          onChanged: (newProv) {
                            if (newProv != null) {
                              setDialogState(() {
                                selectedProvince = newProv;
                                selectedCity =
                                    _iranProvincesAndCities[newProv]!.first;
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 2. City Dropdown (Filtered by selected province)
                    _buildDialogInputLabel(
                      '۲. انتخاب شهر ($selectedProvince):',
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF150D27),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.4),
                        ),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: selectedCity,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1E1435),
                          icon: const Icon(
                            Icons.arrow_drop_down,
                            color: Color(0xFF38BDF8),
                          ),
                          style: const TextStyle(
                            color: Color(0xFF38BDF8),
                            fontFamily: 'Vazirmatn',
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                          items: currentCities.map((city) {
                            return DropdownMenuItem<String>(
                              value: city,
                              alignment: Alignment.centerRight,
                              child: Text(
                                city,
                                style: const TextStyle(fontFamily: 'Vazirmatn'),
                              ),
                            );
                          }).toList(),
                          onChanged: (newCity) {
                            if (newCity != null) {
                              setDialogState(() {
                                selectedCity = newCity;
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 3. Detailed Street / Alley / Plaque Address
                    _buildDialogInputLabel(
                      '۳. آدرس دقیق (خیابان، محله، کوچه، پلاک و واحد):',
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: addressCtrl,
                      maxLines: 2,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'Vazirmatn',
                        fontSize: 12.5,
                      ),
                      decoration: _dialogInputDecoration(
                        'مثال: خیابان امام خمینی، کوچه لاله ۴، پلاک ۱۲، طبقه ۲',
                      ),
                    ),
                    const SizedBox(height: 22),

                    // Submit Button
                    ElevatedButton(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final name = nameCtrl.text.trim();
                              final nationalId = nationalIdCtrl.text.trim();
                              if (name.isEmpty || nationalId.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'لطفاً نام و کد ملی را وارد نمایید',
                                      style: TextStyle(fontFamily: 'Vazirmatn'),
                                    ),
                                    backgroundColor: Colors.redAccent,
                                  ),
                                );
                                return;
                              }

                              final fullAddressCombined =
                                  addressCtrl.text.trim().isNotEmpty
                                  ? '$selectedProvince - $selectedCity - ${addressCtrl.text.trim()}'
                                  : '$selectedProvince - $selectedCity';

                              setDialogState(() => isSaving = true);
                              try {
                                final api = HttpApiService();
                                await api.completeProfile({
                                  'name': name,
                                  'nationalId': nationalId,
                                  'dateOfBirth': dobCtrl.text.trim(),
                                  'city': fullAddressCombined,
                                });
                                if (context.mounted) {
                                  await Provider.of<AppRepository>(
                                    context,
                                    listen: false,
                                  ).refreshUser();
                                }
                                if (ctx.mounted) {
                                  Navigator.pop(ctx);
                                }
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        '✅ مشخصات هویتی و آدرس با موفقیت ذخیره شد',
                                        style: TextStyle(
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                      backgroundColor: Color(0xFF10B981),
                                    ),
                                  );
                                }
                              } catch (e) {
                                setDialogState(() => isSaving = false);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'خطا در ذخیره مشخصات: $e',
                                        style: const TextStyle(
                                          fontFamily: 'Vazirmatn',
                                        ),
                                      ),
                                    ),
                                  );
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'ذخیره و ثبت مشخصات هویتی',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
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

  Widget _buildDialogInputLabel(String label) {
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          fontFamily: 'Vazirmatn',
        ),
      ),
    );
  }

  InputDecoration _dialogInputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(
        color: Colors.white30,
        fontSize: 12,
        fontFamily: 'Vazirmatn',
      ),
      filled: true,
      fillColor: const Color(0xFF150D27),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white12),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF8B5CF6), width: 1.5),
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
