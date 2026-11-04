import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';
import '../../../widgets/nopa_modal_shell.dart';
import 'package:nopa_app/core/station_numbering.dart';
import 'package:nopa_app/core/asset_names.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
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

    showNopaModal<void>(
      context,
      builder: (ctx) => NopaModalShell(
        maxWidth: 420,
        headerIcon: Icons.person_add_alt_1_rounded,
        title: 'درخواست اضافه کردن کاربر',
        actions: [
          NopaModalAction(
            label: 'ارسال درخواست',
            onPressed: () async {
                            if (nameController.text.trim().isEmpty || phoneController.text.trim().isEmpty) {
                              AppToast.error(context, 'لطفاً نام و شماره همراه را وارد کنید');
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
                              AppToast.info(context, 'درخواست اضافه کردن کاربر با موفقیت برای مدیریت ارسال شد');
                            }
                          },
          ),
          NopaModalAction(
            label: 'انصراف',
            variant: NopaModalActionVariant.secondary,
            onPressed: () => Navigator.pop(ctx),
          ),
        ],
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
                  TextField(
                    controller: nameController,
                    style: AppTypography.bodyLarge,
                    decoration: InputDecoration(
                      labelText: 'نام و نام خانوادگی دانش‌آموز',
                      labelStyle: AppTypography.bodyMediumMuted,
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    style: AppTypography.bodyLarge,
                    decoration: InputDecoration(
                      labelText: 'شماره همراه دانش‌آموز',
                      labelStyle: AppTypography.bodyMediumMuted,
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 2,
                    style: AppTypography.bodyLarge,
                    decoration: InputDecoration(
                      labelText: 'توضیحات یا علت درخواست (اختیاری)',
                      labelStyle: AppTypography.bodyMediumMuted,
                      filled: true,
                      fillColor: const Color(0xFF1E1D36),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
          ],
        ),
      ),
    );
  }

  void _showDeleteMemberDialog(CaravanMemberModel member, CaravanModel caravan) {
    showNopaModal<void>(
      context,
      builder: (ctx) => NopaModalShell(
        maxWidth: 420,
        headerIcon: Icons.person_remove_alt_1_rounded,
        title: 'درخواست حذف کاربر',
        actions: [
          NopaModalAction(
            label: 'تایید حذف',
            variant: NopaModalActionVariant.danger,
            onPressed: () async {
                          Navigator.pop(ctx);
                          try {
                            await HttpApiService().removeMemberFromCaravan(caravan.id, member.id);
                          } catch (_) {}
                          if (mounted) {
                            setState(() {
                              caravan.members.removeWhere((m) => m.id == member.id);
                            });
                            AppToast.info(context, 'درخواست حذف «${member.name}» با موفقیت ثبت شد');
                          }
                        },
          ),
          NopaModalAction(
            label: 'انصراف',
            variant: NopaModalActionVariant.secondary,
            onPressed: () => Navigator.pop(ctx),
          ),
        ],
        child: Text(
          'آیا از ارسال درخواست حذف «${member.name}» از ${caravan.name} اطمینان دارید؟',
          textAlign: TextAlign.center,
          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFD6D3E6)),
        ),
      ),
    );
  }

  void _showContactMemberDialog(CaravanMemberModel member) {
    showNopaModal<void>(
      context,
      builder: (ctx) => NopaModalShell(
        maxWidth: 420,
        headerIcon: Icons.call_rounded,
        title: 'تماس با ${member.name}',
        actions: [
          NopaModalAction(
            label: 'تماس تلفنی',
            onPressed: () async {
              Navigator.pop(ctx);
              final uri = Uri.parse('tel:${member.phoneNumber}');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
            },
          ),
          NopaModalAction(
            label: 'کپی شماره',
            variant: NopaModalActionVariant.secondary,
            onPressed: () {
              Clipboard.setData(ClipboardData(text: member.phoneNumber));
              Navigator.pop(ctx);
              AppToast.info(context, 'شماره تماس کپی شد');
            },
          ),
        ],
        child: Container(
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
                        style: AppTypography.h3Strong.copyWith(letterSpacing: 1),
                      ),
                    ],
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
          caravanId: caravan.id,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppRepository>(context);

    if (_isLoading) {
      return const AppScaffold(
        showBackButton: true,
        showNotificationIcon: true,
        showDrawerButton: true,
        showBottomNavBar: true,
        currentBottomNavIndex: AppTabs.profile,
        body: Center(child: CircularProgressIndicator(color: Color(0xFFCD8449))),
      );
    }

    final selectedCaravan = _caravans.firstWhere(
      (c) => c.id == appState.selectedCaravanId || c.name == appState.selectedCaravanName,
      orElse: () => _caravans.isNotEmpty
          ? _caravans.first
          : CaravanModel(id: 'c1', name: appState.selectedCaravanName, mentorName: appState.currentUser.name, memberCount: 0, members: []),
    );

    final membersList = selectedCaravan.members;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: AppTabs.profile,
      body: RefreshIndicator(
        onRefresh: () async {
          await appState.fetchCaravans();
          await _loadCaravansAndMembers();
        },
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

                // 1. Caravan Selector Card (Exact same as MentorHomeScreen)
                _buildCaravanSelectorCard(appState),

                const SizedBox(height: 16),

                // 2. Add User Request Button (Outlined pill button matching reference)
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton(
                    onPressed: _showAddMemberDialog,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF8B88E8), width: 1.1),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      minimumSize: const Size(0, 32),
                      tapTargetSize: MaterialTapTargetSize.padded,
                    ),
                    child: Text(
                      'درخواست اضافه کردن کاربر',
                      style: AppTypography.caption.copyWith(color: Color(0xFFE2E0F2)),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // 3. Members List (Styled as Class Box Container)
                if (membersList.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    alignment: Alignment.center,
                    child: Text(
                      'عضوی در این کاروان یافت نشد',
                      style: AppTypography.bodyLarge.copyWith(color: Colors.white54),
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
                      return _buildMemberCard(member, selectedCaravan);
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

  /// Active Caravan Selector Card matching HomeScreen
  Widget _buildCaravanSelectorCard(AppRepository appState) {
    final String activeCaravanName = appState.selectedCaravanName;

    return Material(
      color: Colors.transparent,
      child: TapExpander(child: InkWell(
        onTap: () => _showCaravanSelectionBottomSheet(context, appState),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14.8),
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
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFC7844E).withValues(alpha: 0.4),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.groups_rounded,
                      color: Color(0xFF2C1605),
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'انتخاب کاروان',
                        style: AppTypography.h3,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'کاروان فعال: $activeCaravanName',
                        style: AppTypography.caption.copyWith(color: Color(0xFFDFB690)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF28274A),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.buttonCamel, width: 1.0),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'تغییر',
                        style: AppTypography.caption.copyWith(color: Color(0xFFDEB58A)),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: Color(0xFFDEB58A),
                        size: 16,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      )),
    );
  }

  void _showCaravanSelectionBottomSheet(BuildContext context, AppRepository appState) {
    showNopaSheet(
      context,
      builder: (ctx) {
        final caravans = appState.caravans;
        final selectedId = appState.selectedCaravanId;

        return Directionality(
          textDirection: TextDirection.rtl,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'انتخاب کاروان تحت مدیریت',
                  style: AppTypography.h2,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  'لطفاً کاروانی که می‌خواهید اطلاعات و اعضای آن مدیریت شود را انتخاب کنید:',
                  style: AppTypography.bodyMedium.copyWith(color: Color(0xFFDDD9EE)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                ...caravans.map((c) {
                  final isSelected = c.id == selectedId || c.name == appState.selectedCaravanName;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: TapExpander(child: InkWell(
                      onTap: () {
                        appState.setSelectedCaravan(c.id, c.name);
                        Navigator.pop(ctx);
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF383568) : const Color(0xFF28274A),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF454270),
                            width: isSelected ? 1.4 : 1.0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF3F3D6B),
                              ),
                              child: Icon(
                                Icons.flag_rounded,
                                color: isSelected ? const Color(0xFF2C1605) : Colors.white70,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    c.name,
                                    style: AppTypography.h3Strong.copyWith(color: isSelected ? Colors.white : const Color(0xFFDDD9EE)),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${c.memberCount} عضو • ${c.activeStation}',
                                    style: AppTypography.caption.copyWith(color: Color(0xFF9D99B8)),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(
                                Icons.check_circle_rounded,
                                color: Color(0xFF22C55E),
                                size: 22,
                              ),
                          ],
                        ),
                      ),
                    )),
                  );
                }),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Member Card styled like Class Box Container
  Widget _buildMemberCard(CaravanMemberModel member, CaravanModel caravan) {
    return Material(
      color: Colors.transparent,
      child: TapExpander(child: InkWell(
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
                      style: AppTypography.h3,
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
                        tapTargetSize: MaterialTapTargetSize.padded,
                      ),
                      child: Text(
                        'درخواست حذف',
                        style: AppTypography.caption.copyWith(color: Color(0xFFE2E0F2)),
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
                        tapTargetSize: MaterialTapTargetSize.padded,
                      ),
                      child: Text(
                        'تماس',
                        style: AppTypography.caption.copyWith(color: Color(0xFFE2E0F2)),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // Chevron indicator
                    const Icon(
                      Icons.expand_less_rounded,
                      color: AppColors.buttonCancelPurple,
                      size: 20,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      )),
    );
  }
}

// -----------------------------------------------------------------------------
// STUDENT REPORT CARD & EVALUATION SCREEN (صفحه کارنامه و ارزیابی فرد)
// -----------------------------------------------------------------------------
class StudentReportCardAndEvaluationScreen extends StatefulWidget {
  final CaravanMemberModel member;
  final String caravanName;
  final String? caravanId;

  const StudentReportCardAndEvaluationScreen({
    super.key,
    required this.member,
    required this.caravanName,
    this.caravanId,
  });

  @override
  State<StudentReportCardAndEvaluationScreen> createState() => _StudentReportCardAndEvaluationScreenState();
}

class _StudentReportCardAndEvaluationScreenState extends State<StudentReportCardAndEvaluationScreen> {
  List<Map<String, dynamic>> _stations = [];
  Map<String, dynamic>? _memberData;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadProgress();
  }

  /// The member's real progress (watched parts with dates, quiz results, challenges) from the server.
  Future<void> _loadProgress() async {
    try {
      final data = await HttpApiService().getMentorCaravanProgress(caravanId: widget.caravanId);
      if (data != null && mounted) {
        final members = List<Map<String, dynamic>>.from(data['members'] ?? []);
        setState(() {
          _stations = List<Map<String, dynamic>>.from(data['stations'] ?? []);
          _memberData = members.where((m) => m['id']?.toString() == widget.member.id).firstOrNull;
          _loaded = true;
        });
        StationNumbering.update(_stations);
        return;
      }
    } catch (_) {}
    if (mounted) setState(() => _loaded = true);
  }

  int get _levelFrame {
    final v = (_memberData?['levelFrame'] as num?)?.toInt() ?? widget.member.levelFrame;
    return v < 1 ? 1 : v;
  }

  int get _completedCount => (_memberData?['completedStationsCount'] as num?)?.toInt() ?? 0;

  Map get _clipStatus => (_memberData?['clipStatus'] as Map?) ?? const {};

  /// All sessions of a station (every class category, in admin-panel order) with their parts.
  List<Map> _sessionsOf(Map<String, dynamic>? station) {
    if (station == null) return [];
    final cats = station['classCategories'];
    if (cats is List) {
      return [
        for (final c in cats.whereType<Map>()) ...((c['sessions'] as List?) ?? []).whereType<Map>(),
      ];
    }
    return [
      ...((station['skillSessions'] as List?) ?? []).whereType<Map>(),
      ...((station['mediaSessions'] as List?) ?? []).whereType<Map>(),
    ];
  }

  /// Station the overall-status numbers are about: null = the member's current station, -1 = all stations.
  int? _scopeChoice;

  int get _currentStationIndex => _stations.isEmpty ? -1 : (_levelFrame - 1).clamp(0, _stations.length - 1);

  int get _scopeIndex {
    final i = _scopeChoice ?? _currentStationIndex;
    return i >= _stations.length ? -1 : i;
  }

  List<Map<String, dynamic>> get _scopeStations => _scopeIndex < 0 ? _stations : [_stations[_scopeIndex]];

  int get _totalVideos {
    int n = 0;
    for (final st in _scopeStations) {
      for (final sess in _sessionsOf(st)) {
        n += ((sess['clips'] as List?) ?? []).length;
      }
    }
    return n;
  }

  int get _watchedVideos {
    int n = 0;
    for (final st in _scopeStations) {
      for (final sess in _sessionsOf(st)) {
        for (final c in ((sess['clips'] as List?) ?? []).whereType<Map>()) {
          final status = _clipStatus[c['id']];
          if (status is Map && status['isWatched'] == true) n++;
        }
      }
    }
    return n;
  }

  int get _totalQuizzes => _scopeStations.fold(0, (sum, st) => sum + ((st['quizzes'] as List?) ?? []).length);

  int get _takenQuizzes {
    final results = (_memberData?['quizResults'] as Map?) ?? const {};
    int n = 0;
    for (final st in _scopeStations) {
      for (final q in ((st['quizzes'] as List?) ?? []).whereType<Map>()) {
        if (results.containsKey(q['id'])) n++;
      }
    }
    return n;
  }

  /// "x از y" challenges of the selected station (or of all of them).
  String get _scopedChallengesText {
    final m = _memberData;
    if (m == null) return '—';
    if (_scopeIndex < 0) {
      return _ofText((m['challengesParticipated'] as num?)?.toInt() ?? 0, (m['challengesTotal'] as num?)?.toInt() ?? 0);
    }
    final byStation = m['challengesByStation'];
    if (byStation is! Map) return '—';
    final row = byStation[_stations[_scopeIndex]['id']?.toString()];
    return _ofText((row is Map ? (row['participated'] as num?)?.toInt() : null) ?? 0,
        (row is Map ? (row['total'] as num?)?.toInt() : null) ?? 0);
  }

  String _ofText(int part, int total) => '${part.toPersian()} از ${total.toPersian()}';

  @override
  Widget build(BuildContext context) {
    final member = widget.member;
    final int levelFrame = _levelFrame;
    final int stationCount = _stations.isNotEmpty ? _stations.length : StationNumbering.count;
    final bool hasData = _loaded && _memberData != null;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: true,
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: AppTabs.profile,
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
                currentStationIndex: (levelFrame - 1).clamp(0, stationCount - 1),
                totalNodes: stationCount,
                userLevelFrame: levelFrame,
                completedStationsCount: _completedCount,
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
                            style: AppTypography.h2,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'عضو ${widget.caravanName}',
                            style: AppTypography.captionMuted,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'شماره تماس: ${member.phoneNumber}',
                            style: AppTypography.caption.copyWith(color: AppColors.buttonCancelPurple),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 3. Overall Progress Card (باکس وضعیت کلی) with a station picker for the numbers below it
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'وضعیت کلی مسافر در کاروان',
                            style: AppTypography.h3.copyWith(color: Color(0xFFFFD580)),
                          ),
                        ),
                        if (_loaded && _stations.isNotEmpty) _buildScopeSelector(),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildStatBox('منزلگاه کنونی', StationNumbering.numberAt(levelFrame).toPersian()),
                        _buildStatBox('ویدیوها', hasData ? _ofText(_watchedVideos, _totalVideos) : '—'),
                        _buildStatBox('آزمون‌ها', hasData ? _ofText(_takenQuizzes, _totalQuizzes) : '—'),
                        _buildStatBox('چالش‌ها', hasData ? _scopedChallengesText : '—'),
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
                    Text(
                      'دارایی‌ها و پاداش‌ها',
                      style: AppTypography.h3.copyWith(color: Color(0xFFFFD580)),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildAssetBox(AssetNames.labelFor('زریک'), member.zarikBalance.toPersian(), const Color(0xFFE5A66B)),
                        _buildAssetBox(AssetNames.labelFor('درفش'), member.beyragh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox(AssetNames.labelFor('کلاف'), member.nakh.toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox(AssetNames.labelFor('قالیچه'), member.farsh.toPersian(), const Color(0xFF9292E2)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 5. Participation in challenges (مشارکت در چالش‌ها)
              _buildExchangeCard(child: _buildParticipationCard(hasData)),

              const SizedBox(height: 18),

              // 6. Time in the app (زمان حضور در اپلیکیشن)
              _buildExchangeCard(child: _buildUsageCard(hasData)),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  /// Small pill that picks the station the overall-status numbers are about ("همه" = every station).
  Widget _buildScopeSelector() {
    final idx = _scopeIndex;
    final label = idx < 0 ? 'همه' : 'منزلگاه ${StationNumbering.numberAt(idx + 1).toPersian()}';
    return PopupMenuButton<int>(
      tooltip: 'انتخاب منزلگاه',
      color: const Color(0xFF2A2835),
      position: PopupMenuPosition.under,
      onSelected: (v) => setState(() => _scopeChoice = v),
      itemBuilder: (_) => [
        PopupMenuItem(value: -1, height: 36, child: Text('همه منزلگاه‌ها', style: AppTypography.bodyMedium.copyWith(color: idx < 0 ? AppColors.accentGoldEnd : Colors.white))),
        for (int i = 0; i < _stations.length; i++)
          PopupMenuItem(
            value: i,
            height: 36,
            child: Text('منزلگاه ${StationNumbering.numberAt(i + 1).toPersian()}',
                style: AppTypography.bodyMedium.copyWith(color: i == idx ? AppColors.accentGoldEnd : Colors.white)),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2835),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.buttonCamel.withValues(alpha: 0.85), width: 1.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: AppTypography.captionGold),
            const SizedBox(width: 2),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFFF4DCC5)),
          ],
        ),
      ),
    );
  }

  /// Percentage of the visible challenges the member took part in, as a ring plus a bar per station.
  Widget _buildParticipationCard(bool hasData) {
    final total = (_memberData?['challengesTotal'] as num?)?.toInt() ?? 0;
    final done = (_memberData?['challengesParticipated'] as num?)?.toInt() ?? 0;
    final fraction = total == 0 ? 0.0 : (done / total).clamp(0.0, 1.0);
    final byStation = _memberData?['challengesByStation'];
    final rows = <Widget>[];
    if (byStation is Map) {
      for (int i = 0; i < _stations.length; i++) {
        final row = byStation[_stations[i]['id']?.toString()];
        if (row is! Map) continue;
        final t = (row['total'] as num?)?.toInt() ?? 0;
        final d = (row['participated'] as num?)?.toInt() ?? 0;
        if (t == 0) continue;
        rows.add(Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            children: [
              SizedBox(width: 62, child: Text('منزلگاه ${StationNumbering.numberAt(i + 1).toPersian()}', style: AppTypography.caption.copyWith(color: Color(0xFFDDD9EE)))),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (d / t).clamp(0.0, 1.0),
                    minHeight: 6,
                    backgroundColor: const Color(0xFF2E2D4A),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF9292E2)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 48, child: Text(_ofText(d, t), textAlign: TextAlign.left, style: AppTypography.caption.copyWith(color: Color(0xFF9D99B8)))),
            ],
          ),
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('مشارکت در چالش‌ها', style: AppTypography.h3.copyWith(color: Color(0xFFFFD580))),
        const SizedBox(height: 14),
        if (!_loaded)
          const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Color(0xFFDFB690))))
        else if (!hasData)
          Text('اطلاعاتی دریافت نشد', style: AppTypography.captionMuted)
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 84,
                height: 84,
                child: CustomPaint(
                  painter: _DonutPainter(fraction: fraction, color: const Color(0xFFE5A66B), track: const Color(0xFF2E2D4A)),
                  child: Center(child: Text('${(fraction * 100).round().toPersian()}٪', style: AppTypography.h3)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      total == 0 ? 'چالشی برای این مسافر ثبت نشده است' : 'در ${done.toPersian()} چالش از ${total.toPersian()} چالش شرکت کرده است',
                      style: AppTypography.bodyMedium,
                    ),
                    ...rows,
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }

  static const int _usageDaysShown = 14;

  /// Time in the app over the last two weeks, one bar per day.
  Widget _buildUsageCard(bool hasData) {
    final usage = (_memberData?['usageDays'] as Map?) ?? const {};
    // Days are counted in Tehran time, like on the server
    final tehranNow = DateTime.now().toUtc().add(const Duration(hours: 3, minutes: 30));
    final days = <DateTime>[for (int i = _usageDaysShown - 1; i >= 0; i--) tehranNow.subtract(Duration(days: i))];
    String key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final seconds = [for (final d in days) ((usage[key(d)] as num?)?.toInt() ?? 0)];
    final total = seconds.fold<int>(0, (a, b) => a + b);
    final activeDays = seconds.where((v) => v > 0).length;
    String fmt(int sec) {
      final m = (sec / 60).round();
      if (m < 60) return '${m.toPersian()} دقیقه';
      final h = m ~/ 60;
      final r = m % 60;
      return r == 0 ? '${h.toPersian()} ساعت' : '${h.toPersian()} ساعت و ${r.toPersian()} دقیقه';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('زمان حضور در اپلیکیشن', style: AppTypography.h3.copyWith(color: Color(0xFFFFD580))),
        const SizedBox(height: 4),
        Text('${_usageDaysShown.toPersian()} روز اخیر', style: AppTypography.captionMuted),
        const SizedBox(height: 14),
        if (!_loaded)
          const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Color(0xFFDFB690))))
        else if (!hasData)
          Text('اطلاعاتی دریافت نشد', style: AppTypography.captionMuted)
        else ...[
          SizedBox(
            height: 90,
            width: double.infinity,
            child: CustomPaint(
              painter: _BarsPainter(values: seconds.map((v) => v / 60.0).toList(), color: const Color(0xFF9292E2), track: const Color(0xFF2E2D4A)),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              for (final d in days)
                Expanded(
                  child: Center(
                    child: Text(Jalali.fromDateTime(d).day.toPersian(), style: AppTypography.caption.copyWith(fontSize: 9, color: Color(0xFF9D99B8))),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStatBox('مجموع', total == 0 ? '—' : fmt(total)),
              _buildStatBox('روزهای فعال', activeDays.toPersian()),
              _buildStatBox('میانگین هر روز فعال', activeDays == 0 ? '—' : fmt((total / activeDays).round())),
            ],
          ),
          if (total == 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('هنوز زمانی ثبت نشده است. زمان حضور از نسخهٔ جدید اپ به بعد ثبت می‌شود.', style: AppTypography.captionMuted),
            ),
        ],
      ],
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
    return Expanded(
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(value, style: AppTypography.h2),
          ),
          const SizedBox(height: 4),
          Text(label, style: AppTypography.captionMuted),
        ],
      ),
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
          Text(value, style: AppTypography.h3.copyWith(color: color)),
          const SizedBox(height: 2),
          Text(label, style: AppTypography.caption.copyWith(color: Colors.white70)),
        ],
      ),
    );
  }
}


typedef MentorMembersScreen = MentorCaravansRosterScreen;

/// Ring showing [fraction] (0..1) of a whole.
class _DonutPainter extends CustomPainter {
  final double fraction;
  final Color color;
  final Color track;
  _DonutPainter({required this.fraction, required this.color, required this.track});

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 10.0;
    final rect = Rect.fromLTWH(stroke / 2, stroke / 2, size.width - stroke, size.height - stroke);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 6.283185307179586, false, base..color = track);
    if (fraction > 0) {
      canvas.drawArc(rect, -1.5707963267948966, 6.283185307179586 * fraction, false, base..color = color);
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.fraction != fraction || old.color != color || old.track != track;
}

/// One bar per value, the oldest on the right (the screen reads right to left); empty days show a short track.
class _BarsPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  final Color track;
  _BarsPainter({required this.values, required this.color, required this.track});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final maxV = values.fold<double>(0, (a, b) => b > a ? b : a);
    final slot = size.width / values.length;
    final barW = slot * 0.56;
    for (int i = 0; i < values.length; i++) {
      final x = size.width - (i + 1) * slot + (slot - barW) / 2;
      final v = values[i];
      final h = v <= 0 || maxV <= 0 ? 3.0 : (v / maxV * (size.height - 4)).clamp(4.0, size.height);
      final rrect = RRect.fromRectAndRadius(Rect.fromLTWH(x, size.height - h, barW, h), const Radius.circular(3));
      canvas.drawRRect(rrect, Paint()..color = v > 0 ? color : track);
    }
  }

  @override
  bool shouldRepaint(_BarsPainter old) => old.values != values || old.color != color;
}
