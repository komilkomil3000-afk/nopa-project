import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/widgets/app_scaffold.dart';
import 'package:nopa_app/widgets/jarchi_item.dart';
import 'package:nopa_app/widgets/support_message_dialog.dart';
import 'package:nopa_app/main.dart';

class StudentNotificationsScreen extends StatefulWidget {
  const StudentNotificationsScreen({super.key});

  @override
  State<StudentNotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<StudentNotificationsScreen> {
  // 0: خوانده‌نشده (opens first), 1: همه
  int _selectedFilterIndex = 0;
  final Set<String> _expandedItemIds = {};
  // Messages opened while the "unread" tab is shown stay in it until the user leaves the tab,
  // so reading one does not make it jump to "all" at once
  final Set<String> _keptInUnreadIds = {};
  bool _isSearching = false;
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

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
    // In search mode, back only leaves the search
    if (_isSearching) {
      setState(() {
        _isSearching = false;
        _searchController.clear();
      });
      return;
    }
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
          _keptInUnreadIds.add(id);
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

  /// One decision for a notification: the button label and where the button leads.
  /// Label and destination come from the same place so they can never disagree.
  _NotifAction _classify(Map<String, dynamic> notify, {required bool isMentor}) {
    final String title = notify['title']?.toString() ?? '';
    final String type = notify['type']?.toString() ?? '';

    if (_isSupport(notify)) {
      return const _NotifAction('مشاهده چت', _NotifTarget.none);
    }

    if (type == 'news' || title.startsWith('📢')) {
      return const _NotifAction('مشاهده', _NotifTarget.news);
    }
    if (type == 'profile_completion' ||
        (title.contains('تکمیل پروفایل') && !title.contains('پاداش'))) {
      return const _NotifAction('تکمیل', _NotifTarget.profile);
    }
    // Mentors never take part in challenges: they review the students' answers
    if (isMentor && (title.contains('پاسخ جدید') || type == 'challenge')) {
      return _NotifAction(title.contains('پاسخ جدید') ? 'بررسی' : 'مشاهده', _NotifTarget.challenges);
    }
    // A rejected answer is the only challenge message that asks the student to act again
    if (title.contains('تکلیف رد شد') || title.contains('نیاز به اصلاح')) {
      return const _NotifAction('اصلاح', _NotifTarget.challenges);
    }
    // A newly announced challenge: the user is expected to take part
    if (type == 'challenge') {
      return const _NotifAction('شرکت', _NotifTarget.challenges);
    }
    // A challenge quiz result ("نتیجه آزمون" / "ثبت پاداش آزمون") belongs to the challenges tab,
    // even though it may mention a reward
    if (title.contains('نتیجه آزمون') || title.contains('پاداش آزمون')) {
      return const _NotifAction('مشاهده', _NotifTarget.challenges);
    }
    // Money added (e.g. after passing a class quiz): the wallet is in the profile
    if (title.contains('سرمایه') || title.contains('قبولی در آزمون')) {
      return const _NotifAction('مشاهده', _NotifTarget.profile);
    }
    if (title.contains('کلاس')) {
      return const _NotifAction('مشاهده', _NotifTarget.academy);
    }
    if (title.contains('تکلیف') || title.contains('پاسخ جدید') || title.contains('آزمون')) {
      return const _NotifAction('مشاهده', _NotifTarget.challenges);
    }
    if (title.contains('مبادله')) {
      return const _NotifAction('مشاهده', _NotifTarget.market);
    }
    if (title.contains('ارزیابی')) {
      return const _NotifAction('مشاهده', _NotifTarget.league);
    }
    if (title.contains('پروفایل') ||
        title.contains('گواهینامه') ||
        title.contains('پاداش') ||
        title.contains('کسر موجودی') ||
        title.contains('ارتقای سطح')) {
      return const _NotifAction('مشاهده', _NotifTarget.profile);
    }
    // Informational only (e.g. a caravan leader's message): just open the text
    return const _NotifAction('مشاهده', _NotifTarget.none);
  }

  /// A reply from the support team (older rows were stored with type "alert" and this title).
  bool _isSupport(Map<String, dynamic> notify) =>
      notify['type']?.toString() == 'support' || (notify['title']?.toString() ?? '').contains('پاسخ پشتیبانی');

  /// The whole conversation of the ticket this support reply belongs to, as chat bubbles.
  Future<void> _showSupportChat(Map<String, dynamic> notify) async {
    final body = (notify['body']?.toString() ?? '').trim();
    final tickets = await HttpApiService().getTickets();
    if (!mounted) return;

    int ts(dynamic v) => DateTime.tryParse(v?.toString() ?? '')?.millisecondsSinceEpoch ?? 0;
    Map<String, dynamic>? ticket;
    for (final t in tickets) {
      final replies = (t['replies'] is List) ? (t['replies'] as List) : const [];
      if (replies.any((r) => body.isNotEmpty && (r['message']?.toString() ?? '').trim().startsWith(body))) {
        if (ticket == null || ts(t['updatedAt']) > ts(ticket['updatedAt'])) ticket = t;
      }
    }
    ticket ??= tickets.where((t) => (t['replies'] is List) && (t['replies'] as List).isNotEmpty).fold<Map<String, dynamic>?>(
        null, (a, b) => a == null || ts(b['updatedAt']) > ts(a['updatedAt']) ? b : a);

    final messages = <Map<String, dynamic>>[];
    if (ticket != null) {
      messages.add({'mine': true, 'text': ticket['subject']?.toString() ?? '', 'at': ticket['createdAt']});
      final replies = List<Map<String, dynamic>>.from((ticket['replies'] as List?) ?? const [])
        ..sort((a, b) => ts(a['createdAt']).compareTo(ts(b['createdAt'])));
      for (final r in replies) {
        messages.add({'mine': false, 'text': r['message']?.toString() ?? '', 'at': r['createdAt']});
      }
    } else {
      messages.add({'mine': false, 'text': body, 'at': notify['createdAt']});
    }

    await showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 420, maxHeight: 520),
            padding: const EdgeInsets.all(16),
            decoration: AppColors.loginDialogDecoration(radius: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'گفتگو با پشتیبانی',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: messages.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final m = messages[i];
                      final mine = m['mine'] == true;
                      return Align(
                        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          constraints: const BoxConstraints(maxWidth: 300),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: mine ? const Color(0xFF3D3C67) : const Color(0xFF4A3A2A),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(mine ? 'شما' : 'پشتیبانی',
                                  style: const TextStyle(color: Color(0xFFDEB58A), fontSize: 10.5, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                              const SizedBox(height: 3),
                              Text(m['text'] as String,
                                  style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.6, fontFamily: AppTheme.fontFamily)),
                              const SizedBox(height: 3),
                              Text(_formatDate(m['at'], null),
                                  style: const TextStyle(color: Color(0xFF9D99B8), fontSize: 9.5, fontFamily: AppTheme.fontFamily)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('بستن',
                      style: TextStyle(color: Color(0xFF9E9CD6), fontSize: 15, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool get _isMentor {
    final role = Provider.of<AppRepository>(context, listen: false).currentUser.role;
    return role.isMentorLike;
  }

  String _resolveActionLabel(Map<String, dynamic> notify) => _classify(notify, isMentor: _isMentor).label;

  void _goToTab(int index) {
    if (mounted && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
    navigateToMainTab(index);
  }

  Future<void> _showNews(Map<String, dynamic> notify) async {
    // Server titles carry a "📢 " prefix that the news article itself does not have
    final String title = (notify['title']?.toString() ?? '').replaceFirst('📢', '').trim();
    final String body = notify['body']?.toString() ?? '';
    const fallbackImage = 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400';

    try {
      final newsList = await HttpApiService().getNews();
      Map<String, dynamic>? matched;
      for (final n in newsList) {
        final nTitle = n['title']?.toString() ?? '';
        if (nTitle.isNotEmpty && nTitle == title) {
          matched = n;
          break;
        }
      }

      String imageUrl = fallbackImage;
      if (matched?['imageUrl'] != null) {
        imageUrl = '${HttpApiService().baseUrl.replaceAll('/api/v1', '')}${matched!['imageUrl']}';
      }
      if (!mounted) return;
      JarchiItem.showNewsDialog(
        context,
        title: matched?['title'] ?? title,
        date: _formatDate(matched?['createdAt'] ?? notify['createdAt'], notify['time']),
        imageUrl: imageUrl,
        content: matched?['body'] ?? body,
        link: matched?['reporter'],
      );
    } catch (_) {
      if (!mounted) return;
      JarchiItem.showNewsDialog(
        context,
        title: title,
        date: _formatDate(notify['createdAt'], notify['time']),
        imageUrl: fallbackImage,
        content: body,
      );
    }
  }

  Future<void> _handleActionClick(Map<String, dynamic> notify, AppRepository repository) async {
    final String notifId = notify['id']?.toString() ?? '';
    if (notifId.isNotEmpty) {
      if (notify['isRead'] != true) setState(() => _keptInUnreadIds.add(notifId));
      await repository.markNotificationAsRead(notifId);
    }

    if (_isSupport(notify)) {
      await _showSupportChat(notify);
      return;
    }

    switch (_classify(notify, isMentor: _isMentor).target) {
      case _NotifTarget.news:
        await _showNews(notify);
      case _NotifTarget.profile:
        _goToTab(4);
      case _NotifTarget.challenges:
        _goToTab(2);
      case _NotifTarget.academy:
        _goToTab(1);
      case _NotifTarget.market:
        _goToTab(3);
      case _NotifTarget.league:
        if (mounted) Navigator.pushNamed(context, '/mentor_league');
      case _NotifTarget.none:
        if (mounted && notifId.isNotEmpty) {
          setState(() => _expandedItemIds.add(notifId));
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final user = repository.currentUser;
    final isMentor = user.role.isMentorLike;

    // Filter list based on mentor role
    final allList = repository.notifications
        .where((n) => n['isForMentor'] == isMentor)
        .toList();

    List<Map<String, dynamic>> filteredList;
    if (_selectedFilterIndex == 0) {
      filteredList = allList
          .where((n) => n['isRead'] != true || _keptInUnreadIds.contains(n['id']?.toString()))
          .toList();
    } else {
      filteredList = allList;
    }

    final String query = _searchController.text.trim();
    if (_isSearching && query.isNotEmpty) {
      filteredList = allList.where((n) {
        final text = '${n['title'] ?? ''} ${n['body'] ?? ''}';
        return text.contains(query);
      }).toList();
    }

    final int unreadCount = repository.unreadNotificationsCount;

    return PopScope(
      canPop: !_isSearching,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBackAction();
      },
      child: AppScaffold(
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

              if (_isSearching) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  textDirection: TextDirection.rtl,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                  decoration: InputDecoration(
                    hintText: 'جستجو در پیام‌ها',
                    hintStyle: const TextStyle(color: Color(0xFF9D99B8), fontSize: 12.5, fontFamily: AppTheme.fontFamily),
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFF23223D),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: const Color(0xFF383556).withValues(alpha: 0.8)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: const Color(0xFF383556).withValues(alpha: 0.8)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFDE9959)),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 12),

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

          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (unreadCount > 0)
                Material(
              color: Colors.transparent,
              child: TapExpander(child: InkWell(
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
              )),
            ),
              TapExpander(
                child: IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  icon: Icon(
                    _isSearching ? Icons.close_rounded : Icons.search_rounded,
                    color: const Color(0xFFDEB58A),
                    size: 22,
                  ),
                  onPressed: () => setState(() {
                    _isSearching = !_isSearching;
                    if (!_isSearching) _searchController.clear();
                  }),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Support Message Action Button styled identically to "ورود به کلاس‌ها" button
  Widget _buildSupportActionButton() {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Material(
        color: Colors.transparent,
        child: TapExpander(child: InkWell(
          onTap: () => SupportMessageDialog.show(context),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF2A2835),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: const Color(0xFFC09268).withValues(alpha: 0.85),
                width: 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(
                  Icons.support_agent_rounded,
                  color: Color(0xFFF4DCC5),
                  size: 15,
                ),
                SizedBox(width: 5),
                Text(
                  'ارسال پیام به پشتیبانی',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFF4DCC5),
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
              ],
            ),
          ),
        )),
      ),
    );
  }

  /// Filter Tabs Bar: Text-only tabs matching the category tabs in Challenges screen
  Widget _buildFilterPills(List<Map<String, dynamic>> allList, int unreadCount) {
    // Only the unread tab shows a count; "all" has none
    final filters = [
      {'title': 'خوانده‌نشده', 'count': unreadCount},
      {'title': 'همه', 'count': 0},
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        children: [
          Row(
            children: [
              ...List.generate(filters.length, (idx) {
              final isSelected = _selectedFilterIndex == idx;
              final item = filters[idx];
              final int count = item['count'] as int;

              return Padding(
                padding: const EdgeInsets.only(left: 20.0),
                child: TapExpander(child: GestureDetector(
                  onTap: () => setState(() {
                    _selectedFilterIndex = idx;
                    _keptInUnreadIds.clear();
                  }),
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
                )),
              );
              }),
              const Spacer(),
              _buildSupportActionButton(),
            ],
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
    final bool isRead = notify['isRead'] == true;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Header Box: Station card gradient stroke + dark surface
          TapExpander(child: GestureDetector(
            onTap: () => _toggleExpanded(id, notify, repository),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: isExpanded
                    ? const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
                      )
                    : BorderRadius.circular(16),
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: const [0.0, 0.5, 1.0],
                  colors: isRead
                      ? const [Color(0xFF3A3A4A), Color(0xFF6E6E80), Color(0xFF3A3A4A)]
                      : const [Color(0xFF3A3A6A), Color(0xFF9292E2), Color(0xFF3A3A6A)],
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
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.0, 0.53, 1.0],
                    colors: isRead
                        ? const [Color(0xFF3A3A44), Color(0xFF34343D), Color(0xFF30303A)]
                        : const [Color(0xFF3D3C67), Color(0xFF36345C), Color(0xFF333359)],
                  ),
                ),
                child: Row(
                  children: [
                    if (_isSupport(notify)) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDE9959).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFDE9959).withValues(alpha: 0.7), width: 0.8),
                        ),
                        child: const Text('پشتیبانی',
                            style: TextStyle(color: Color(0xFFDEB58A), fontSize: 9.5, fontWeight: FontWeight.bold, fontFamily: AppTheme.fontFamily)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Title on the right in RTL (smaller font size)
                    Expanded(
                      child: Text(
                        title,
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isRead ? const Color(0xFF9A9AA8) : Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w400,
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
                        fontWeight: FontWeight.w400,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),

                    const SizedBox(width: 10),

                    // Action Button on the far left (styled identical to "شرکت" button in Home challenges)
                    TapExpander(child: GestureDetector(
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
                              fontSize: 9.5,
                              fontWeight: FontWeight.w300,
                              fontFamily: AppTheme.fontFamily,
                              fontFamilyFallback: AppTheme.fontFamilyFallback,
                            ),
                          ),
                        ),
                      ),
                    )),
                  ],
                ),
              ),
            ),
          )),

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


typedef NotificationsScreen = StudentNotificationsScreen;

enum _NotifTarget { news, profile, challenges, academy, market, league, none }

class _NotifAction {
  final String label;
  final _NotifTarget target;
  const _NotifAction(this.label, this.target);
}
