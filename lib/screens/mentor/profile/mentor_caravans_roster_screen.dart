import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/widgets/station_progress_stepper.dart';

class CaravanModel {
  final String id;
  final String name;
  final String mentorName;
  final int memberCount;
  final List<CaravanMemberModel> members;

  CaravanModel({
    required this.id,
    required this.name,
    required this.mentorName,
    required this.memberCount,
    required this.members,
  });

  factory CaravanModel.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawMembers = json['members'] ?? json['membersList'] ?? [];
    final parsedMembers = rawMembers.map((m) => CaravanMemberModel.fromJson(m is Map<String, dynamic> ? m : {})).toList();
    return CaravanModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'کاروان',
      mentorName: json['mentor']?['name']?.toString() ?? json['mentorName']?.toString() ?? 'راهبر کاروان',
      memberCount: json['memberCount'] is int ? json['memberCount'] : parsedMembers.length,
      members: parsedMembers,
    );
  }
}

class CaravanMemberModel {
  final String id;
  final String name;
  final String phoneNumber;
  final String avatarUrl;
  final int levelFrame;
  final int zarikBalance;
  final int nakh;
  final int farsh;
  final int beyragh;
  final String role;

  CaravanMemberModel({
    required this.id,
    required this.name,
    required this.phoneNumber,
    required this.avatarUrl,
    required this.levelFrame,
    required this.zarikBalance,
    required this.nakh,
    required this.farsh,
    required this.beyragh,
    required this.role,
  });

  factory CaravanMemberModel.fromJson(Map<String, dynamic> json) {
    return CaravanMemberModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'عضو کاروان',
      phoneNumber: json['phoneNumber']?.toString() ?? '۰۹۱۲۰۰۰۰۰۰۰',
      avatarUrl: json['avatarUrl']?.toString() ?? '',
      levelFrame: (json['levelFrame'] is int) ? json['levelFrame'] : 1,
      zarikBalance: (json['zarikBalance'] is int) ? json['zarikBalance'] : (json['zarik'] is int ? json['zarik'] : 0),
      nakh: (json['nakh'] is int) ? json['nakh'] : 0,
      farsh: (json['farsh'] is int) ? json['farsh'] : 0,
      beyragh: (json['beyragh'] is int) ? json['beyragh'] : 0,
      role: json['role']?.toString() ?? 'student',
    );
  }
}

class MentorCaravansRosterScreen extends StatefulWidget {
  const MentorCaravansRosterScreen({super.key});

  @override
  State<MentorCaravansRosterScreen> createState() => _MentorMembersScreenState();
}

class _MentorMembersScreenState extends State<MentorCaravansRosterScreen> {
  List<CaravanModel> _caravans = [];
  int _selectedCaravanIndex = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCaravansAndMembers();
  }

  Future<void> _loadCaravansAndMembers() async {
    setState(() => _isLoading = true);
    try {
      final repository = Provider.of<AppRepository>(context, listen: false);
      final currentUser = repository.currentUser;

      final caravansData = await HttpApiService().getCaravans();
      if (caravansData.isNotEmpty) {
        final parsed = caravansData.map((c) => CaravanModel.fromJson(c)).toList();
        if (mounted) {
          setState(() {
            _caravans = parsed;
            _selectedCaravanIndex = 0;
            _isLoading = false;
          });
        }
        return;
      }

      // Fallback: If no caravans list returned, fetch current mentor caravan details
      if (currentUser.caravanId != null && currentUser.caravanId!.isNotEmpty) {
        final details = await HttpApiService().getCaravanDetails(currentUser.caravanId!);
        if (details != null && mounted) {
          final c = CaravanModel.fromJson(details);
          setState(() {
            _caravans = [c];
            _selectedCaravanIndex = 0;
            _isLoading = false;
          });
          return;
        }
      }

      // Default sample fallback for offline / fresh preview
      if (mounted) {
        setState(() {
          _caravans = [
            CaravanModel(
              id: 'c1',
              name: 'کاروان شماره پنجم',
              mentorName: currentUser.name.isNotEmpty ? currentUser.name : 'رضا جلالی',
              memberCount: 3,
              members: [
                CaravanMemberModel(
                  id: 'u1',
                  name: 'محمد حسینی',
                  phoneNumber: '۰۹۱۲۳۴۵۶۷۸۹',
                  avatarUrl: '',
                  levelFrame: 2,
                  zarikBalance: 350,
                  nakh: 2,
                  farsh: 1,
                  beyragh: 4,
                  role: 'student',
                ),
                CaravanMemberModel(
                  id: 'u2',
                  name: 'علی تقوی',
                  phoneNumber: '۰۹۳۵۱۲۳۴۵۶۷',
                  avatarUrl: '',
                  levelFrame: 1,
                  zarikBalance: 200,
                  nakh: 1,
                  farsh: 0,
                  beyragh: 2,
                  role: 'student',
                ),
                CaravanMemberModel(
                  id: 'u3',
                  name: 'سجاد رضایی',
                  phoneNumber: '۰۹۱۹۸۷۶۵۴۳۲',
                  avatarUrl: '',
                  levelFrame: 3,
                  zarikBalance: 520,
                  nakh: 4,
                  farsh: 2,
                  beyragh: 5,
                  role: 'student',
                ),
              ],
            ),
            CaravanModel(
              id: 'c2',
              name: 'کاروان شماره ششم',
              mentorName: currentUser.name.isNotEmpty ? currentUser.name : 'رضا جلالی',
              memberCount: 2,
              members: [
                CaravanMemberModel(
                  id: 'u4',
                  name: 'مهدی کاظمی',
                  phoneNumber: '۰۹۱۲۹۹۹۸۸۷۷',
                  avatarUrl: '',
                  levelFrame: 1,
                  zarikBalance: 150,
                  nakh: 0,
                  farsh: 0,
                  beyragh: 1,
                  role: 'student',
                ),
                CaravanMemberModel(
                  id: 'u5',
                  name: 'حسین احمدی',
                  phoneNumber: '۰۹۱۸۱۱۱۲۲۳۳',
                  avatarUrl: '',
                  levelFrame: 2,
                  zarikBalance: 410,
                  nakh: 3,
                  farsh: 1,
                  beyragh: 3,
                  role: 'student',
                ),
              ],
            ),
          ];
          _selectedCaravanIndex = 0;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddMemberDialog() {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final noteController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: const Color(0xFF28274A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF5A588B), width: 1.2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'درخواست اضافه کردن کاربر',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameController,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                    decoration: InputDecoration(
                      labelText: 'نام و نام خانوادگی دانش‌آموز',
                      labelStyle: const TextStyle(color: Color(0xFFB5B3C8), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                    decoration: InputDecoration(
                      labelText: 'شماره همراه دانش‌آموز',
                      labelStyle: const TextStyle(color: Color(0xFFB5B3C8), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 2,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                    decoration: InputDecoration(
                      labelText: 'توضیحات یا علت درخواست (اختیاری)',
                      labelStyle: const TextStyle(color: Color(0xFFB5B3C8), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF6B68A8)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('انصراف', style: TextStyle(color: Colors.white70, fontFamily: AppTheme.fontFamily)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            if (nameController.text.trim().isEmpty || phoneController.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('لطفاً نام و شماره همراه را وارد کنید', style: TextStyle(fontFamily: AppTheme.fontFamily))),
                              );
                              return;
                            }
                            Navigator.pop(ctx);
                            try {
                              await HttpApiService().createTicket(
                                category: 'general',
                                subject: 'درخواست اضافه کردن کاربر: ${nameController.text.trim()} (${phoneController.text.trim()}) - ${noteController.text.trim()}',
                              );
                            } catch (_) {}
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('درخواست اضافه کردن کاربر با موفقیت برای مدیریت ارسال شد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
                                  backgroundColor: Color(0xFF10B981),
                                ),
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDE9959),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('ارسال درخواست', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showDeleteMemberDialog(CaravanMemberModel member, CaravanModel caravan) {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: const Color(0xFF28274A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF5A588B), width: 1.2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'درخواست حذف کاربر',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'آیا از ارسال درخواست حذف «${member.name}» از ${caravan.name} اطمینان دارید؟',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFD6D3E6), fontSize: 13, height: 1.5, fontFamily: AppTheme.fontFamily),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF6B68A8)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('انصراف', style: TextStyle(color: Colors.white70, fontFamily: AppTheme.fontFamily)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(ctx);
                          try {
                            await HttpApiService().removeMemberFromCaravan(caravan.id, member.id);
                          } catch (_) {}
                          if (mounted) {
                            setState(() {
                              caravan.members.removeWhere((m) => m.id == member.id);
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('درخواست حذف «${member.name}» با موفقیت ثبت شد', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
                                backgroundColor: const Color(0xFFDE9959),
                              ),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE11D48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('تایید حذف', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                      ),
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

  void _showContactMemberDialog(CaravanMemberModel member) {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: const Color(0xFF28274A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF5A588B), width: 1.2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'تماس با ${member.name}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1D36),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Icon(Icons.phone_rounded, color: Color(0xFF8B88E8), size: 20),
                      Text(
                        member.phoneNumber,
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: member.phoneNumber));
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('شماره تماس کپی شد', style: TextStyle(fontFamily: AppTheme.fontFamily))),
                          );
                        },
                        icon: const Icon(Icons.copy_rounded, color: Colors.white70, size: 16),
                        label: const Text('کپی شماره', style: TextStyle(color: Colors.white70, fontFamily: AppTheme.fontFamily, fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF6B68A8)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final uri = Uri.parse('tel:${member.phoneNumber}');
                          if (await canLaunchUrl(uri)) {
                            await launchUrl(uri);
                          }
                        },
                        icon: const Icon(Icons.call_rounded, color: Colors.white, size: 16),
                        label: const Text('تماس تلفنی', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily, fontSize: 12)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
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

  void _openMemberReportCard(CaravanMemberModel member, CaravanModel caravan) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => StudentReportCardAndEvaluationScreen(
          member: member,
          caravanName: caravan.name,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const AppScaffold(
        showBackButton: true,
        showNotificationIcon: true,
        showDrawerButton: true,
        showBottomNavBar: true,
        currentBottomNavIndex: 4,
        body: Center(child: CircularProgressIndicator(color: Color(0xFFCD8449))),
      );
    }

    final currentCaravan = _caravans.isNotEmpty && _selectedCaravanIndex < _caravans.length
        ? _caravans[_selectedCaravanIndex]
        : null;

    final membersList = currentCaravan?.members ?? [];

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 4,
      body: RefreshIndicator(
        onRefresh: _loadCaravansAndMembers,
        color: const Color(0xFFCD8449),
        backgroundColor: const Color(0xFF231C38),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),

                // 1. Caravan Selector Header Guide
                const Center(
                  child: Text(
                    'کاروان خود انتخاب کنید',
                    style: TextStyle(
                      color: Color(0xFFB5B3C8),
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // 2. Caravan Carousel / Pills Row (Matching Assets pills in HomeScreen)
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _caravans.length,
                    separatorBuilder: (ctx, idx) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final caravan = _caravans[index];
                      final isSelected = _selectedCaravanIndex == index;
                      final badgeNumber = (index + 1).toPersian();

                      return _buildCaravanPill(
                        badgeNumber: badgeNumber,
                        name: caravan.name,
                        isSelected: isSelected,
                        onTap: () {
                          setState(() {
                            _selectedCaravanIndex = index;
                          });
                        },
                      );
                    },
                  ),
                ),

                const SizedBox(height: 18),

                // 3. Add User Request Button (Outlined pill button matching reference)
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton(
                    onPressed: _showAddMemberDialog,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF8B88E8), width: 1.1),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      minimumSize: const Size(0, 32),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'درخواست اضافه کردن کاربر',
                      style: TextStyle(
                        color: Color(0xFFE2E0F2),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // 4. Members List (Styled as Class Box Container)
                if (membersList.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    alignment: Alignment.center,
                    child: const Text(
                      'عضوی در این کاروان یافت نشد',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 13,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: membersList.length,
                    separatorBuilder: (ctx, idx) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final member = membersList[index];
                      return _buildMemberCard(member, currentCaravan!);
                    },
                  ),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Caravan Pill matching Asset Pill in HomeScreen
  Widget _buildCaravanPill({
    required String badgeNumber,
    required String name,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: isSelected
              ? const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: [0.0, 0.5, 1.0],
                  colors: [
                    Color(0xFF8D5B2C),
                    Color(0xFFFFD580),
                    Color(0xFF8D5B2C),
                  ],
                )
              : const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: [0.0, 0.5, 1.0],
                  colors: [
                    Color(0xFF3A3A6A),
                    Color(0xFF9292E2),
                    Color(0xFF3A3A6A),
                  ],
                ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(1.2),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20.8),
            gradient: isSelected
                ? const LinearGradient(
                    colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: isSelected ? null : const Color(0xFF28274A),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Badge circle with number
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF653A18) : const Color(0xFF8B88E8),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    badgeNumber,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // Caravan Name
              Text(
                name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Member Card styled like Class Box Container
  Widget _buildMemberCard(CaravanMemberModel member, CaravanModel caravan) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openMemberReportCard(member, caravan),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              stops: [0.0, 0.5, 1.0],
              colors: [
                Color(0xFF3A3A6A),
                Color(0xFF9292E2),
                Color(0xFF3A3A6A),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          padding: const EdgeInsets.all(1.2),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF28274A),
              borderRadius: BorderRadius.circular(14.8),
            ),
            child: Row(
              children: [
                // Right: User Avatar + Name
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        color: Color(0xFF6462A2),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: SafeAvatar(
                          radius: 17,
                          imageUrl: member.avatarUrl,
                          name: member.name,
                          backgroundColor: Colors.transparent,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      member.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ],
                ),

                const Spacer(),

                // Left: Action Buttons (درخواست حذف, تماس, chevron)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // درخواست حذف (Delete request) button
                    OutlinedButton(
                      onPressed: () => _showDeleteMemberDialog(member, caravan),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFDE9959), width: 1.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        minimumSize: const Size(0, 26),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'درخواست حذف',
                        style: TextStyle(
                          color: Color(0xFFE2E0F2),
                          fontSize: 10.5,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),

                    // تماس (Call) button
                    OutlinedButton(
                      onPressed: () => _showContactMemberDialog(member),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF8B88E8), width: 1.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        minimumSize: const Size(0, 26),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'تماس',
                        style: TextStyle(
                          color: Color(0xFFE2E0F2),
                          fontSize: 10.5,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // Chevron indicator
                    const Icon(
                      Icons.expand_less_rounded,
                      color: Color(0xFF9E9CD6),
                      size: 20,
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
}

// -----------------------------------------------------------------------------
// STUDENT REPORT CARD & EVALUATION SCREEN (صفحه کارنامه و ارزیابی فرد)
// -----------------------------------------------------------------------------
class StudentReportCardAndEvaluationScreen extends StatefulWidget {
  final CaravanMemberModel member;
  final String caravanName;

  const StudentReportCardAndEvaluationScreen({
    super.key,
    required this.member,
    required this.caravanName,
  });

  @override
  State<StudentReportCardAndEvaluationScreen> createState() => _StudentReportCardAndEvaluationScreenState();
}

class _StudentReportCardAndEvaluationScreenState extends State<StudentReportCardAndEvaluationScreen> {
  final TextEditingController _noteController = TextEditingController();
  int _selectedRating = 5;
  bool _isSavingNote = false;
  List<Map<String, dynamic>> _stations = [];

  @override
  void initState() {
    super.initState();
    _loadStations();
  }

  Future<void> _loadStations() async {
    try {
      final stations = await HttpApiService().getStations();
      if (mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(stations);
        });
      }
    } catch (_) {}
  }

  Future<void> _saveNote() async {
    final text = _noteController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSavingNote = true);
    try {
      await HttpApiService().savePrivateNote(widget.member.id, text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('یادداشت ارزیابی با موفقیت ذخیره شد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        _noteController.clear();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('خطا در ذخیره یادداشت', style: TextStyle(fontFamily: AppTheme.fontFamily))),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingNote = false);
    }
  }

  final Set<int> _expandedStationIndices = {0};

  List<Map<String, dynamic>> _getStationSessions(int stationIndex, Map<String, dynamic>? stationData) {
    if (stationData != null && stationData['categories'] != null) {
      final categories = stationData['categories'] as List? ?? [];
      final List<Map<String, dynamic>> sessions = [];
      for (final cat in categories) {
        if (cat is Map && cat['sessions'] is List) {
          sessions.addAll((cat['sessions'] as List).whereType<Map<String, dynamic>>());
        }
      }
      if (sessions.isNotEmpty) return sessions;
    }

    return [
      {
        'title': 'جلسه اول: شناخت مبانی و مهارت‌های فردی',
        'subtitle': 'ویدیو آموزشی و بررسی مفاهیم',
        'isCompleted': (stationIndex + 1) < widget.member.levelFrame,
      },
      {
        'title': 'جلسه دوم: تحلیل چالش‌ها و کار تیمی کاروان',
        'subtitle': 'تمرین عملی و سناریوهای حل مسئله',
        'isCompleted': (stationIndex + 1) < widget.member.levelFrame,
      },
      {
        'title': 'جلسه سوم: مهارت‌های رسانه‌ای و ارتباط موثر',
        'subtitle': 'کلاس تخصصی و دستاوردهای رسانه‌ای',
        'isCompleted': (stationIndex + 1) < widget.member.levelFrame,
      },
      {
        'title': 'جلسه چهارم: آزمون پایانی و ارزیابی منزلگاه',
        'subtitle': 'آزمون جامع و دریافت پاداش زریک',
        'isCompleted': (stationIndex + 1) < widget.member.levelFrame,
      },
    ];
  }

  @override
  Widget build(BuildContext context) {
    final member = widget.member;
    final int certificatesCount = member.levelFrame > 1 ? (member.levelFrame - 1) : 0;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: 4,
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Station Progress Stepper (استپر بالای منزلگاه)
              StationProgressStepper(
                currentStationIndex: (member.levelFrame - 1).clamp(0, 5),
                userLevelFrame: member.levelFrame,
                completedStationsCount: member.levelFrame > 1 ? member.levelFrame - 1 : 0,
                title: 'منزلگاه‌های آموزشی کاربر',
              ),

              const SizedBox(height: 18),

              // 2. Student Header Card (باکس مشخصات کاربر با استایل مبادله)
              _buildExchangeCard(
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        color: Color(0xFF6462A2),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: SafeAvatar(
                          radius: 24,
                          imageUrl: member.avatarUrl,
                          name: member.name,
                          backgroundColor: Colors.transparent,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            member.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15.5,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'عضو ${widget.caravanName}',
                            style: const TextStyle(
                              color: Color(0xFFB5B3C8),
                              fontSize: 11.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'شماره تماس: ${member.phoneNumber}',
                            style: const TextStyle(
                              color: Color(0xFF9E9CD6),
                              fontSize: 10.5,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 3. Overall Progress Card (باکس وضعیت کلی با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'وضعیت کلی مسافر در کاروان',
                      style: TextStyle(
                        color: Color(0xFFFFD580),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildStatBox('منزلگاه کنونی', member.levelFrame.toPersian()),
                        _buildStatBox('ویدیوها', ((member.levelFrame * 3) + 2).toPersian()),
                        _buildStatBox('آزمون‌ها', (member.levelFrame * 2).toPersian()),
                        _buildStatBox('گواهی‌نامه‌ها', certificatesCount.toPersian()),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 4. Wealth & Assets Card (باکس دارایی‌ها با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'دارایی‌ها و پاداش‌ها',
                      style: TextStyle(
                        color: Color(0xFFFFD580),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildAssetBox('زریک', member.zarikBalance.toPersian(), const Color(0xFFE5A66B)),
                        _buildAssetBox('درفش', member.beyragh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox('نخ', member.nakh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox('فرش', member.farsh.toPersian(), const Color(0xFF9292E2)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 5. Station Road Map Summary & Sessions Accordion (پیشرفت در منزلگاه‌ها با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'پیشرفت در منزلگاه‌ها',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 14),
                    for (int i = 0; i < (_stations.isNotEmpty ? _stations.length : 6); i++) ...[
                      _buildStationAccordionItem(
                        index: i,
                        stationData: i < _stations.length ? _stations[i] : null,
                        userLevelFrame: member.levelFrame,
                      ),
                      if (i < (_stations.isNotEmpty ? _stations.length : 6) - 1)
                        const SizedBox(height: 10),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 6. Mentor Evaluation & Private Notes (باکس ارزیابی با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ارزیابی و یادداشت راهبر',
                      style: TextStyle(
                        color: Color(0xFFFFD580),
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Text('امتیاز عملکرد: ', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: AppTheme.fontFamily)),
                        Row(
                          children: List.generate(5, (index) {
                            return IconButton(
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                              icon: Icon(
                                index < _selectedRating ? Icons.star_rounded : Icons.star_border_rounded,
                                color: const Color(0xFFFFD580),
                                size: 22,
                              ),
                              onPressed: () {
                                setState(() {
                                  _selectedRating = index + 1;
                                });
                              },
                            );
                          }),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _noteController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                      decoration: InputDecoration(
                        hintText: 'ثبت یادداشت خصوصی در خصوص عملکرد، نقاط قوت و نیازهای آموزشی کاربر...',
                        hintStyle: const TextStyle(color: Colors.white38, fontSize: 12, fontFamily: AppTheme.fontFamily),
                        filled: true,
                        fillColor: const Color(0xFF1E1D36),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: ElevatedButton(
                        onPressed: _isSavingNote ? null : _saveNote,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDE9959),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _isSavingNote
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('ثبت یادداشت', style: TextStyle(fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  /// Station Accordion Item with nested Stepper of sessions
  Widget _buildStationAccordionItem({
    required int index,
    required Map<String, dynamic>? stationData,
    required int userLevelFrame,
  }) {
    final bool isCompletedStation = (index + 1) < userLevelFrame;
    final bool isCurrentStation = (index + 1) == userLevelFrame;
    final bool isLocked = (index + 1) > userLevelFrame;
    final bool isExpanded = _expandedStationIndices.contains(index);

    final String stationTitle = stationData != null && stationData['title'] != null
        ? stationData['title'].toString()
        : 'منزلگاه ${index + 1}';

    final sessions = _getStationSessions(index, stationData);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isCurrentStation
              ? const Color(0xFFDE9959).withValues(alpha: 0.6)
              : const Color(0xFF453F73).withValues(alpha: 0.5),
          width: 1.1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: Column(
          children: [
            // Station Header Row (Tap to expand/collapse)
            InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedStationIndices.remove(index);
                  } else {
                    _expandedStationIndices.add(index);
                  }
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    // Status Badge Icon
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isCompletedStation
                            ? const Color(0xFF10B981)
                            : (isCurrentStation ? const Color(0xFFDE9959) : const Color(0xFF383562)),
                      ),
                      child: Center(
                        child: Icon(
                          isCompletedStation
                              ? Icons.check_rounded
                              : (isCurrentStation ? Icons.play_arrow_rounded : Icons.lock_outline_rounded),
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Station Title
                    Expanded(
                      child: Text(
                        'منزلگاه ${(index + 1).toPersian()}: $stationTitle',
                        style: TextStyle(
                          color: isLocked ? Colors.white54 : Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    // Chevron Arrow
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: const Color(0xFF9E9CD6),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),

            // Expanded Sessions Stepper List
            if (isExpanded) ...[
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF161528),
                  border: Border(top: BorderSide(color: Color(0xFF282542), width: 1.0)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  children: List.generate(sessions.length, (sIdx) {
                    final session = sessions[sIdx];
                    final bool isSessionCompleted = isCompletedStation || (isCurrentStation && sIdx == 0);
                    final isLastSession = sIdx == sessions.length - 1;

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Stepper Node & Line on Right in RTL
                        Column(
                          children: [
                            Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSessionCompleted
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF352F5A),
                                border: Border.all(
                                  color: isSessionCompleted
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFF8B88E8).withValues(alpha: 0.6),
                                  width: 1.2,
                                ),
                              ),
                              child: Center(
                                child: Icon(
                                  isSessionCompleted ? Icons.check_rounded : Icons.play_arrow_rounded,
                                  color: isSessionCompleted ? Colors.white : const Color(0xFFFFD580),
                                  size: 13,
                                ),
                              ),
                            ),
                            if (!isLastSession)
                              Container(
                                width: 2,
                                height: 32,
                                color: isSessionCompleted
                                    ? const Color(0xFF10B981).withValues(alpha: 0.5)
                                    : const Color(0xFF383562),
                              ),
                          ],
                        ),

                        const SizedBox(width: 12),

                        // Session Title and Subtitle
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  session['title']?.toString() ?? 'جلسه ${(sIdx + 1).toPersian()}',
                                  style: TextStyle(
                                    color: isSessionCompleted ? Colors.white : const Color(0xFFDDD9EE),
                                    fontSize: 12,
                                    fontWeight: isSessionCompleted ? FontWeight.bold : FontWeight.w500,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  isSessionCompleted
                                      ? 'مشاهده‌شده و تایید شده ✓'
                                      : (isLocked ? 'قفل شده' : 'آماده مشاهده و گذراندن'),
                                  style: TextStyle(
                                    color: isSessionCompleted ? const Color(0xFF10B981) : const Color(0xFF8E8B9E),
                                    fontSize: 10.5,
                                    fontFamily: AppTheme.fontFamily,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Exchange Box Decoration (باکس قالب مبادله)
  static Widget _buildExchangeCard({required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          stops: [0.0, 0.5, 1.0],
          colors: [
            Color(0xFF3A3A6A),
            Color(0xFF9292E2),
            Color(0xFF3A3A6A),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20.8),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.53, 1.0],
            colors: [
              Color(0xFF3D3C67),
              Color(0xFF36345C),
              Color(0xFF333359),
            ],
          ),
        ),
        child: child,
      ),
    );
  }

  static Widget _buildStatBox(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFFB5B3C8), fontSize: 11, fontFamily: AppTheme.fontFamily)),
      ],
    );
  }

  static Widget _buildAssetBox(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1D36),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: AppTheme.fontFamily)),
        ],
      ),
    );
  }
}


typedef MentorMembersScreen = MentorCaravansRosterScreen;
