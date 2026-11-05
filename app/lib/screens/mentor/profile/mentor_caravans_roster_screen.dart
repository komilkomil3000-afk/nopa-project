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
import 'package:nopa_app/widgets/report_activity_cards.dart';

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
      phoneNumber: json['phoneNumber']?.toString() ?? '',
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

      // No caravan from the server: show the empty roster (never invented members or phone numbers)
      if (mounted) {
        setState(() {
          _caravans = [];
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
            onPressed: () {
                          Navigator.pop(ctx);
                          if (!mounted) return;
                          // The member leaves the list at once; the request is sent only if not undone within the undo time
                          final at = caravan.members.indexWhere((m) => m.id == member.id);
                          setState(() => caravan.members.removeWhere((m) => m.id == member.id));
                          AppToast.undoable(
                            context,
                            'درخواست حذف «${member.name}» ثبت شد.',
                            commit: () async {
                              try {
                                await HttpApiService().removeMemberFromCaravan(caravan.id, member.id);
                              } catch (_) {}
                              return null;
                            },
                            onUndo: () {
                              if (!mounted || at < 0 || caravan.members.any((m) => m.id == member.id)) return;
                              setState(() => caravan.members.insert(at.clamp(0, caravan.members.length), member));
                            },
                          );
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

  // Name, phone, picture and balances come from the server's answer for this member; what the opening screen
  // passed is only the first thing shown until it arrives.
  String get _name => (_memberData?['name']?.toString().trim().isNotEmpty ?? false) ? _memberData!['name'].toString() : widget.member.name;
  String get _phone => ((_memberData?['phoneNumber'] ?? widget.member.phoneNumber)?.toString() ?? '').trim();
  String get _avatar => (_memberData?['avatarUrl']?.toString().isNotEmpty ?? false) ? _memberData!['avatarUrl'].toString() : widget.member.avatarUrl;
  int _asset(String key, int fallback) => (_memberData?[key] as num?)?.toInt() ?? fallback;

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
                          imageUrl: _avatar,
                          name: _name,
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
                            _name,
                            style: AppTypography.h2,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'عضو ${widget.caravanName}',
                            style: AppTypography.captionMuted,
                          ),
                          const SizedBox(height: 2),
                          if (_phone.isNotEmpty)
                            Text(
                              'شماره تماس: ${_phone.toPersian()}',
                              textDirection: TextDirection.ltr,
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
                        _buildAssetBox(AssetNames.labelFor('زریک'), _asset('zarik', member.zarikBalance).toPersian(), const Color(0xFFE5A66B)),
                        _buildAssetBox(AssetNames.labelFor('درفش'), _asset('beyragh', member.beyragh).toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox(AssetNames.labelFor('کلاف'), _asset('nakh', member.nakh).toPersian(), const Color(0xFF9292E2)),
                        _buildAssetBox(AssetNames.labelFor('قالیچه'), _asset('farsh', member.farsh).toPersian(), const Color(0xFF9292E2)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 5+6. Participation in challenges and time in the app
              ReportActivityCards(data: _memberData, loaded: _loaded, stations: _stations),

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
