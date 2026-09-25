import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/core/constants/api_constants.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/models/station.dart';
import 'package:nopa_app/widgets/education_calendar.dart';
import 'package:nopa_app/screens/shell/app_shell.dart';
import 'package:nopa_app/main.dart';

class MentorHomeScreen extends StatefulWidget {
  const MentorHomeScreen({super.key});

  @override
  State<MentorHomeScreen> createState() => _MentorHomeScreenState();
}

class _MentorHomeScreenState extends State<MentorHomeScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _stations = [];
  List<Map<String, dynamic>> _banners = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        HttpApiService().getStations(),
        HttpApiService().getBanners(position: 'home_top'),
      ]);
      if (mounted) {
        setState(() {
          _stations = List<Map<String, dynamic>>.from(results[0] as List);
          _banners = List<Map<String, dynamic>>.from(results[1] as List);
          _isLoading = false;
        });
        Provider.of<AppRepository>(context, listen: false).refreshChallenges();
        Provider.of<AppRepository>(context, listen: false).refreshUser();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'خطا در دریافت اطلاعات';
          _isLoading = false;
        });
      }
    }
  }

  /// Compact Banner Slider Carousel: Height (120px) matching Challenges screen banner size
  Widget _buildBannerSection() {
    return _MentorBannerCarousel(banners: _banners);
  }

  final Set<String> _expandedInfoTitles = {};

  /// 4-Column Summary Strip (راهبر, کاروان, اعضا, منزلگاه کنونی)
  Widget _buildUserInfoStrip(UserModel? user, AppRepository appState) {
    final String currentStationTitle = '۱. ${Station.resolveTitle(_stations.isNotEmpty ? _stations[0]['title']?.toString() : null, 0)}';
    final String caravanName = (user?.caravanName != null && user!.caravanName!.isNotEmpty)
        ? user.caravanName!
        : appState.selectedCaravanName;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18.0),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: _buildInfoColumn(
                  title: 'راهبر',
                  value: user?.name.isNotEmpty == true ? user!.name : 'رضا جلالی',
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'کاروان',
                  value: caravanName,
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'تعداد اعضا',
                  value: '۲۴ نفر',
                ),
              ),
              Container(height: 24, width: 1, color: const Color(0xFF3E3B5C)),
              const SizedBox(width: 6),
              Expanded(
                child: _buildInfoColumn(
                  title: 'منزلگاه کنونی',
                  value: currentStationTitle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoColumn({required String title, required String value}) {
    final bool isExpanded = _expandedInfoTitles.contains(title);

    return GestureDetector(
      onTap: () {
        setState(() {
          if (isExpanded) {
            _expandedInfoTitles.remove(title);
          } else {
            _expandedInfoTitles.add(title);
          }
        });
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 12.5,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            textAlign: TextAlign.right,
            maxLines: isExpanded ? 3 : 1,
            overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFFB5B3C8),
              fontSize: 10.5,
              height: 1.25,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ],
      ),
    );
  }

  /// Caravan Selector Action Card styled like "ورود به صفحه کلاس ها"
  Widget _buildCaravanSelectorCard(AppRepository appState) {
    final activeCaravanName = appState.selectedCaravanName;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18.0),
      child: GestureDetector(
        onTap: () => _showCaravanSelectionBottomSheet(context, appState),
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
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          padding: const EdgeInsets.all(1.2),
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
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'کاروان فعال: $activeCaravanName',
                          style: const TextStyle(
                            color: Color(0xFFDFB690),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF28274A),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFC09268), width: 1.0),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'تغییر',
                          style: TextStyle(
                            color: Color(0xFFDEB58A),
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
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
        ),
      ),
    );
  }

  void _showCaravanSelectionBottomSheet(BuildContext context, AppRepository appState) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1D34),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
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
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                const Text(
                  'لطفاً کاروانی که می‌خواهید اطلاعات و اعضای آن مدیریت شود را انتخاب کنید:',
                  style: TextStyle(
                    color: Color(0xFFDDD9EE),
                    fontSize: 12,
                    fontFamily: AppTheme.fontFamily,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                ...caravans.map((c) {
                  final isSelected = c.id == selectedId || c.name == appState.selectedCaravanName;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
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
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : const Color(0xFFDDD9EE),
                                      fontSize: 13.5,
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${c.memberCount} عضو • ${c.activeStation}',
                                    style: const TextStyle(
                                      color: Color(0xFF9D99B8),
                                      fontSize: 11,
                                      fontFamily: AppTheme.fontFamily,
                                    ),
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
                    ),
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

  int _selectedAssetIndex = 0;

  /// Assets Strip: Horizontal scrollable pills with badge numbers (1, 2, 3, 4)
  Widget _buildAssetsSection(UserModel? user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'سرمایه های کاروان',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 44,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                _buildAssetPill(
                  badgeNumber: '۱',
                  label: 'زریک',
                  value: (user?.zarik ?? 3500).toPersian(),
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۲',
                  label: 'بیرق',
                  value: (user?.beyragh ?? 8).toPersian(),
                  isGold: _selectedAssetIndex == 1,
                  onTap: () => setState(() => _selectedAssetIndex = 1),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۳',
                  label: 'نخ',
                  value: (user?.nakh ?? 45).toPersian(),
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  badgeNumber: '۴',
                  label: 'فرش',
                  value: (user?.farsh ?? 3).toPersian(),
                  isGold: _selectedAssetIndex == 3,
                  onTap: () => setState(() => _selectedAssetIndex = 3),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAssetPill({
    required String badgeNumber,
    required String label,
    required String value,
    required bool isGold,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 130),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: isGold
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20.8),
            gradient: isGold
                ? const LinearGradient(
                    colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: isGold ? null : const Color(0xFF28274A),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Right: Circular Badge
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: isGold ? const Color(0xFF653A18) : const Color(0xFF8B88E8),
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
                const SizedBox(width: 8),
                // Middle: Label
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 16),
                // Left: Value
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Section: Quick Access ("دسترسی سریع") with 5 Action Cards matching StationCard design
  Widget _buildQuickAccessSection() {
    final List<Map<String, dynamic>> quickAccessItems = [
      {
        'title': 'همه کلاس ها',
        'subtitle': 'کلاس‌های مهارتی و رسانه‌ای',
        'badge': 'سرفصل‌ها',
        'image': 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400',
        'onTap': () => Navigator.pushNamed(context, '/class2'),
      },
      {
        'title': 'مدیریت منزلگاه',
        'subtitle': 'گزارش آموزشی و پیشرفت',
        'badge': 'منزلگاه‌ها',
        'image': 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=400',
        'onTap': () => navigateToMainTab(1),
      },
      {
        'title': 'چالش ها',
        'subtitle': 'ماموریت‌ها و تصحیح پاسخ‌ها',
        'badge': 'چالش‌ها',
        'image': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400',
        'onTap': () => navigateToMainTab(2),
      },
      {
        'title': 'پیام ها',
        'subtitle': 'ارسال و دریافت اطلاعیه‌ها',
        'badge': 'پیام‌ها',
        'image': 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=400',
        'onTap': () => Navigator.pushNamed(context, '/notifications'),
      },
      {
        'title': 'مبادلات',
        'subtitle': 'مدیریت سرمایه‌ها و مبادلات',
        'badge': 'بازارچه',
        'image': 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400',
        'onTap': () => navigateToMainTab(3),
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'دسترسی سریع',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 230,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: quickAccessItems.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = quickAccessItems[index];

                return _buildQuickAccessCard(
                  title: item['title'] as String,
                  subtitle: item['subtitle'] as String,
                  badge: item['badge'] as String,
                  imageUrl: item['image'] as String,
                  onTap: item['onTap'] as VoidCallback,
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickAccessCard({
    required String title,
    required String subtitle,
    required String badge,
    required String imageUrl,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 164,
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
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Badge & Icon top row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1D34),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF5C578F), width: 0.9),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: Color(0xFFDDD9EE),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF28274A),
                    ),
                    child: const Icon(
                      Icons.arrow_forward_rounded,
                      color: Color(0xFFDEB58A),
                      size: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Thumbnail with smooth rounded corners
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 78,
                  width: double.infinity,
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      color: const Color(0xFF231C38),
                      child: const Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 1.8,
                          color: Color(0xFFCD8449),
                        ),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      color: const Color(0xFF231C38),
                      child: const Icon(Icons.dashboard_customize_rounded, color: Colors.white38),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Title
              Text(
                title,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13.5,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
              const SizedBox(height: 2),

              // Subtitle
              Text(
                subtitle,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF9D99B8),
                  fontSize: 10,
                  fontFamily: AppTheme.fontFamily,
                ),
              ),
              const Spacer(),

              // Action button at bottom
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 5),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFE5A66B), Color(0xFFC7844E)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text(
                    'مشاهده و ورود',
                    style: TextStyle(
                      color: Color(0xFF2C1605),
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppRepository>(context);
    final user = appState.currentUser;

    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFCD8449)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text(_errorMessage!, style: const TextStyle(fontSize: 16, color: Colors.white, fontFamily: AppTheme.fontFamily)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchData,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFCD8449),
                foregroundColor: Colors.white,
              ),
              child: const Text('تلاش مجدد', style: TextStyle(fontFamily: AppTheme.fontFamily)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchData,
      color: const Color(0xFFCD8449),
      backgroundColor: const Color(0xFF231C38),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 4, bottom: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Compact Banner Slider Carousel with Dots (Height: 120px)
            _buildBannerSection(),

            const SizedBox(height: 16),

            // 2. User & Caravan Information Strip
            _buildUserInfoStrip(user, appState),

            const SizedBox(height: 16),

            // 3. Caravan Selection Card (above caravan assets)
            _buildCaravanSelectorCard(appState),

            const SizedBox(height: 18),

            // 4. Assets Section (سرمایه‌های کاروان)
            _buildAssetsSection(user),

            const SizedBox(height: 22),

            // 5. Quick Access Section (دسترسی سریع - جایگزین منزلگاه‌ها)
            _buildQuickAccessSection(),

            const SizedBox(height: 24),

            // 6. Jalali Education Calendar
            const EducationCalendar(),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}

/// Compact Banner Carousel for Mentor with smaller height (~120px)
class _MentorBannerCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> banners;

  const _MentorBannerCarousel({required this.banners});

  @override
  State<_MentorBannerCarousel> createState() => _MentorBannerCarouselState();
}

class _MentorBannerCarouselState extends State<_MentorBannerCarousel> {
  late final PageController _bannerPageCtrl;
  int _currentBannerIndex = 0;
  Timer? _bannerAutoScrollTimer;

  @override
  void initState() {
    super.initState();
    _bannerPageCtrl = PageController(viewportFraction: 0.88);
    _startBannerAutoScroll();
  }

  void _startBannerAutoScroll() {
    _bannerAutoScrollTimer?.cancel();
    _bannerAutoScrollTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted || !_bannerPageCtrl.hasClients) return;
      final int totalPages = widget.banners.isNotEmpty ? widget.banners.length : 3;
      final int nextIndex = (_currentBannerIndex + 1) % totalPages;
      _bannerPageCtrl.animateToPage(
        nextIndex,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _bannerAutoScrollTimer?.cancel();
    _bannerPageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> bannerList = widget.banners.isNotEmpty
        ? widget.banners
        : const [
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
            {
              'assetImage': 'assets/images/banners/banner1.jpg',
            },
          ];

    return RepaintBoundary(
      child: Column(
        children: [
          SizedBox(
            height: 120, // Smaller height matching Challenges screen banner proportion
            child: PageView.builder(
              controller: _bannerPageCtrl,
              itemCount: bannerList.length,
              onPageChanged: (index) {
                setState(() => _currentBannerIndex = index);
              },
              itemBuilder: (context, index) {
                final item = bannerList[index];
                final String? imageUrl = item['imageUrl'] != null && item['imageUrl'].toString().trim().isNotEmpty
                    ? ApiConstants.resolveImageUrl(item['imageUrl'].toString())
                    : null;
                final String assetPath = item['assetImage']?.toString() ?? 'assets/images/banners/banner1.jpg';

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: imageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                            memCacheWidth: 600,
                            memCacheHeight: 300,
                            placeholder: (context, url) => Container(
                              color: const Color(0xFF231C38),
                              child: const Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFCD8449),
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) => Image.asset(
                              assetPath,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                            ),
                          )
                        : Image.asset(
                            assetPath,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                            errorBuilder: (context, error, stackTrace) => Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Color(0xFF6B3A1E), Color(0xFF381F14)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                              ),
                            ),
                          ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                bannerList.length,
                (index) {
                  final bool isActive = _currentBannerIndex == index;

                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: isActive ? 16 : 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: isActive
                          ? const Color(0xFFCD8449)
                          : Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

typedef MentorDashboardScreen = MentorHomeScreen;
