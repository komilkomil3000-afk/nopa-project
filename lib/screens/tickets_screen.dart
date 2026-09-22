import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:file_picker/file_picker.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_colors.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/custom_drawer.dart';
import '../main.dart';

class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  final HttpApiService _api = HttpApiService();
  List<Map<String, dynamic>> _tickets = [];
  bool _isLoading = true;
  // 0: همه, 1: در حال بررسی, 2: پاسخ داده شده
  int _selectedFilterIndex = 0;
  final Set<String> _expandedItemIds = {};

  @override
  void initState() {
    super.initState();
    _fetchTickets();
  }

  String _getPersianDate() {
    final now = Jalali.now();
    final y = now.year;
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y/$m/$d';
  }

  Future<void> _fetchTickets() async {
    setState(() => _isLoading = true);
    try {
      final remoteTickets = await _api.getTickets();
      if (mounted) {
        if (remoteTickets.isNotEmpty) {
          setState(() {
            _tickets = remoteTickets;
            _isLoading = false;
          });
        } else {
          _loadDefaultDemoTickets();
        }
      }
    } catch (_) {
      if (mounted) {
        _loadDefaultDemoTickets();
      }
    }
  }

  void _loadDefaultDemoTickets() {
    final now = Jalali.now();
    final y = now.year;
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    final today = '$y/$m/$d';

    setState(() {
      _tickets = [
        {
          'id': 'req_mentor_1',
          'subject': 'درخواست تغییر راهبر کاروان',
          'category': 'درخواست تغییر راهبر',
          'date': today,
          'status': 'pending', // pending, answered, resolved
          'description': 'با سلام و احترام، به دلیل هماهنگی زمان جلسات کاروان درخواست تغییر راهبر محترم را دارم.',
          'answer': null,
          'attachedFile': null,
        },
        {
          'id': 'req_caravan_1',
          'subject': 'درخواست انتقال به کاروان شماره ۷',
          'category': 'درخواست تغییر کاروان',
          'date': '۱۴۰۳/۰۶/۲۰',
          'status': 'answered',
          'description': 'درخواست جابجایی کاروان به منظور هماهنگی بیشتر با هم‌گروهی‌ها در پروژه‌های تیمی نپا.',
          'answer': 'درخواست شما توسط مدیر کاروان بررسی و تایید شد. از ابتدای هفته آینده انتقال اعمال می‌گردد.',
          'attachedFile': 'request_form.pdf',
        },
        {
          'id': 'req_market_1',
          'subject': 'درخواست مبادله سرمایه زریک و درفش',
          'category': 'درخواست مبادله سرمایه',
          'date': '۱۴۰۳/۰۶/۱۵',
          'status': 'answered',
          'description': 'درخواست تبدیل ۵۰ زریک به ۲ عدد درفش با نرخ صرافی بازار کاروان.',
          'answer': 'مبادله با موفقیت در صرافی انجام و موجودی کیف پول شما به‌روزرسانی شد ✅',
          'attachedFile': null,
        },
        {
          'id': 'req_certificate_1',
          'subject': 'درخواست نسخه فیزیکی گواهی منزلگاه اول',
          'category': 'درخواست نسخه فیزیکی گواهی',
          'date': '۱۴۰۳/۰۶/۰۵',
          'status': 'pending',
          'description': 'پرداخت آنلاین هزینه چاپ و ارسال پستی گواهی رسمی منزلگاه اول با هولوگرام انجام شده است.',
          'answer': null,
          'attachedFile': 'receipt_14030605.png',
        },
      ];
      _isLoading = false;
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

  void _toggleExpanded(String id) {
    setState(() {
      if (_expandedItemIds.contains(id)) {
        _expandedItemIds.remove(id);
      } else {
        _expandedItemIds.add(id);
      }
    });
  }

  List<Map<String, dynamic>> get _filteredTickets {
    if (_selectedFilterIndex == 1) {
      // در حال بررسی
      return _tickets.where((t) {
        final status = t['status']?.toString().toLowerCase() ?? 'pending';
        return status == 'pending' || status == 'open' || t['answer'] == null;
      }).toList();
    } else if (_selectedFilterIndex == 2) {
      // پاسخ داده شده
      return _tickets.where((t) {
        final status = t['status']?.toString().toLowerCase() ?? '';
        return status == 'answered' || status == 'resolved' || t['answer'] != null;
      }).toList();
    }
    return _tickets;
  }

  void _openNewRequestDialog() {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => _CreateSupportTicketDialog(
        currentDate: _getPersianDate(),
        onTicketCreated: (newTicket) {
          setState(() {
            _tickets.insert(0, newTicket);
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final repository = Provider.of<AppRepository>(context);
    final user = repository.currentUser;
    final filteredList = _filteredTickets;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
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
                // 1. Top Bar: Gradient NOPA + Back SVG on Left, Hamburger Menu on Right
                _buildTopBar(),

                // 2. Main Body
                Expanded(
                  child: RefreshIndicator(
                    color: const Color(0xFFCD8449),
                    backgroundColor: const Color(0xFF231C38),
                    onRefresh: _fetchTickets,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Header: Title & Create New Request Button
                          _buildSectionHeader(),

                          const SizedBox(height: 14),

                          // Filter Tabs Bar: همه / در حال بررسی / پاسخ داده شده
                          _buildFilterPills(),

                          const SizedBox(height: 16),

                          // Tickets List or Empty State
                          if (_isLoading)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(32.0),
                                child: CircularProgressIndicator(color: Color(0xFFCD8449)),
                              ),
                            )
                          else if (filteredList.isEmpty)
                            _buildEmptyState()
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: filteredList.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final ticket = filteredList[index];
                                final String id = ticket['id']?.toString() ?? 'ticket_$index';
                                final bool isExpanded = _expandedItemIds.contains(id);

                                return _buildTicketCard(
                                  ticket: ticket,
                                  id: id,
                                  isExpanded: isExpanded,
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
      ),
    );
  }

  /// Top Bar matching NotificationsScreen and ProfileScreen
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
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 2),
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

            // Right: Drawer Hamburger Menu Button
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
                    child: Center(
                      child: SvgPicture.asset(
                        'assets/svg_icons/Manual01.svg',
                        width: 22,
                        height: 22,
                        colorFilter: const ColorFilter.mode(
                          Color(0xFFC7B299),
                          BlendMode.srcIn,
                        ),
                        errorBuilder: (context, error, stackTrace) => const Icon(
                          Icons.menu_rounded,
                          color: Color(0xFFC7B299),
                          size: 22,
                        ),
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

  /// Header with Title and "ایجاد درخواست جدید" Button
  Widget _buildSectionHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Section Title: تیکت‌های شما
        const Row(
          children: [
            Icon(Icons.confirmation_number_outlined, color: Color(0xFFC09268), size: 20),
            SizedBox(width: 8),
            Text(
              'درخواست‌ها و تیکت‌های شما',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
          ],
        ),

        // Create New Request Button (matching ثبت تغییرات style)
        GestureDetector(
          onTap: _openNewRequestDialog,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5.5),
            decoration: BoxDecoration(
              color: const Color(0xFF2A2835),
              borderRadius: BorderRadius.circular(7),
              border: Border.all(
                color: const Color(0xFFC09268),
                width: 1.0,
              ),
            ),
            child: const Text(
              'ایجاد درخواست',
              style: TextStyle(
                color: Color(0xFFE1BC96),
                fontSize: 11,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Filter Tabs Bar matching NotificationsScreen
  Widget _buildFilterPills() {
    final filters = [
      {'title': 'همه', 'count': _tickets.length},
      {
        'title': 'در حال بررسی',
        'count': _tickets.where((t) => t['status'] == 'pending' || t['answer'] == null).length,
      },
      {
        'title': 'پاسخ داده شده',
        'count': _tickets.where((t) => t['status'] == 'answered' || t['answer'] != null).length,
      },
    ];

    return Column(
      children: [
        Row(
          children: List.generate(filters.length, (idx) {
            final isSelected = _selectedFilterIndex == idx;
            final item = filters[idx];
            final int count = item['count'] as int;

            return Padding(
              padding: const EdgeInsets.only(left: 18.0),
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
                        fontSize: isSelected ? 15 : 13.5,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        fontFamily: AppTheme.fontFamily,
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
                      const SizedBox(width: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
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
    );
  }

  /// Compact Ticket Card matching NotificationsScreen stroke/gradient
  Widget _buildTicketCard({
    required Map<String, dynamic> ticket,
    required String id,
    required bool isExpanded,
  }) {
    final String subject = ticket['subject'] ?? ticket['title'] ?? 'درخواست بدون عنوان';
    final String category = ticket['category'] ?? 'پشتیبانی عمومی';
    final String dateStr = ticket['date'] ?? ticket['createdAt']?.toString() ?? _getPersianDate();
    final String description = ticket['description'] ?? ticket['desc'] ?? '';
    final String? answer = ticket['answer'];
    final String? attachedFile = ticket['attachedFile'];
    final bool isAnswered = answer != null && answer.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Top Header Box
        GestureDetector(
          onTap: () => _toggleExpanded(id),
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
            padding: const EdgeInsets.all(1.2),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
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
                  // Title & Category on the right in RTL
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          subject,
                          textAlign: TextAlign.right,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          category,
                          style: const TextStyle(
                            color: Color(0xFFDEB58A),
                            fontSize: 10,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 8),

                  // Date
                  Text(
                    dateStr,
                    style: const TextStyle(
                      color: Color(0xFF9D99B8),
                      fontSize: 9.5,
                      fontWeight: FontWeight.w500,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),

                  const SizedBox(width: 8),

                  // Small Green Approved (تایید) Badge for answered tickets
                  if (isAnswered) ...[
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF10B981),
                          size: 13,
                        ),
                        SizedBox(width: 3),
                        Text(
                          'تایید',
                          style: TextStyle(
                            color: Color(0xFF10B981),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 8),
                  ],

                  // Small down arrow icon (toggle to up arrow when expanded)
                  Icon(
                    isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFFC7B299),
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
        ),

        // 2. Expanded Detail & Reply Area
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
                // Description
                const Text(
                  'متن درخواست:',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: Color(0xFFDEB58A),
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description.isNotEmpty ? description : 'توضیحاتی برای این درخواست درج نشده است.',
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: Color(0xFFD3D0E3),
                    fontSize: 11.5,
                    height: 1.5,
                    fontFamily: AppTheme.fontFamily,
                  ),
                ),

                // Attached File if exists
                if (attachedFile != null && attachedFile.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.attach_file_rounded, color: Color(0xFFC09268), size: 16),
                      const SizedBox(width: 4),
                      const Text(
                        'فایل ضمیمه: ',
                        style: TextStyle(color: Color(0xFF9D99B8), fontSize: 11, fontFamily: AppTheme.fontFamily),
                      ),
                      Expanded(
                        child: Text(
                          attachedFile,
                          style: const TextStyle(
                            color: Color(0xFFE1BC96),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                // Support / Mentor Answer Section
                if (isAnswered) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1A38),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFF10B981).withValues(alpha: 0.6),
                        width: 1.0,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF10B981), size: 16),
                            SizedBox(width: 6),
                            Text(
                              'پاسخ پشتیبانی / راهبر:',
                              style: TextStyle(
                                color: Color(0xFF10B981),
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          answer,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            height: 1.5,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  const SizedBox(height: 8),
                  const Text(
                    '⏳ این درخواست در صف بررسی توسط راهبر کاروان / پشتیبانی قرار دارد.',
                    style: TextStyle(
                      color: Color(0xFF9D99B8),
                      fontSize: 10.5,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40.0),
        child: Column(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: const BoxDecoration(
                color: Color(0xFF23223D),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(
                  Icons.inbox_outlined,
                  color: Color(0xFF9D99B8),
                  size: 28,
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'درخواستی یافت نشد.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.bold,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'با زدن دکمه «ایجاد درخواست» می‌توانید برای راهبر یا پشتیبانی پیام ارسال کنید.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(0xFF9D99B8),
                fontSize: 11.5,
                fontFamily: AppTheme.fontFamily,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Modal Dialog for Creating a Support / Mentor Request (Matching Box Design in Photo 2)
class _CreateSupportTicketDialog extends StatefulWidget {
  final String currentDate;
  final Function(Map<String, dynamic>) onTicketCreated;

  const _CreateSupportTicketDialog({
    required this.currentDate,
    required this.onTicketCreated,
  });

  @override
  State<_CreateSupportTicketDialog> createState() => _CreateSupportTicketDialogState();
}

class _CreateSupportTicketDialogState extends State<_CreateSupportTicketDialog> {
  final TextEditingController _subjectCtrl = TextEditingController();
  final TextEditingController _descCtrl = TextEditingController();

  String _selectedCategory = 'درخواست تغییر راهبر';
  final List<String> _categories = [
    'درخواست تغییر راهبر',
    'درخواست تغییر کاروان',
    'درخواست مبادله سرمایه',
    'درخواست نسخه فیزیکی گواهی',
    'پیام به راهبر کاروان',
    'پشتیبانی فنی و عمومی',
  ];

  String? _attachedFileName;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.any);
      if (result != null && result.files.isNotEmpty) {
        setState(() {
          _attachedFileName = result.files.first.name;
        });
      }
    } catch (e) {
      debugPrint('FilePicker error: $e');
    }
  }

  Future<void> _submitTicket() async {
    final subject = _subjectCtrl.text.trim().isNotEmpty
        ? _subjectCtrl.text.trim()
        : _selectedCategory;
    final text = _descCtrl.text.trim();

    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('لطفاً شرح درخواست خود را بنویسید', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = HttpApiService();
      await api.createTicket(
        category: _selectedCategory,
        subject: '$subject - $text ${_attachedFileName != null ? "[پیوست: $_attachedFileName]" : ""}',
      );

      final newTicket = {
        'id': 'ticket_${DateTime.now().millisecondsSinceEpoch}',
        'subject': subject,
        'category': _selectedCategory,
        'date': widget.currentDate,
        'status': 'pending',
        'description': text,
        'answer': null,
        'attachedFile': _attachedFileName,
      };

      widget.onTicketCreated(newTicket);

      if (!mounted) return;
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('درخواست شما با موفقیت برای راهبر و پشتیبانی ارسال شد ✅', style: TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('خطا در ارسال درخواست: $e', style: const TextStyle(fontFamily: AppTheme.fontFamily)),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.screenBackgroundGradient,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFF5A4D80),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Row: Shield Profile Icon on top right/left & Title in center
                Stack(
                  alignment: Alignment.center,
                  children: [
                    // Profile/Shield icon on left in RTL
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFFC09268).withValues(alpha: 0.8),
                            width: 1.2,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.support_agent_rounded,
                          color: Color(0xFFC09268),
                          size: 22,
                        ),
                      ),
                    ),

                    // Center Title
                    const Text(
                      'پیام به راهبر و پشتیبانی',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        fontFamily: AppTheme.fontFamily,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Row 1: نوع درخواست (Dropdown)
                _buildDialogRow(
                  label: 'نوع درخواست:',
                  content: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedCategory,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF28274A),
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFFC09268)),
                          style: const TextStyle(
                            color: Color(0xFFE2E0F0),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          items: _categories.map((cat) {
                            return DropdownMenuItem<String>(
                              value: cat,
                              child: Text(cat, style: const TextStyle(fontFamily: AppTheme.fontFamily)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedCategory = val);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Row 2: تاریخ جاری
                _buildDialogRow(
                  label: 'تاریخ:',
                  content: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        widget.currentDate,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Row 3: موضوع (اختیاری)
                _buildDialogRow(
                  label: 'موضوع:',
                  content: Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      child: TextField(
                        controller: _subjectCtrl,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12,
                          fontFamily: AppTheme.fontFamily,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: _selectedCategory,
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.25),
                            fontSize: 11.5,
                            fontFamily: AppTheme.fontFamily,
                          ),
                          contentPadding: const EdgeInsets.symmetric(vertical: 6),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Row 4: شرح دهید (Multi-line)
                _buildDialogRow(
                  label: 'شرح دهید:',
                  crossAxisAlignment: CrossAxisAlignment.start,
                  content: Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.strokeGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.all(AppColors.borderWidth),
                    child: Container(
                      height: 100,
                      decoration: BoxDecoration(
                        gradient: AppColors.darkSurfaceGradient,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      child: TextField(
                        controller: _descCtrl,
                        maxLines: 4,
                        style: const TextStyle(
                          color: Color(0xFFE2E0F0),
                          fontSize: 12,
                          fontFamily: AppTheme.fontFamily,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: 'ما را در جریان قرار دهید...',
                          hintStyle: TextStyle(
                            color: Colors.white.withValues(alpha: 0.25),
                            fontSize: 11.5,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Row 5: ضمیمه فایل
                _buildDialogRow(
                  label: 'پیوست فایل:',
                  content: InkWell(
                    onTap: _pickFile,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppColors.strokeGradient,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.all(AppColors.borderWidth),
                      child: Container(
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: AppColors.darkSurfaceGradient,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(
                            color: _attachedFileName != null ? const Color(0xFFC09268) : Colors.transparent,
                            width: 0.8,
                          ),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Row(
                          children: [
                            Icon(
                              _attachedFileName != null ? Icons.check_circle_rounded : Icons.attach_file_rounded,
                              color: const Color(0xFFC09268),
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _attachedFileName ?? 'انتخاب فایل یا عکس (اختیاری)',
                                style: TextStyle(
                                  color: _attachedFileName != null ? const Color(0xFFE1BC96) : Colors.white38,
                                  fontSize: 11,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (_attachedFileName != null)
                              GestureDetector(
                                onTap: () => setState(() => _attachedFileName = null),
                                child: const Icon(Icons.close_rounded, color: Colors.white54, size: 16),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Bottom Actions: ارسال (Gold text) & لغو (Purple text)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // لغو
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text(
                        'لغو',
                        style: TextStyle(
                          color: Color(0xFF9E9CD6),
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          fontFamily: AppTheme.fontFamily,
                        ),
                      ),
                    ),

                    // ارسال
                    _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFFCD8449),
                            ),
                          )
                        : TextButton(
                            onPressed: _submitTicket,
                            child: const Text(
                              'ارسال',
                              style: TextStyle(
                                color: Color(0xFFE1BC96),
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                fontFamily: AppTheme.fontFamily,
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

  Widget _buildDialogRow({
    required String label,
    required Widget content,
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.center,
  }) {
    return Row(
      crossAxisAlignment: crossAxisAlignment,
      children: [
        // Label on Right in RTL
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFFB5B0D8),
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.fontFamily,
            ),
          ),
        ),
        const SizedBox(width: 8),

        // Content Field
        Expanded(child: content),
      ],
    );
  }
}
