import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../models/user_model.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/custom_drawer.dart';
import '../widgets/complete_profile_dialog.dart';
import '../widgets/jarchi_item.dart';
import '../main.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  // Selected filter tab: 0: همه, 1: خوانده‌نشده, 2: چالش‌ها, 3: اطلاعیه‌ها
  int _selectedFilterIndex = 0;
  final Set<String> _expandedItemIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Provider.of<AppRepository>(context, listen: false).fetchNotifications();
      }
    });
  }

  void _handleBackAction() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      navigateToMainTab(0);
    }
  }

  void _handleBottomNavTap(int idx) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
    navigateToMainTab(idx);
  }

  void _toggleExpanded(String id, Map<String, dynamic> notify, AppRepository repository) {
    setState(() {
      if (_expandedItemIds.contains(id)) {
        _expandedItemIds.remove(id);
      } else {
        _expandedItemIds.add(id);
        // Automatically mark as read when expanded
        if (notify['isRead'] != true && id.isNotEmpty) {
          repository.markNotificationAsRead(id);
        }
      }
    });
  }

  Future<void> _handleActionClick(Map<String, dynamic> notify, AppRepository repository) async {
    final String notifId = notify['id']?.toString() ?? '';
    if (notifId.isNotEmpty) {
      await repository.markNotificationAsRead(notifId);
    }

    final String title = notify['title'] ?? '';
    final String body = notify['body'] ?? '';
    final String type = notify['type'] ?? '';
    final bool isMentor = repository.currentUser.role == UserRole.mentor ||
        repository.currentUser.role == UserRole.superMentor;

    // 1. News / جارچی اطلاعیه‌ها
    if (type == 'news' ||
        title.contains('📢') ||
        title.contains('خبر') ||
        body.contains('خبر') ||
        title.contains('جارچی')) {
      try {
        final newsList = await HttpApiService().getNews();
        Map<String, dynamic>? matched;
        for (final n in newsList) {
          final nTitle = n['title']?.toString() ?? '';
          if (nTitle.isNotEmpty &&
              (title.contains(nTitle) ||
                  nTitle.contains(title.replaceAll('📢', '').trim()))) {
            matched = n;
            break;
          }
        }

        final String itemTitle = matched?['title'] ?? title;
        final String itemContent = matched?['body'] ?? body;
        final String? link = matched?['reporter'];
        String imageUrl =
            'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400';
        if (matched?['imageUrl'] != null) {
          imageUrl =
              '${HttpApiService().baseUrl.replaceAll('/api/v1', '')}${matched!['imageUrl']}';
        }
        final date = DateTime.tryParse(matched?['createdAt'] ?? '');
        final dateStr = date != null
            ? '${date.year}/${date.month}/${date.day}'.toPersianDigits()
            : (notify['time']?.toString().toPersianDigits() ?? 'الان');

        if (mounted) {
          JarchiItem.showNewsDialog(
            context,
            title: itemTitle,
            date: dateStr,
            imageUrl: imageUrl,
            content: itemContent,
            link: link,
          );
        }
      } catch (_) {
        if (mounted) {
          JarchiItem.showNewsDialog(
            context,
            title: title,
            date: notify['time']?.toString().toPersianDigits() ?? 'الان',
            imageUrl:
                'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400',
            content: body,
          );
        }
      }
      return;
    }

    // 2. Complete Profile / تکمیل پروفایل
    if (title.contains('تکمیل پروفایل') ||
        body.contains('تکمیل پروفایل') ||
        title.contains('پروفایل')) {
      if (mounted) {
        CompleteProfileDialog.show(context, repository.currentUser);
      }
      return;
    }

    // 3. Challenge / چالش و پاسخ‌ها
    if (type == 'challenge' ||
        title.contains('چالش') ||
        body.contains('چالش') ||
        title.contains('پاسخ') ||
        body.contains('پاسخ') ||
        title.contains('تایید شد') ||
        title.contains('رد شد')) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      if (isMentor) {
        navigateToMainTab(2); // Mentor Tasks
      } else {
        navigateToMainTab(2); // Student Challenges
      }
      return;
    }

    // 4. Tickets / تیکت‌ها و پشتیبانی
    if (title.contains('تیکت') ||
        body.contains('تیکت') ||
        title.contains('پشتیبانی')) {
      if (mounted) {
        Navigator.pushNamed(context, '/tickets');
      }
      return;
    }

    // 5. Market / فروشگاه / زریک / سکه
    if (title.contains('فروشگاه') ||
        body.contains('فروشگاه') ||
        title.contains('سکه') ||
        body.contains('زریک')) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      if (!isMentor) {
        navigateToMainTab(3); // Market
      }
      return;
    }

    // 6. Map / Stations / کلاس و منزلگاه
    if (title.contains('منزلگاه') ||
        title.contains('کلاس') ||
        title.contains('ایستگاه') ||
        body.contains('منزلگاه') ||
        body.contains('کلاس') ||
        title.contains('نقشه')) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      if (!isMentor) {
        navigateToMainTab(1); // Map / Stations
      }
      return;
    }

    // 7. Ratings / League / کارنامه
    if (title.contains('ارزیابی') ||
        title.contains('کارنامه') ||
        title.contains('لیگ')) {
      if (mounted) {
        Navigator.pushNamed(context, '/mentor_league');
      }
      return;
    }

    // Default feedback
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('پیام با موفقیت بررسی و خوانده شد.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFF28274A),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final user = repository.currentUser;
    final isMentor = user.role == UserRole.mentor || user.role == UserRole.superMentor;

    // Filter list based on mentor role and selected tab
    final allList = repository.notifications
        .where((n) => n['isForMentor'] == isMentor)
        .toList();

    List<Map<String, dynamic>> filteredList;
    switch (_selectedFilterIndex) {
      case 1: // خوانده‌نشده
        filteredList = allList.where((n) => n['isRead'] != true).toList();
        break;
      case 2: // چالش‌ها
        filteredList = allList.where((n) {
          final t = (n['title'] ?? '') + ' ' + (n['body'] ?? '') + ' ' + (n['type'] ?? '');
          return t.contains('چالش') || t.contains('پاسخ') || t.contains('challenge');
        }).toList();
        break;
      case 3: // اطلاعیه‌ها و خبرها
        filteredList = allList.where((n) {
          final t = (n['title'] ?? '') + ' ' + (n['body'] ?? '') + ' ' + (n['type'] ?? '');
          return t.contains('خبر') || t.contains('جارچی') || t.contains('news') || t.contains('📢');
        }).toList();
        break;
      case 0:
      default:
        filteredList = allList;
        break;
    }

    final int unreadCount = repository.unreadNotificationsCount;

    return Scaffold(
      backgroundColor: Colors.transparent,
      drawer: CustomDrawer(
        onTabSelected: (idx) {
          Navigator.pop(context);
          _handleBottomNavTap(idx);
        },
        currentIndex: -1,
        role: user.role,
      ),
      bottomNavigationBar: CustomBottomNavBar(
        currentIndex: -1,
        role: user.role,
        onTap: (idx) => _handleBottomNavTap(idx),
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: AppColors.screenBackgroundGradient,
          image: DecorationImage(
            image: AssetImage('assets/images/login_bg.png'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // 1. Top Bar identical to Class 1 screen (Without Bell Icon)
              _buildTopBar(),

              // 2. Main Notification Feed
              Expanded(
                child: RefreshIndicator(
                  color: const Color(0xFFC09268),
                  backgroundColor: const Color(0xFF1E1435),
                  onRefresh: () async {
                    await repository.fetchNotifications();
                  },
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Page Header Title & Mark-All-Read Button
                        _buildSectionHeader(repository, unreadCount),

                        const SizedBox(height: 12),

                        // Filter Pills Bar
                        _buildFilterPills(allList, unreadCount),

                        const SizedBox(height: 16),

                        // Notifications List or Empty State
                        if (filteredList.isEmpty)
                          _buildEmptyState()
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: filteredList.length,
                            itemBuilder: (context, index) {
                              final notify = filteredList[index];
                              final String id = notify['id']?.toString() ?? 'notif_$index';
                              final bool isExpanded = _expandedItemIds.contains(id);

                              return _buildNotificationCard(
                                notify: notify,
                                id: id,
                                isExpanded: isExpanded,
                                repository: repository,
                              );
                            },
                          ),

                        const SizedBox(height: 24),
                      ],
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

  /// 1. Top Bar matching Class 1 screen: Left = Gradient NOPA + Back SVG, Right = Drawer Hamburger Menu (NO Bell)
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, top: 10, bottom: 6),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: NOPA Text Logo (height 42) + Back SVG below it
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 42,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [
                          Color(0xFFC09268),
                          Color(0xFFF4DCC5),
                        ],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ).createShader(bounds),
                      child: const Text(
                        'NOPA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 21,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                // Back Button: Only the raw SVG icon without background
                GestureDetector(
                  onTap: _handleBackAction,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 4, right: 8),
                    child: SvgPicture.asset(
                      'assets/svg_icons/back01.svg',
                      width: 20,
                      height: 20,
                      colorFilter: const ColorFilter.mode(
                        Color(0xFFC7B299),
                        BlendMode.srcIn,
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // Right: Drawer Hamburger Menu Button (height 42)
            Builder(
              builder: (ctx) => Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => Scaffold.of(ctx).openDrawer(),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: Color(0xFF23223D),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.menu_rounded,
                        color: Color(0xFFC7B299),
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Section Header: Title & Mark All Read
  Widget _buildSectionHeader(AppRepository repository, int unreadCount) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'پیام‌ها و اعلان‌ها',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: AppTheme.fontFamily,
                  fontFamilyFallback: AppTheme.fontFamilyFallback,
                ),
              ),
              if (unreadCount > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${unreadCount.toPersian()} جدید',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),
              ],
            ],
          ),

          if (unreadCount > 0)
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => repository.markAllNotificationsAsRead(),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.done_all_rounded, size: 16, color: Color(0xFFC09268)),
                      SizedBox(width: 4),
                      Text(
                        'خواندن همه',
                        style: TextStyle(
                          color: Color(0xFFDEB58A),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Filter Pills Bar
  Widget _buildFilterPills(List<Map<String, dynamic>> allList, int unreadCount) {
    final filters = [
      {'title': 'همه', 'count': allList.length},
      {'title': 'خوانده‌نشده', 'count': unreadCount},
      {'title': 'چالش‌ها', 'count': allList.where((n) => (n['title'] ?? '').contains('چالش') || (n['body'] ?? '').contains('چالش')).length},
      {'title': 'اطلاعیه‌ها', 'count': allList.where((n) => (n['type'] == 'news') || (n['title'] ?? '').contains('خبر') || (n['title'] ?? '').contains('📢')).length},
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: List.generate(filters.length, (idx) {
            final isSelected = _selectedFilterIndex == idx;
            final item = filters[idx];
            final int count = item['count'] as int;

            return Padding(
              padding: const EdgeInsets.only(left: 8.0),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => setState(() => _selectedFilterIndex = idx),
                  borderRadius: BorderRadius.circular(18),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? const LinearGradient(
                              colors: [Color(0xFFC09268), Color(0xFFA57C46)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: isSelected ? null : const Color(0xFF23223D),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFFF4DCC5).withValues(alpha: 0.6)
                            : const Color(0xFF453F73).withValues(alpha: 0.4),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          item['title'] as String,
                          style: TextStyle(
                            color: isSelected ? const Color(0xFF1E1435) : const Color(0xFFD3D0E3),
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF1E1435).withValues(alpha: 0.25)
                                  : const Color(0xFF38355F),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              count.toPersian(),
                              style: TextStyle(
                                color: isSelected ? const Color(0xFF1E1435) : const Color(0xFF9D99B8),
                                fontSize: 9.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  /// Expandable Notification Card
  Widget _buildNotificationCard({
    required Map<String, dynamic> notify,
    required String id,
    required bool isExpanded,
    required AppRepository repository,
  }) {
    final String title = notify['title'] ?? 'اعلان جدید کاروان';
    final String body = notify['body'] ?? '';
    final String type = notify['type'] ?? '';
    final bool isRead = notify['isRead'] == true;
    final String time = notify['time']?.toString().toPersianDigits() ?? 'الان';

    // Type detection & Color Coding
    final bool isReject = title.contains('رد شد') || title.contains('❌');
    final bool isApprove = title.contains('تایید شد') || title.contains('✅');
    final bool isNews = type == 'news' || title.contains('📢') || title.contains('خبر') || body.contains('خبر');
    final bool isProfile = title.contains('تکمیل پروفایل') || body.contains('تکمیل پروفایل') || title.contains('پروفایل');
    final bool isChallenge = type == 'challenge' || title.contains('چالش') || body.contains('چالش') || title.contains('پاسخ');
    final bool isClass = title.contains('کلاس') || title.contains('منزلگاه') || body.contains('کلاس') || body.contains('منزلگاه');
    final bool isMarket = title.contains('فروشگاه') || title.contains('بازارچه') || title.contains('سکه') || title.contains('زریک');

    // Dynamic Styling Elements
    Color accentColor = const Color(0xFFC09268);
    Color cardBg = const Color(0xFF1D1A35);
    Color borderColor = const Color(0xFF3B3666).withValues(alpha: 0.5);
    IconData leadingIcon = Icons.notifications_active_rounded;
    String actionBtnLabel = 'مشاهده جزییات';
    IconData actionBtnIcon = Icons.arrow_forward_rounded;

    if (isReject) {
      accentColor = const Color(0xFFF87171);
      cardBg = const Color(0xFF281822);
      borderColor = const Color(0xFFEF4444).withValues(alpha: 0.35);
      leadingIcon = Icons.cancel_rounded;
      actionBtnLabel = 'مشاهده و ویرایش چالش';
      actionBtnIcon = Icons.edit_note_rounded;
    } else if (isApprove) {
      accentColor = const Color(0xFF34D399);
      cardBg = const Color(0xFF162525);
      borderColor = const Color(0xFF10B981).withValues(alpha: 0.35);
      leadingIcon = Icons.check_circle_rounded;
      actionBtnLabel = 'مشاهده پاداش و چالش';
      actionBtnIcon = Icons.emoji_events_rounded;
    } else if (isNews) {
      accentColor = const Color(0xFF38BDF8);
      cardBg = const Color(0xFF16223B);
      borderColor = const Color(0xFF0284C7).withValues(alpha: 0.35);
      leadingIcon = Icons.campaign_rounded;
      actionBtnLabel = 'مشاهده متن کامل خبر';
      actionBtnIcon = Icons.article_rounded;
    } else if (isProfile) {
      accentColor = const Color(0xFFFFD54F);
      cardBg = const Color(0xFF27211E);
      borderColor = const Color(0xFFF59E0B).withValues(alpha: 0.35);
      leadingIcon = Icons.stars_rounded;
      actionBtnLabel = 'تکمیل پروفایل (دریافت ۱۰۰ سکه)';
      actionBtnIcon = Icons.badge_rounded;
    } else if (isChallenge) {
      accentColor = const Color(0xFFDEB58A);
      leadingIcon = Icons.emoji_events_outlined;
      actionBtnLabel = 'ورود به صفحه چالش‌ها';
      actionBtnIcon = Icons.flag_rounded;
    } else if (isClass) {
      accentColor = const Color(0xFFA78BFA);
      leadingIcon = Icons.auto_stories_rounded;
      actionBtnLabel = 'ورود به آموزگاه و منزلگاه';
      actionBtnIcon = Icons.school_rounded;
    } else if (isMarket) {
      accentColor = const Color(0xFFFB923C);
      leadingIcon = Icons.storefront_rounded;
      actionBtnLabel = 'ورود به بازارچه کاروان';
      actionBtnIcon = Icons.shopping_bag_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: !isRead ? accentColor.withValues(alpha: 0.6) : borderColor,
          width: !isRead ? 1.2 : 0.9,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _toggleExpanded(id, notify, repository),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Row: Leading Category Icon + Title + Unread Badge + Time + Chevron
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Leading Category Icon
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: accentColor.withValues(alpha: 0.3),
                            width: 1,
                          ),
                        ),
                        child: Icon(
                          leadingIcon,
                          color: accentColor,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Title & Unread Indicator
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    title,
                                    maxLines: isExpanded ? 2 : 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 13.5,
                                      fontWeight: !isRead ? FontWeight.bold : FontWeight.w600,
                                      fontFamily: AppTheme.fontFamily,
                                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                                    ),
                                  ),
                                ),
                                if (!isRead) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    width: 7,
                                    height: 7,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: accentColor,
                                      boxShadow: [
                                        BoxShadow(
                                          color: accentColor.withValues(alpha: 0.6),
                                          blurRadius: 4,
                                          spreadRadius: 1,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              time,
                              style: const TextStyle(
                                color: Color(0xFF9D99B8),
                                fontSize: 10,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Expand/Collapse Chevron Indicator
                      AnimatedRotation(
                        turns: isExpanded ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 250),
                        child: Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: accentColor.withValues(alpha: 0.8),
                          size: 22,
                        ),
                      ),
                    ],
                  ),

                  // Collapsed Preview / Teaser (Only if not expanded)
                  if (!isExpanded && body.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      body,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFB5B3C8),
                        fontSize: 11.5,
                        height: 1.4,
                        fontFamily: AppTheme.fontFamily,
                        fontFamilyFallback: AppTheme.fontFamilyFallback,
                      ),
                    ),
                  ],

                  // Expanded Detailed Content & Action Buttons
                  AnimatedCrossFade(
                    firstChild: const SizedBox.shrink(),
                    secondChild: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 12),
                        Container(
                          height: 1,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                accentColor.withValues(alpha: 0.3),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Full Message Body Text
                        Text(
                          body.isNotEmpty ? body : 'پیام با جزییات کامل در دسترس است.',
                          style: const TextStyle(
                            color: Color(0xFFEDE8F5),
                            fontSize: 12,
                            height: 1.65,
                            fontFamily: AppTheme.fontFamily,
                            fontFamilyFallback: AppTheme.fontFamilyFallback,
                          ),
                        ),

                        const SizedBox(height: 14),

                        // Interactive Action Button
                        ElevatedButton.icon(
                          onPressed: () => _handleActionClick(notify, repository),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: (accentColor.computeLuminance() > 0.4)
                                ? const Color(0xFF1E1435)
                                : Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16),
                            elevation: 0,
                          ),
                          icon: Icon(actionBtnIcon, size: 16),
                          label: Text(
                            actionBtnLabel,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                      ],
                    ),
                    crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                    duration: const Duration(milliseconds: 220),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Empty State Widget
  Widget _buildEmptyState() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 40),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF453F73).withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(
            Icons.notifications_none_rounded,
            size: 52,
            color: Color(0xFF676296),
          ),
          SizedBox(height: 14),
          Text(
            'پیام یا اعلانی در این دسته وجود ندارد',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'اعلان‌ها و رویدادهای کاروان نپا پس از انتشار در اینجا نمایش داده می‌شوند.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF9D99B8),
              fontSize: 11.5,
              height: 1.5,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ],
      ),
    );
  }
}
