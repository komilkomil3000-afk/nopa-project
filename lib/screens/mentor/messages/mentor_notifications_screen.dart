import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/jarchi_item.dart';
import 'package:nopa_app/main.dart';

class MentorNotificationsScreen extends StatefulWidget {
  const MentorNotificationsScreen({super.key});

  @override
  State<MentorNotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<MentorNotificationsScreen> {
  // 0: همه, 1: خوانده‌نشده
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

  void _toggleExpanded(String id, Map<String, dynamic> notify, AppRepository repository) {
    setState(() {
      if (_expandedItemIds.contains(id)) {
        _expandedItemIds.remove(id);
      } else {
        _expandedItemIds.add(id);
        // Mark as read automatically when opened
        if (notify['isRead'] != true && id.isNotEmpty) {
          repository.markNotificationAsRead(id);
        }
      }
    });
  }

  String _formatDate(dynamic createdAt, dynamic timeStr) {
    if (createdAt != null) {
      try {
        final dt = createdAt is DateTime ? createdAt : DateTime.tryParse(createdAt.toString());
        if (dt != null) {
          final j = Jalali.fromDateTime(dt);
          final y = j.year.toString().padLeft(4, '0');
          final m = j.month.toString().padLeft(2, '0');
          final d = j.day.toString().padLeft(2, '0');
          return '$y/$m/$d'.toPersianDigits();
        }
      } catch (_) {}
    }
    if (timeStr != null && timeStr.toString().trim().isNotEmpty) {
      final s = timeStr.toString().trim();
      if (s.contains('/') || s.contains('-')) {
        return s.toPersianDigits();
      }
    }
    final nowJ = Jalali.now();
    final y = nowJ.year.toString().padLeft(4, '0');
    final m = nowJ.month.toString().padLeft(2, '0');
    final d = nowJ.day.toString().padLeft(2, '0');
    return '$y/$m/$d'.toPersianDigits();
  }

  String _resolveActionLabel(Map<String, dynamic> notify) {
    final String title = notify['title'] ?? '';
    final String body = notify['body'] ?? '';
    final String type = notify['type'] ?? '';

    if (title.contains('تکمیل پروفایل') || body.contains('تکمیل پروفایل') || title.contains('پروفایل')) {
      return 'تکمیل';
    }
    if (type == 'challenge' || title.contains('چالش') || body.contains('چالش')) {
      return 'مشاهده';
    }
    if (title.contains('کلاس') || title.contains('منزلگاه') || body.contains('کلاس') || body.contains('منزلگاه')) {
      return 'ورود';
    }
    if (title.contains('بازارچه') || title.contains('فروشگاه') || title.contains('سکه')) {
      return 'مشاهده';
    }
    return 'مشاهده';
  }

  Future<void> _handleActionClick(Map<String, dynamic> notify, AppRepository repository) async {
    final String notifId = notify['id']?.toString() ?? '';
    if (notifId.isNotEmpty) {
      await repository.markNotificationAsRead(notifId);
    }

    final String title = notify['title'] ?? '';
    final String body = notify['body'] ?? '';
    final String type = notify['type'] ?? '';

    // 1. News / جارچی اطلاعیه‌ها
    if (type == 'news' ||
        title.contains('خبر') ||
        body.contains('خبر') ||
        title.contains('اطلاعیه') ||
        title.contains('جارچی')) {
      try {
        final newsList = await HttpApiService().getNews();
        Map<String, dynamic>? matched;
        for (final n in newsList) {
          final nTitle = n['title']?.toString() ?? '';
          if (nTitle.isNotEmpty &&
              (title.contains(nTitle) ||
                  nTitle.contains(title.trim()))) {
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
        final dateStr = _formatDate(matched?['createdAt'], notify['time']);

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
            date: _formatDate(null, notify['time']),
            imageUrl:
                'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400',
            content: body,
          );
        }
      }
      return;
    }

    // 2. Complete Profile / تکمیل پروفایل و مشخصات
    if (title.contains('تکمیل پروفایل') ||
        body.contains('تکمیل پروفایل') ||
        title.contains('تکمیل مشخصات') ||
        body.contains('تکمیل مشخصات') ||
        title.contains('پروفایل') ||
        body.contains('پروفایل') ||
        title.contains('مشخصات') ||
        body.contains('مشخصات')) {
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      navigateToMainTab(4); // Profile tab for both student & mentor
      return;
    }

    // 3. Challenge / Message / چالش و پیام‌ها و پاسخ‌ها
    if (type == 'challenge' ||
        type == 'message' ||
        title.contains('چالش') ||
        body.contains('چالش') ||
        title.contains('پیام') ||
        body.contains('پیام') ||
        title.contains('پاسخ') ||
        body.contains('پاسخ') ||
        title.contains('تایید شد') ||
        title.contains('رد شد')) {
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      navigateToMainTab(2); // Challenges / Messages tab for both student & mentor
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

    // 5. Market / فروشگاه / زریک / سکه / مبادلات
    if (title.contains('فروشگاه') ||
        body.contains('فروشگاه') ||
        title.contains('سکه') ||
        body.contains('زریک') ||
        title.contains('بازار') ||
        body.contains('بازار') ||
        title.contains('مبادله') ||
        body.contains('مبادله') ||
        title.contains('نرخ') ||
        body.contains('نرخ')) {
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      navigateToMainTab(3); // Market tab for both student & mentor
      return;
    }

    // 6. Map / Stations / کلاس و منزلگاه / آموزگاه
    if (title.contains('منزلگاه') ||
        title.contains('کلاس') ||
        title.contains('ایستگاه') ||
        title.contains('آموزگاه') ||
        body.contains('منزلگاه') ||
        body.contains('کلاس') ||
        body.contains('آموزگاه') ||
        title.contains('نقشه')) {
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      navigateToMainTab(1); // Stations / Classes / MentorStation tab for both
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
          content: Text('پیام با موفقیت بررسی و باز شد.', style: TextStyle(fontFamily: AppTheme.fontFamily)),
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

    // Filter list based on mentor role
    final allList = repository.notifications
        .where((n) => n['isForMentor'] == isMentor)
        .toList();

    List<Map<String, dynamic>> filteredList;
    if (_selectedFilterIndex == 1) {
      filteredList = allList.where((n) => n['isRead'] != true).toList();
    } else {
      filteredList = allList;
    }

    final int unreadCount = repository.unreadNotificationsCount;

    return AppScaffold(
      showBackButton: true,
      showNotificationIcon: false, // Messages screen: Hide the Messages/Notification icon
      showDrawerButton: true,
      showBottomNavBar: true,
      currentBottomNavIndex: -1,
      onBackTap: _handleBackAction,
      body: RefreshIndicator(
        color: const Color(0xFFCD8449),
        backgroundColor: const Color(0xFF231C38),
        onRefresh: () async {
          await repository.fetchNotifications();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Title & Mark All Read
              _buildSectionHeader(repository, unreadCount),

              const SizedBox(height: 14),

              // Filter Pills Bar (Styled identically to Calendar day pill cards)
              _buildFilterPills(allList, unreadCount),

              const SizedBox(height: 16),

              // Notifications List or Empty State
              if (filteredList.isEmpty)
                _buildEmptyState()
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filteredList.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
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

  /// Filter Tabs Bar: Text-only tabs matching the category tabs in Challenges screen
  Widget _buildFilterPills(List<Map<String, dynamic>> allList, int unreadCount) {
    final filters = [
      {'title': 'همه', 'count': allList.length},
      {'title': 'خوانده‌نشده', 'count': unreadCount},
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Row(
            children: List.generate(filters.length, (idx) {
              final isSelected = _selectedFilterIndex == idx;
              final item = filters[idx];
              final int count = item['count'] as int;

              return Padding(
                padding: const EdgeInsets.only(left: 20.0),
                child: GestureDetector(
                  onTap: () => setState(() => _selectedFilterIndex = idx),
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        item['title'] as String,
                        style: TextStyle(
                          color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF9D99B8),
                          fontSize: isSelected ? 15.5 : 14,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                          shadows: isSelected
                              ? [
                                  Shadow(
                                    color: const Color(0xFFDE9959).withValues(alpha: 0.4),
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                      if (count > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFFDE9959).withValues(alpha: 0.25)
                                : const Color(0xFF23223D),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFFDE9959).withValues(alpha: 0.6)
                                  : const Color(0xFF383556),
                              width: 0.8,
                            ),
                          ),
                          child: Text(
                            count.toPersian(),
                            style: TextStyle(
                              color: isSelected ? const Color(0xFFDE9959) : const Color(0xFF9D99B8),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              fontFamily: AppTheme.fontFamily,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Container(
            height: 1.0,
            width: double.infinity,
            color: const Color(0xFF383556).withValues(alpha: 0.6),
          ),
        ],
      ),
    );
  }

  /// Compact Notification Card matching Station Card stroke/gradient and Home Challenge button
  Widget _buildNotificationCard({
    required Map<String, dynamic> notify,
    required String id,
    required bool isExpanded,
    required AppRepository repository,
  }) {
    final String title = notify['title'] ?? 'اعلان جدید کاروان';
    final String body = notify['body'] ?? '';
    final String dateStr = _formatDate(notify['createdAt'], notify['time']);
    final String actionLabel = _resolveActionLabel(notify);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Header Box: Station card gradient stroke + dark surface
          GestureDetector(
            onTap: () => _toggleExpanded(id, notify, repository),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: isExpanded
                    ? const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
                      )
                    : BorderRadius.circular(16),
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
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(1.2), // Gradient border matching station card
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8.5),
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.only(
                          topLeft: Radius.circular(14.8),
                          topRight: Radius.circular(14.8),
                        )
                      : BorderRadius.circular(14.8),
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
                child: Row(
                  children: [
                    // Title on the right in RTL (smaller font size)
                    Expanded(
                      child: Text(
                        title,
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          fontFamily: AppTheme.fontFamily,
                          fontFamilyFallback: AppTheme.fontFamilyFallback,
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Date in center-left (smaller font size)
                    Text(
                      dateStr,
                      style: const TextStyle(
                        color: Color(0xFF9D99B8),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w500,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),

                    const SizedBox(width: 10),

                    // Action Button on the far left (styled identical to "شرکت" button in Home challenges)
                    GestureDetector(
                      onTap: () => _handleActionClick(notify, repository),
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: AppColors.strokeGradient,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        padding: const EdgeInsets.all(AppColors.borderWidth),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                          decoration: BoxDecoration(
                            gradient: AppColors.darkSurfaceGradient,
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Text(
                            actionLabel,
                            style: const TextStyle(
                              color: Color(0xFFC7B299),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 2. Expanded Description Area directly below header
          if (isExpanded)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF2C2B4F).withValues(alpha: 0.95),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
                border: Border(
                  left: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                  right: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                  bottom: BorderSide(color: const Color(0xFF3A3A6A).withValues(alpha: 0.8), width: 1.2),
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'توضیحات:',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: Color(0xFFDEB58A),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    body.isNotEmpty ? body : 'توضیحات تکمیلی برای این پیام ثبت نشده است.',
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      color: Color(0xFFD3D0E3),
                      fontSize: 11.5,
                      height: 1.6,
                      fontFamily: AppTheme.fontFamily,
                      fontFamilyFallback: AppTheme.fontFamilyFallback,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
                      onTap: () => _handleActionClick(notify, repository),
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: AppColors.strokeGradient,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        padding: const EdgeInsets.all(AppColors.borderWidth),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            gradient: AppColors.darkSurfaceGradient,
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                actionLabel,
                                style: const TextStyle(
                                  color: Color(0xFFDFB690),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.arrow_back_ios_new_rounded,
                                color: Color(0xFFDFB690),
                                size: 10,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
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
            size: 48,
            color: Color(0xFF676296),
          ),
          SizedBox(height: 14),
          Text(
            'پیامی در این بخش وجود ندارد',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'اعلان‌ها و رویدادهای جدید کاروان نپا در این بخش نمایش داده می‌شوند.',
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


typedef NotificationsScreen = MentorNotificationsScreen;
