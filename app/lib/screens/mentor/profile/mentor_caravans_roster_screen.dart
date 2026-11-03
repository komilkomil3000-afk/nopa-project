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
                        style: AppTypography.h3.copyWith(letterSpacing: 1),
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
                                    style: AppTypography.h3.copyWith(color: isSelected ? Colors.white : const Color(0xFFDDD9EE)),
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

  final Set<int> _expandedStationIndices = {0};

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

  bool _isClipWatched(dynamic clipId) {
    final st = _clipStatus[clipId];
    return st is Map && (st['isWatched'] == true || st['quizPassed'] == true);
  }

  int get _totalVideos {
    int n = 0;
    for (final st in _stations) {
      for (final sess in _sessionsOf(st)) {
        n += ((sess['clips'] as List?) ?? []).length;
      }
    }
    return n;
  }

  int get _watchedVideos {
    int n = 0;
    for (final st in _stations) {
      for (final sess in _sessionsOf(st)) {
        for (final c in ((sess['clips'] as List?) ?? []).whereType<Map>()) {
          final status = _clipStatus[c['id']];
          if (status is Map && status['isWatched'] == true) n++;
        }
      }
    }
    return n;
  }

  int get _totalQuizzes => _stations.fold(0, (sum, st) => sum + ((st['quizzes'] as List?) ?? []).length);

  int get _takenQuizzes {
    final results = (_memberData?['quizResults'] as Map?) ?? const {};
    int n = 0;
    for (final st in _stations) {
      for (final q in ((st['quizzes'] as List?) ?? []).whereType<Map>()) {
        if (results.containsKey(q['id'])) n++;
      }
    }
    return n;
  }

  String _ofText(int part, int total) => '${part.toPersian()} از ${total.toPersian()}';

  /// Sessions of a station as shown in the accordion, from the member's real watch records.
  List<Map<String, dynamic>> _getStationSessions(Map<String, dynamic>? stationData) {
    return _sessionsOf(stationData).map((sess) {
      final clips = ((sess['clips'] as List?) ?? []).whereType<Map>().toList();
      final watched = clips.where((c) => _isClipWatched(c['id'])).length;
      return <String, dynamic>{
        'title': sess['title'],
        'watched': watched,
        'total': clips.length,
        'done': clips.isNotEmpty && watched >= clips.length,
      };
    }).toList();
  }

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

              // 3. Overall Progress Card (باکس وضعیت کلی با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'وضعیت کلی مسافر در کاروان',
                      style: AppTypography.h3.copyWith(color: Color(0xFFFFD580)),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildStatBox('منزلگاه کنونی', StationNumbering.numberAt(levelFrame).toPersian()),
                        _buildStatBox('ویدیوها', hasData ? _ofText(_watchedVideos, _totalVideos) : '—'),
                        _buildStatBox('آزمون‌ها', hasData ? _ofText(_takenQuizzes, _totalQuizzes) : '—'),
                        _buildStatBox(
                          'چالش‌ها',
                          hasData
                              ? _ofText((_memberData!['challengesParticipated'] as num?)?.toInt() ?? 0,
                                  (_memberData!['challengesTotal'] as num?)?.toInt() ?? 0)
                              : '—',
                        ),
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

              // 5. Station Road Map Summary & Sessions Accordion (پیشرفت در منزلگاه‌ها با استایل مبادله)
              _buildExchangeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'پیشرفت در منزلگاه‌ها',
                      style: AppTypography.h3,
                    ),
                    const SizedBox(height: 14),
                    if (!_loaded)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(color: Color(0xFFDFB690)),
                        ),
                      )
                    else
                      for (int i = 0; i < _stations.length; i++) ...[
                        _buildStationAccordionItem(
                          index: i,
                          stationData: _stations[i],
                          userLevelFrame: levelFrame,
                        ),
                        if (i < _stations.length - 1) const SizedBox(height: 10),
                      ],
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
    // Same rules as the member's own station list
    final int completed = _completedCount;
    final bool isLocked = index > 0 && (index + 1) > userLevelFrame && index > completed;
    final bool isCurrentStation = (index + 1) == userLevelFrame || (index == 0 && userLevelFrame <= 1);
    final bool isCompletedStation = (index + 1) < userLevelFrame || index < completed;
    final bool isExpanded = _expandedStationIndices.contains(index);

    final String stationTitle = stationData != null && stationData['title'] != null
        ? stationData['title'].toString()
        : 'منزلگاه ${StationNumbering.numberAt(index + 1)}';

    final sessions = _getStationSessions(stationData);

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
            TapExpander(child: InkWell(
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
                        'منزلگاه ${StationNumbering.numberAt(index + 1).toPersian()}: $stationTitle',
                        style: AppTypography.h3.copyWith(color: isLocked ? Colors.white54 : Colors.white),
                      ),
                    ),

                    // Chevron Arrow
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: AppColors.buttonCancelPurple,
                      size: 20,
                    ),
                  ],
                ),
              ),
            )),

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
                    final bool isSessionCompleted = session['done'] == true;
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
                                  style: AppTypography.bodyMedium.copyWith(color: isSessionCompleted ? Colors.white : const Color(0xFFDDD9EE)),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  isSessionCompleted
                                      ? 'همه پارت‌ها دیده شده'
                                      : (isLocked
                                          ? 'قفل شده'
                                          : 'دیده شده: ${_ofText((session['watched'] as int?) ?? 0, (session['total'] as int?) ?? 0)}'),
                                  style: AppTypography.caption.copyWith(color: isSessionCompleted ? const Color(0xFF10B981) : const Color(0xFF8E8B9E)),
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
