import 'package:nopa_app/widgets/nopa_entrance.dart';
import 'package:nopa_app/core/economy_rates.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';
import 'package:nopa_app/core/constants/app_routes.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:nopa_app/widgets/nopa_pill_tabs.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/asset_names.dart';
import 'package:nopa_app/core/app_images.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shamsi_date/shamsi_date.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_theme.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/widgets/nopa_dialog_container.dart';
import 'package:nopa_app/widgets/caravan_banners_dialog.dart';
import 'package:nopa_app/widgets/caravan_standing_summary.dart';
import 'package:nopa_app/widgets/info_reveal.dart';
import 'package:nopa_app/utils/constants.dart';
import 'package:nopa_app/utils/mentor_contact.dart';

/// Who the market is shown to. The two share the rate sheet and the leaderboard:
/// - student: own capital, the exchange panel and "contact mentor";
/// - mentor: the caravan's members report and exchanges (observer view, can cancel), synced to the picked caravan.
enum MarketMode { student, mentor }

/// The بازارچه tab for students and mentors (app_shell picks the mode from the role).
class MarketScreen extends StatefulWidget {
  final MarketMode mode;
  const MarketScreen({super.key, required this.mode});

  /// Each bump asks the market to scroll to «برترین‌ها» (the drawer's «برترین‌ها» item switches to this tab first).
  static final ValueNotifier<int> leaderboardRequests = ValueNotifier<int>(0);
  static void showLeaderboard() => leaderboardRequests.value++;

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  bool get _isMentor => widget.mode == MarketMode.mentor;

  // Rate sheet; kalaf and carpet follow the rules set in the panel, banners are only won
  List<Map<String, dynamic>> get _rateItems => [
    {
      'title': 'کلاف',
      'priceText': EconomyRates.allowBuyNakh ? '${EconomyRates.zarikPerNakh} ${AssetNames.of('zarik')}' : 'غیرقابل‌خرید',
      'assetKey': 'کلاف',
    },
    {
      'title': 'قالیچه',
      'priceText': '${EconomyRates.nakhPerFarsh} ${AssetNames.of('nakh')}',
      'assetKey': 'قالیچه',
    },
    // Banner ranks of an inter-group challenge (AssetType keys derafsh_bronze / _silver / _gold / _cloth)
    {
      'title': 'درفش پارچه‌ای',
      'priceText': 'غیرقابل‌خرید',
      'assetKey': 'درفش پارچه‌ای',
    },
    {
      'title': 'درفش برنزی',
      'priceText': 'غیرقابل‌خرید',
      'assetKey': 'درفش برنزی',
    },
    {
      'title': 'درفش نقره‌ای',
      'priceText': 'غیرقابل‌خرید',
      'assetKey': 'درفش نقره‌ای',
    },
    {
      'title': 'درفش طلایی',
      'priceText': 'غیرقابل‌خرید',
      'assetKey': 'درفش طلایی',
    },
  ];

  // Selected asset index for "سرمایه های شما"
  int _selectedAssetIndex = 0;

  // Selected tab for "برترین ها (لیگ)" (0: برترین شرکت کننده ها, 1: برترین کاروان ها)
  int _selectedLeaderboardTab = 0;

  // Leaderboard data (from /leagues/*)
  List<Map<String, dynamic>> _topMembers = [];
  List<Map<String, dynamic>> _topCaravans = [];
  bool _leaderboardsLoaded = false;

  // «برترین‌ها» in the drawer opens this tab scrolled to the rankings (see [MarketScreen.showLeaderboard])
  final GlobalKey _leaderboardKey = GlobalKey();
  int _handledLeaderboardRequest = 0;

  List<String> _memberIds = [];
  List<String> _caravanIds = [];
  // every ranked row by id, so «شما» / «کاروان شما» can show their own figures under the podium
  Map<String, Map<String, dynamic>> _memberRows = {};
  Map<String, Map<String, dynamic>> _caravanRows = {};

  // Exchange calculator states
  String _sourceAsset = 'کلاف';
  String _targetAsset = 'قالیچه';
  final TextEditingController _amountController = TextEditingController(text: EconomyRates.nakhPerFarsh.toString());
  double _calculatedResult = 1.0;

  // Interactive button selection states (0: none, 1: submit active, 2: mentor active)
  int _activeActionButton = 1; // Default: 'ثبت درخواست' is active/colored

  final List<String> _availableAssets = ['زریک', 'کلاف', 'قالیچه'];

  // «توضیحات» under the capital: six lines, then «بیشتر...» (as on the station page)
  bool _isDescriptionExpanded = false;

  /// Assets a user can give: those with at least one allowed exchange (for now کلاف → قالیچه and
  /// قالیچه → زریک; زریک → کلاف only when the admin allows buying کلاف).
  List<String> get _sourceOptions =>
      _availableAssets.where((s) => _targetOptionsFor(s).isNotEmpty).toList();

  /// What [source] can be exchanged for.
  List<String> _targetOptionsFor(String source) =>
      _availableAssets.where((t) => EconomyRates.rule(source, t) != null).toList();

  /// Keeps the two pickers on an allowed pair (the rules can change when the rates arrive from the server).
  void _normalizeExchangePair() {
    final sources = _sourceOptions;
    if (sources.isEmpty) return;
    if (!sources.contains(_sourceAsset)) _sourceAsset = sources.first;
    final targets = _targetOptionsFor(_sourceAsset);
    if (!targets.contains(_targetAsset)) _targetAsset = targets.first;
  }

  /// The source picked: the target follows it, and the amount starts at one exchange step.
  void _onSourceChanged(String source) {
    setState(() {
      _sourceAsset = source;
      final targets = _targetOptionsFor(source);
      if (!targets.contains(_targetAsset) && targets.isNotEmpty) _targetAsset = targets.first;
      final rule = EconomyRates.rule(_sourceAsset, _targetAsset);
      if (rule != null) _amountController.text = rule.step.toString();
    });
    _recalculateExchange();
  }

  // Mentor Market States
  int _selectedMentorMarketTab = 0; // 0: گزارش اعضا, 1: صرافی‌ها
  final Set<String> _expandedMemberAssetIds = {};
  final Set<String> _expandedExchangeIds = {};

  List<Map<String, dynamic>> _mentorMembersAssets = [];
  List<Map<String, dynamic>> _mentorExchangeRequests = [];

  // Sync state: the caravan the lists belong to, so switching caravans reloads them
  String? _loadedCaravanId;
  bool _marketLoading = true;
  bool _marketLoadFailed = false;
  int _marketLoadToken = 0;

  static int _asInt(dynamic v) => v is num ? v.toInt() : (int.tryParse(v?.toString() ?? '') ?? 0);

  /// Title of an exchange row: the stored note, or "N source → M target" built from the request.
  String _exchangeTitle(Map<String, dynamic> req) {
    final note = req['note']?.toString().trim() ?? '';
    if (note.isNotEmpty) return note;
    final source = req['sourceAsset']?.toString();
    final target = req['targetAsset']?.toString();
    if (source == null || target == null) return 'درخواست تبدیل دارایی';
    String label(String key) => AssetNames.of(key);
    return '${_asInt(req['sourceAmount']).toString().toPersianDigits()} ${label(source)} به '
        '${_asInt(req['targetAmount']).toString().toPersianDigits()} ${label(target)}';
  }

  String _formatPersianDate(dynamic date) {
    if (date == null) {
      final nowJ = Jalali.now();
      return '${nowJ.year}/${nowJ.month.toString().padLeft(2, '0')}/${nowJ.day.toString().padLeft(2, '0')}'.toPersianDigits();
    }
    try {
      final dt = date is DateTime ? date : DateTime.tryParse(date.toString());
      if (dt != null) {
        final j = Jalali.fromDateTime(dt);
        return '${j.year}/${j.month.toString().padLeft(2, '0')}/${j.day.toString().padLeft(2, '0')}'.toPersianDigits();
      }
    } catch (_) {}
    return date.toString().toPersianDigits();
  }

  /// Loads the members report and the exchanges of the caravan picked in the app.
  /// A newer call wins: a slow answer for a caravan the mentor already left is dropped.
  /// [quiet] (a balance changed somewhere) refreshes in place: no loading state, and a failure keeps the lists.
  Future<void> _loadMarketData({bool quiet = false}) async {
    final caravanId = Provider.of<AppRepository>(context, listen: false).selectedCaravanId;
    if (quiet && (_marketLoading || caravanId != _loadedCaravanId)) return;
    final token = ++_marketLoadToken;
    _loadedCaravanId = caravanId;
    if (mounted && !quiet) {
      setState(() {
        _marketLoading = true;
        _marketLoadFailed = false;
      });
    }
    try {
      final api = HttpApiService();
      final results = await Future.wait<dynamic>([
        api.getMentorCaravanProgress(caravanId: caravanId),
        api.getCaravanAssetConversions(caravanId: caravanId),
      ]);
      if (!mounted || token != _marketLoadToken) return;
      final progressData = results[0] as Map<String, dynamic>?;
      final exchangeData = results[1] as List<Map<String, dynamic>>;

      setState(() {
        _marketLoading = false;
        if (progressData == null) {
          if (!quiet) _marketLoadFailed = true;
        } else {
          _marketLoadFailed = false;
          final members = (progressData['members'] as List?) ?? const [];
          _mentorMembersAssets = members.whereType<Map<String, dynamic>>().map((m) => {
                ...m,
                'id': m['id']?.toString() ?? '',
                'name': m['name']?.toString() ?? 'عضو کاروان',
                'zarik': _asInt(m['zarik'] ?? m['zarikBalance']),
                'nakh': _asInt(m['nakh']),
                'farsh': _asInt(m['farsh']),
                'beyragh': _asInt(m['beyragh']),
              }).toList();
          _expandedMemberAssetIds.retainWhere((id) => _mentorMembersAssets.any((m) => m['id'] == id));
        }
        _mentorExchangeRequests = exchangeData.map((req) {
          final student = req['user'] as Map<String, dynamic>?;
          return <String, dynamic>{
            'id': req['id']?.toString() ?? '',
            'studentName': student?['name']?.toString() ?? 'دانش‌آموز',
            'studentAvatarUrl': student?['avatarUrl']?.toString() ?? '',
            'studentId': req['requestedBy']?.toString() ?? '',
            'title': _exchangeTitle(req),
            'date': _formatPersianDate(req['createdAt']),
            'status': req['status']?.toString() ?? 'completed',
            'createdAt': req['createdAt']?.toString() ?? '',
          };
        }).toList();
      });
    } catch (e) {
      debugPrint('Error loading market data: $e');
      if (mounted && token == _marketLoadToken && !quiet) {
        setState(() {
          _marketLoading = false;
          _marketLoadFailed = true;
        });
      }
    }
  }

  /// Pull to refresh: the leaderboard, plus the caravan's report (mentor) or the user's own assets
  /// and the rate sheet (student; refreshUser also reloads the economy rules).
  Future<void> _refreshAll() async {
    final repository = Provider.of<AppRepository>(context, listen: false);
    await Future.wait([
      _loadLeaderboards(),
      _isMentor ? _loadMarketData() : repository.refreshUser(),
    ]);
    if (mounted) _recalculateExchange();
  }

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_recalculateExchange);
    _recalculateExchange();
    if (_isMentor) _loadMarketData();
    _loadLeaderboards();
    AppRepository().scoresVersion.addListener(_onScoresChanged);
    MarketScreen.leaderboardRequests.addListener(_scrollToLeaderboard);
    // asked before this tab was first built
    if (MarketScreen.leaderboardRequests.value > 0) _scrollToLeaderboard();
  }

  @override
  void dispose() {
    MarketScreen.leaderboardRequests.removeListener(_scrollToLeaderboard);
    AppRepository().scoresVersion.removeListener(_onScoresChanged);
    _amountController.dispose();
    super.dispose();
  }

  /// Brings «برترین‌ها» (the last section) into view. It waits until this tab is the visible one and the
  /// lists above and in it have arrived: scrolling earlier landed on the rate sheet, or was undone when
  /// the content above grew, and people thought they were on the wrong page.
  void _scrollToLeaderboard([int attempt = 0]) {
    final request = MarketScreen.leaderboardRequests.value;
    if (request == _handledLeaderboardRequest) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || request != MarketScreen.leaderboardRequests.value) return;
      final target = _leaderboardKey.currentContext;
      final ready = target != null &&
          TickerMode.valuesOf(context).enabled && // the tab is the one on screen (IndexedStack mutes the hidden ones)
          _leaderboardsLoaded &&
          !(_isMentor && _marketLoading);
      if (!ready) {
        if (attempt < 40) Future.delayed(const Duration(milliseconds: 100), () => _scrollToLeaderboard(attempt + 1));
        if (target == null || attempt < 40) return;
      }
      _handledLeaderboardRequest = request;
      // Centred on the screen; a section taller than the screen starts at its title instead
      final box = target.findRenderObject() as RenderBox?;
      final viewport = Scrollable.maybeOf(target)?.position.viewportDimension ?? 0;
      final fits = box != null && box.hasSize && box.size.height < viewport;
      Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 550), curve: Curves.easeInOutCubic, alignment: fits ? 0.5 : 0.0);
    });
  }

  void _recalculateExchange() {
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    final rule = EconomyRates.rule(_sourceAsset, _targetAsset);

    setState(() {
      _calculatedResult = rule != null && amount > 0 ? (amount / rule.step) * rule.pays : 0.0;
    });
  }

  void _submitExchangeRequest() {
    setState(() => _activeActionButton = 1);
    final double amount = double.tryParse(_amountController.text) ?? 0.0;
    if (amount <= 0) {
      AppToast.error(context, 'لطفاً مقدار معتبری برای صرافی وارد کنید.');
      return;
    }

    final rule = EconomyRates.rule(_sourceAsset, _targetAsset);
    if (rule == null) {
      AppToast.error(context, 'تبدیل $_sourceAsset به $_targetAsset امکان‌پذیر نیست.');
      return;
    }
    if (amount % rule.step != 0) {
      AppToast.error(context, 'مقدار $_sourceAsset باید مضربی از ${rule.step.toString().toPersianDigits()} باشد.');
      return;
    }

    // Balance check: amount must not exceed the user's holdings
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    final double? balance = switch (_sourceAsset) {
      'زریک' => user.zarik.toDouble(),
      'کلاف' => user.nakh.toDouble(),
      'قالیچه' => user.farsh.toDouble(),
      _ => null,
    };
    if (balance != null && amount > balance) {
      AppToast.error(context, 'دارایی شما کافی نیست.');
      return;
    }

    final String amountStr = amount % 1 == 0 ? amount.toInt().toString() : amount.toString();
    final String resultStr = _calculatedResult % 1 == 0 ? _calculatedResult.toInt().toString() : _calculatedResult.toStringAsFixed(1);

    showNopaDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: NopaDialogContainer(
              maxWidth: 420,
              radius: 22,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top Header: Flame/Fire Icon in circle on top right in RTL + Title in center
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      // Fire/Flame Icon on Right in RTL
                      Align(
                        alignment: Alignment.centerRight,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFF3F3765),
                          ),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/svg_icons/fir01.svg',
                            width: 20,
                            height: 20,
                            fit: BoxFit.contain,
                            colorFilter: const ColorFilter.mode(
                              Color(0xFF8B88E8),
                              BlendMode.srcIn,
                            ),
                            errorBuilder: (context, error, stackTrace) => const Icon(
                              Icons.local_fire_department_rounded,
                              color: Color(0xFF8B88E8),
                              size: 20,
                            ),
                          ),
                        ),
                      ),

                      // Title in center
                      const Text(
                        'انجام صرافی',
                        style: AppTypography.h2,
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Row 1: ارائه: (Right pill, no fill) + Amount & Source asset (Left)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Right Pill in RTL (First child) - No fill color
                      Container(
                        width: 76,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF5A4E88),
                            width: 1.0,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'ارائه:',
                          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFE2E0F0)),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${amountStr.toPersianDigits()} $_sourceAsset',
                        style: AppTypography.h3Strong.copyWith(color: Color(0xFFE2E0F0)),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Row 2: خرید: (Right pill, no fill) + Result & Target asset (Left)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Right Pill in RTL (First child) - No fill color
                      Container(
                        width: 76,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF5A4E88),
                            width: 1.0,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'خرید:',
                          style: AppTypography.bodyLarge.copyWith(color: Color(0xFFE2E0F0)),
                        ),
                      ),

                      // Left Value in RTL (Second child)
                      Text(
                        '${resultStr.toPersianDigits()} $_targetAsset',
                        style: AppTypography.h3Strong.copyWith(color: Color(0xFFE2E0F0)),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Description text
                  Text(
                    'صرافی شما بلافاصله پس از تایید انجام می‌شود و اطلاعات آن برای راهبر شما ارسال خواهد شد. نیازی به تایید راهبر نیست.',
                    textAlign: TextAlign.justify,
                    style: AppTypography.caption.copyWith(color: Color(0xFFB3AFD0)),
                  ),

                  const SizedBox(height: 22),

                  // Bottom Action Buttons: ارسال (Right in RTL) & لغو (Left in RTL)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // ارسال on Right in RTL
                      TextButton(
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final repository = Provider.of<AppRepository>(context, listen: false);
                          final error = await HttpApiService().submitStudentAssetConversion(
                            sourceAsset: _sourceAsset,
                            targetAsset: _targetAsset,
                            sourceAmount: amount,
                            targetAmount: _calculatedResult,
                          );
                          if (mounted) {
                            if (error == null) {
                              AppToast.success(context, 'صرافی انجام شد و راهبر از آن مطلع شد');
                              repository.refreshUser();
                              _loadLeaderboards();
                            } else {
                              AppToast.error(context, error);
                            }
                          }
                        },
                        child: Text(
                          'انجام صرافی',
                          style: AppTypography.h3Strong.copyWith(color: AppColors.buttonCamel),
                        ),
                      ),

                      // لغو on Left in RTL
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: Text(
                          'لغو',
                          style: AppTypography.h3Strong.copyWith(color: AppColors.buttonCancelPurple),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _formatScore(dynamic value) {
    final n = (value is num) ? value.round() : (int.tryParse(value?.toString() ?? '') ?? 0);
    return n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  }

  int _leaderboardToken = 0;

  /// «برترین‌ها» from the server's shared ranking (the same order as the «رتبه» on chat profiles). Both lists
  /// load together; a slower, older answer never overwrites a newer one. A failed load keeps what is shown.
  Future<void> _loadLeaderboards() async {
    final token = ++_leaderboardToken;
    try {
      final api = HttpApiService();
      final results = await Future.wait([api.getWealthiestLeague(), api.getCaravanLeague(sortBy: 'wealth')]);
      final members = results[0];
      final caravans = results[1];
      if (!mounted || token != _leaderboardToken) return;
      setState(() {
        if (members.isNotEmpty || _memberIds.isEmpty) {
          _memberIds = members.map((m) => m['id']?.toString() ?? '').toList();
          // each asset held (the real capital), then its value in zarik (the server's capitalValue: کلاف counts only
          // once turned into قالیچه; درفش is not money)
          final rows = members.map((m) => <String, dynamic>{
                'name': m['name']?.toString() ?? '-',
                'avatarUrl': m['avatarUrl']?.toString() ?? '',
                'assets': <String, int>{
                  'zarik': _asInt(m['zarikBalance']),
                  'nakh': _asInt(m['nakh']),
                  'farsh': _asInt(m['farsh']),
                  'derafsh': _asInt(m['beyragh']),
                },
                'total': _asInt(m['capital'] ?? m['zarikBalance']),
              }).toList();
          _topMembers = rows.take(3).toList();
          _memberRows = {for (var i = 0; i < rows.length; i++) _memberIds[i]: rows[i]};
        }
        if (caravans.isNotEmpty || _caravanIds.isEmpty) {
          _caravanIds = caravans.map((c) => c['id']?.toString() ?? '').toList();
          // the sum of each asset over the members, the caravan's banners and their points, the total value, and the
          // value per member (what ranks them; equal values: the banner points)
          final rows = caravans.map((c) {
            final assets = c['assets'] is Map ? c['assets'] as Map : const {};
            return <String, dynamic>{
              'name': c['name']?.toString() ?? '-',
              'avatarUrl': c['coverImageUrl']?.toString() ?? '',
              'assets': <String, int>{
                'zarik': _asInt(assets['zarik']),
                'nakh': _asInt(assets['nakh']),
                'farsh': _asInt(assets['farsh']),
                'derafsh': _asInt(assets['beyragh']),
              },
              'bannerPoints': _asInt(c['bannerPoints']),
              'total': _asInt(c['totalWealth']),
              'average': _asInt(c['averageWealth']),
            };
          }).toList();
          _topCaravans = rows.take(3).toList();
          _caravanRows = {for (var i = 0; i < rows.length; i++) _caravanIds[i]: rows[i]};
        }
      });
    } catch (e) {
      debugPrint('Error loading leaderboards: $e');
    } finally {
      if (token == _leaderboardToken) _leaderboardsLoaded = true;
    }
  }

  /// Someone's holdings changed (AppRepository.scoresVersion): the rankings and the mentor's members report follow.
  void _onScoresChanged() {
    if (!mounted) return;
    _loadLeaderboards();
    if (_isMentor) _loadMarketData(quiet: true);
  }

  void _contactMentor() {
    setState(() => _activeActionButton = 2);
    contactMentor(context, Provider.of<AppRepository>(context, listen: false).currentUser);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        final user = repository.currentUser;
        final bool isMentor = _isMentor;

        // The mentor switched caravans (or the caravan list arrived after the first load): resync
        if (isMentor && _loadedCaravanId != null && repository.selectedCaravanId != _loadedCaravanId) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadMarketData();
          });
          _loadedCaravanId = repository.selectedCaravanId;
        }

        return RefreshIndicator(
          onRefresh: _refreshAll,
          child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Centered Page Title: "بازارچه"
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'بازارچه',
                  style: AppTypography.h1,
                ),
              ),
              if (isMentor)
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: 20),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      repository.selectedCaravanName,
                      style: AppTypography.h3.copyWith(color: const Color(0xFF9E9AC0).withValues(alpha: 0.9)),
                    ),
                  ),
                ),
              const SizedBox(height: 18),

              // 2. Section 1: نرخنامه (Rate Sheet Cards)
              _buildRateSheetSection(),
              const SizedBox(height: 24),

              // 3. Section 2: سرمایه های شما (Your Capital - only for student)
              if (!isMentor) ...[
                _buildAssetsSection(user),
                const SizedBox(height: 20),
                _buildMarketDescription(),
                const SizedBox(height: 24),
              ],

              // 4. Section 3: صرافی (for students) or گزارش اعضا و صرافی‌ها (for mentor)
              if (isMentor)
                _buildMentorMarketSection()
              else
                _buildExchangePanel(),
              const SizedBox(height: 26),

              // 5. Section 4: برترین ها (لیگ / لیدربورد)
              KeyedSubtree(
                key: _leaderboardKey,
                child: _buildLeaderboardSection(user, myCaravanId: isMentor ? repository.selectedCaravanId : user.caravanId),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
        );
      },
    );
  }

  /// Section 1: نرخنامه - Cards based on Home Station Cards with gallery SVG and divider line
  Widget _buildRateSheetSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'نرخنامه',
              style: AppTypography.h2,
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 145,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              itemCount: _rateItems.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = _rateItems[index];
                return NopaEntrance(entranceKey: 'market-rate:$index', index: index, child: _buildRateCard(item));
              },
            ),
          ),
        ),
      ],
    );
  }

  /// Single Rate Sheet Card matching Station Card design with gradient divider line
  Widget _buildRateCard(Map<String, dynamic> item) {
    return Container(
      width: 106,
      height: 145,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
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
            blurRadius: 12,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border width
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18.8),
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
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18.8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Upper Content: Gallery SVG Icon + Item Title
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // the asset's picture set in the panel («تصاویر اپلیکیشن»), otherwise its built-in icon
                    AssetIcon(AssetIcon.keyOfLabel(item['assetKey'] as String), size: 34),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        AssetNames.labelFor(item['title'] as String),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: AppTypography.h3,
                      ),
                    ),
                  ],
                ),
              ),

              // 2. Middle Divider Line matching Station Cards in Home
              Container(
                height: 1.2,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    stops: [0.0, 0.5, 1.0],
                    colors: [
                      Color(0xFF3A3A6A),
                      Color(0xFF9292E2),
                      Color(0xFF3A3A6A),
                    ],
                  ),
                ),
              ),

              // 3. Bottom Footer Pill: Price Tag (e.g. 500 زریک, 5 نخ, غیر قابل خرید)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 5.5, horizontal: 4),
                decoration: const BoxDecoration(
                  color: Color(0xFF23223D),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(18.8)),
                ),
                child: Center(
                  child: Text(
                    (item['priceText'] as String).toPersianDigits(),
                    textAlign: TextAlign.center,
                    style: AppTypography.caption.copyWith(color: Color(0xFFD6D3E6)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Section 2: سرمایه های شما (student only; the mentor sees caravan totals under گزارش اعضا)
  Widget _buildAssetsSection(UserModel? user) {
    const title = 'سرمایه‌های شما';
    final int totalZarik = user?.zarik ?? 0;
    final int totalNakh = user?.nakh ?? 0;
    final int totalFarsh = user?.farsh ?? 0;

    final zarikVal = totalZarik.toPersian();
    // Two different things, shown apart: the caravan's banners (won by the caravan) and the member's own
    final beyrahVal = Provider.of<AppRepository>(context).caravanBannerTotal.toPersian();
    final personalBannersVal = (user?.beyragh ?? 0).toPersian();
    final nakhVal = totalNakh.toPersian();
    final farshVal = totalFarsh.toPersian();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              title,
              style: AppTypography.h2,
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 44,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                _buildAssetPill(
                  assetKey: 'zarik',
                  label: AssetNames.labelFor('زریک'),
                  value: zarikVal,
                  isGold: _selectedAssetIndex == 0,
                  onTap: () => setState(() => _selectedAssetIndex = 0),
                ),
                const SizedBox(width: 10),
                // The member's own banners: the same number the panel shows on their wallet
                _buildAssetPill(
                  assetKey: 'derafsh',
                  label: AssetNames.labelFor('درفش'),
                  value: personalBannersVal,
                  isGold: _selectedAssetIndex == 4,
                  onTap: () => setState(() => _selectedAssetIndex = 4),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  assetKey: 'derafsh',
                  // the banners the caravan won (the dialog lists them), not the member's own
                  label: '${AssetNames.labelFor('درفش')} کاروان',
                  value: beyrahVal,
                  isGold: _selectedAssetIndex == 1,
                  onTap: () {
                    setState(() => _selectedAssetIndex = 1);
                    CaravanBannersDialog.show(context, Provider.of<AppRepository>(context, listen: false).caravanBanners);
                  },
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  assetKey: 'nakh',
                  label: AssetNames.labelFor('کلاف'),
                  value: nakhVal,
                  isGold: _selectedAssetIndex == 2,
                  onTap: () => setState(() => _selectedAssetIndex = 2),
                ),
                const SizedBox(width: 10),
                _buildAssetPill(
                  assetKey: 'farsh',
                  label: AssetNames.labelFor('قالیچه'),
                  value: farshVal,
                  isGold: _selectedAssetIndex == 3,
                  onTap: () => setState(() => _selectedAssetIndex = 3),
                ),
              ],
            ),
          ),
        ),
        // What these holdings are worth for the ranking (the server's formula: zarik + farsh × its price)
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: 'ارزش سرمایه‌ی شما: ', style: AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB))),
                TextSpan(
                  text: '${_formatScore(totalZarik + totalFarsh * EconomyRates.farshSalePrice).toPersianDigits()} ${AssetNames.of('zarik')}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFFFD580), fontWeight: FontWeight.w800),
                ),
                if (user != null && _memberIds.contains(user.id))
                  TextSpan(
                    text: '   رتبه‌ی شما: ${(_memberIds.indexOf(user.id) + 1).toString().toPersianDigits()}',
                    style: AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB)),
                  ),
              ]),
            ),
          ),
        ),
      ],
    );
  }

  /// Mentor Market Section: [گزارش اعضا] & [صرافی‌ها]
  Widget _buildMentorMarketSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: NopaPillTabs<int>(
            selected: _selectedMentorMarketTab,
            tabs: const [
              NopaPillTab<int>(0, 'گزارش اعضا'),
              NopaPillTab<int>(1, 'صرافی‌ها'),
            ],
            onChanged: (v) => setState(() => _selectedMentorMarketTab = v),
          ),
        ),

        const SizedBox(height: 16),

        // Content based on tab
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: _selectedMentorMarketTab == 0
              ? _buildMentorMembersReportList()
              : _buildMentorExchangesList(),
        ),
      ],
    );
  }

  /// List of Member Assets for Mentor
  /// Loading, failure and empty placeholder shared by the members report and the exchanges list.
  Widget? _marketStatusPlaceholder({required bool isEmpty, required String emptyText}) {
    if (_marketLoading && isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4))),
      );
    }
    if (!_marketLoadFailed && !isEmpty) return null;
    final failed = _marketLoadFailed;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: [
          Text(
            failed ? 'دریافت اطلاعات بازارچه ناموفق بود.' : emptyText,
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium.copyWith(color: Color(0xFFB3AFD0)),
          ),
          if (failed)
            TextButton(
              onPressed: _loadMarketData,
              child: Text(
                'تلاش دوباره',
                style: AppTypography.h3.copyWith(color: AppColors.buttonCamel),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMentorMembersReportList() {
    final placeholder = _marketStatusPlaceholder(
      isEmpty: _mentorMembersAssets.isEmpty,
      emptyText: 'هنوز عضوی در این کاروان نیست.',
    );
    if (placeholder != null && _mentorMembersAssets.isEmpty) return placeholder;

    int totalZarik = 0;
    int totalNakh = 0;
    int totalFarsh = 0;
    int totalBeyragh = 0;
    for (final m in _mentorMembersAssets) {
      totalZarik += (m['zarik'] as int? ?? 0);
      totalNakh += (m['nakh'] as int? ?? 0);
      totalFarsh += (m['farsh'] as int? ?? 0);
    }
    // درفش here is the caravan's (the banners it won), never the sum of the members' personal ones
    totalBeyragh = Provider.of<AppRepository>(context).caravanBannerTotal;
    // The caravan's totals as «برترین کاروان‌ها» counts them (درفش also counts the banners the caravan itself won)
    final caravan = Provider.of<AppRepository>(context).selectedCaravan;
    if (caravan != null && caravan.id == _loadedCaravanId) {
      totalZarik = caravan.totalZarik;
      totalNakh = caravan.totalNakh;
      totalFarsh = caravan.totalFarsh;
      totalBeyragh = caravan.totalBeyragh;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _mentorMembersAssets.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final member = _mentorMembersAssets[index];
            final memberId = member['id'] as String;
            final isExpanded = _expandedMemberAssetIds.contains(memberId);

            return NopaEntrance(entranceKey: 'market-member:$memberId', index: index, child: _buildMentorMemberAssetCard(member, memberId, isExpanded));
          },
        ),
        const SizedBox(height: 14),
        // Compact textual summary of total assets under member reports box
        Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFF282548).withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF6C649B).withValues(alpha: 0.28),
                width: 0.9,
              ),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceAround,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 6,
              children: [
                Text(
                  'مجموع سرمایه‌ها:',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB)),
                ),
                Text(
                  'زریک: ${totalZarik.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFFFD54F)),
                ),
                Text(
                  '${AssetNames.labelFor('کلاف')}: ${totalNakh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFF81D4FA)),
                ),
                Text(
                  '${AssetNames.labelFor('قالیچه')}: ${totalFarsh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFA5D6A7)),
                ),
                Text(
                  '${AssetNames.labelFor('درفش')} کاروان: ${totalBeyragh.toString().toPersian()}',
                  style: AppTypography.caption.copyWith(color: const Color(0xFFFFAB91)),
                ),
              ],
            ),
          ),
        ),
        if (caravan != null && caravan.id == _loadedCaravanId) ...[
          const SizedBox(height: 8),
          CaravanStandingSummary(caravan: caravan),
        ],
      ],
    );
  }

  Widget _buildMentorMemberAssetCard(Map<String, dynamic> member, String memberId, bool isExpanded) {
    final name = member['name']?.toString() ?? 'عضو کاروان';
    final zarik = _asInt(member['zarik']).toString();
    final derafsh = _asInt(member['beyragh']).toString();
    final nakh = _asInt(member['nakh']).toString();
    final farsh = _asInt(member['farsh']).toString();

    return Container(
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
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border matching Mentor Station
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Member Header (Capsule gradient surface matching Mentor Station)
            TapExpander(child: InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedMemberAssetIds.remove(memberId);
                  } else {
                    _expandedMemberAssetIds.add(memberId);
                  }
                });
              },
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.vertical(top: Radius.circular(14.8))
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
                  border: isExpanded
                      ? const Border(
                          bottom: BorderSide(
                            color: Color(0xFF282542),
                            width: 1.0,
                          ),
                        )
                      : null,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right side in RTL: Avatar + Name
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SafeAvatar(imageUrl: member['avatarUrl']?.toString(), name: name, radius: 15),
                          const SizedBox(width: 8),
                          Text(
                            name,
                            style: AppTypography.h3,
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: "ارتباط" Button + Chevron
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TapExpander(child: GestureDetector(
                            onTap: () {
                              if (Provider.of<AppRepository>(context, listen: false).currentUser.chatEnabled) {
                                openChatWithUser(context, memberId);
                              } else {
                                Navigator.pushNamed(context, AppRoutes.tickets);
                              }
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: AppColors.strokeGradient,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              padding: const EdgeInsets.all(AppColors.borderWidth),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                                decoration: BoxDecoration(
                                  gradient: AppColors.darkSurfaceGradient,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: Text(
                                  'ارتباط',
                                  style: AppTypography.caption.copyWith(color: Color(0xFFC7B299)),
                                ),
                              ),
                            ),
                          )),
                          const SizedBox(width: 8),
                          Icon(
                            isExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: const Color(0xFFDDD9EE),
                            size: 20,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            )),

            // Expanded Asset Values Row (Matching Dark Body style)
            if (isExpanded)
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF1B192A),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMemberAssetChip(AssetNames.labelFor('زریک'), zarik),
                      _buildMemberAssetChip(AssetNames.labelFor('درفش'), derafsh),
                      _buildMemberAssetChip(AssetNames.labelFor('کلاف'), nakh),
                      _buildMemberAssetChip(AssetNames.labelFor('قالیچه'), farsh),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMemberAssetChip(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFFDFB690),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          '$label: ',
          style: AppTypography.caption.copyWith(color: Colors.white.withValues(alpha: 0.6)),
        ),
        Text(
          value,
          style: AppTypography.caption,
        ),
      ],
    );
  }

  /// List of Student Exchange Requests for Mentor
  Widget _buildMentorExchangesList() {
    if (_mentorExchangeRequests.isEmpty) {
      return _marketStatusPlaceholder(isEmpty: true, emptyText: 'هیچ صرافی‌ای ثبت نشده است')!;
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _mentorExchangeRequests.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final request = _mentorExchangeRequests[index];
        final reqId = request['id'] as String;
        final isExpanded = _expandedExchangeIds.contains(reqId);

        return _buildMentorExchangeCard(request, reqId, isExpanded);
      },
    );
  }

  Widget _buildMentorExchangeCard(Map<String, dynamic> request, String reqId, bool isExpanded) {
    final studentName = request['studentName'] as String;
    final title = request['title'] as String;
    final date = request['date'] as String;
    final status = request['status'] as String;
    // Mentor may cancel a completed exchange only within 24h of its creation
    final createdAt = DateTime.tryParse(request['createdAt'] as String? ?? '');
    final canCancel = status == 'completed' &&
        createdAt != null &&
        DateTime.now().difference(createdAt) < const Duration(hours: 24);

    return Container(
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
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border matching Mentor Station
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14.8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Row (صرافی سمت راست، نام فرد سمت چپ)
            TapExpander(child: InkWell(
              onTap: () {
                setState(() {
                  if (isExpanded) {
                    _expandedExchangeIds.remove(reqId);
                  } else {
                    _expandedExchangeIds.add(reqId);
                  }
                });
              },
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: isExpanded
                      ? const BorderRadius.vertical(top: Radius.circular(14.8))
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
                  border: isExpanded
                      ? const Border(
                          bottom: BorderSide(
                            color: Color(0xFF282542),
                            width: 1.0,
                          ),
                        )
                      : null,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right side in RTL: صرافی (آیکون صرافی + عنوان صرافی)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: const Color(0xFF4A382A),
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(
                                color: AppColors.buttonCamel.withValues(alpha: 0.5),
                                width: 1,
                              ),
                            ),
                            child: const Icon(
                              Icons.swap_horiz_rounded,
                              color: Color(0xFFDFB690),
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            title,
                            style: AppTypography.bodyLarge,
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: نام فرد + آیکون + فلش آکاردئونی
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SafeAvatar(imageUrl: request['studentAvatarUrl']?.toString(), name: studentName, radius: 12),
                          const SizedBox(width: 6),
                          Text(
                            studentName,
                            style: AppTypography.bodyMedium.copyWith(color: Colors.white.withValues(alpha: 0.9)),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            isExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: const Color(0xFFDDD9EE),
                            size: 20,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            )),

            // Expanded Body: تاریخ سمت راست، تایید و رد و توضیح سمت چپ
            if (isExpanded)
              Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF1B192A),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14.8)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Row(
                    children: [
                      // 1. Right side in RTL: تاریخ
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFFDFB690),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'تاریخ: $date',
                            style: AppTypography.caption.copyWith(color: Colors.white.withValues(alpha: 0.6)),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // 2. Left side in RTL: وضعیت صرافی و دکمه لغو (فقط مشاهده؛ تایید لازم نیست)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (status == 'cancelled')
                            Text(
                              'لغو شد',
                              style: AppTypography.caption.copyWith(color: Colors.redAccent.withValues(alpha: 0.9)),
                            )
                          else ...[
                            Text(
                              'انجام شد',
                              style: AppTypography.caption.copyWith(color: Colors.greenAccent.withValues(alpha: 0.85)),
                            ),
                            if (canCancel) ...[
                              const SizedBox(width: 10),
                              TapExpander(child: GestureDetector(
                                onTap: () {
                                  _showRejectExplanationDialog(
                                    memberName: studentName,
                                    requestDate: date,
                                    requestSubject: 'لغو صرافی: $title',
                                    onConfirmReject: (reason) async {
                                      if (!mounted) return;
                                      // Shown as cancelled at once; sent only if not undone within the undo time
                                      final previousStatus = request['status'];
                                      setState(() => request['status'] = 'cancelled');
                                      AppToast.undoable(
                                        context,
                                        'صرافی لغو و سرمایه‌ها به دانش‌آموز بازگردانده شد.',
                                        commit: () async {
                                          final error = await HttpApiService().cancelCaravanAssetConversion(reqId, reason: reason);
                                          if (mounted) _loadMarketData();
                                          return error;
                                        },
                                        onUndo: () {
                                          if (mounted) setState(() => request['status'] = previousStatus);
                                        },
                                      );
                                    },
                                  );
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                                  decoration: BoxDecoration(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: const Color(0xFF7B75AF).withValues(alpha: 0.8),
                                      width: 1,
                                    ),
                                  ),
                                  child: Text(
                                    'لغو صرافی',
                                    style: AppTypography.caption.copyWith(color: Color(0xFFDCD7F5)),
                                  ),
                                ),
                              )),
                            ],
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Reject & Explain Dialog matching Image 2
  void _showRejectExplanationDialog({
    required String memberName,
    required String requestDate,
    required String requestSubject,
    required void Function(String reason) onConfirmReject,
  }) {
    final TextEditingController explanationController = TextEditingController();

    showNopaModal<void>(
      context,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      builder: (BuildContext ctx) {
        return NopaModalShell(
          maxWidth: 420,
          headerIcon: Icons.shield_outlined,
          title: 'پیام به دانش آموز',
          padding: const EdgeInsets.all(22),
          actions: [
            NopaModalAction(
              label: 'ارسال',
              onPressed: () {
                Navigator.pop(ctx);
                onConfirmReject(explanationController.text.trim());
              },
            ),
            NopaModalAction(
              label: 'لغو',
              variant: NopaModalActionVariant.secondary,
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
                  // Field 1: نام و نام خانوادگی
                  _buildDialogField(
                    label: 'نام و نام خانوادگی',
                    value: memberName,
                  ),
                  const SizedBox(height: 12),

                  // Field 2: تاریخ
                  _buildDialogField(
                    label: 'تاریخ',
                    value: requestDate,
                  ),
                  const SizedBox(height: 12),

                  // Field 3: موضوع:
                  _buildDialogField(
                    label: 'موضوع:',
                    value: requestSubject,
                  ),
                  const SizedBox(height: 12),

                  // Field 4: شرح دهید: (Multiline)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 90,
                        child: Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'شرح دهید:',
                            style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Container(
                          height: 110,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E1A38),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFF4C4578),
                              width: 1.0,
                            ),
                          ),
                          child: TextField(
                            controller: explanationController,
                            maxLines: 4,
                            style: AppTypography.bodyMedium,
                            decoration: InputDecoration(
                              isDense: true,
                              hintText: 'توضیحات تان درمورد تصمیم تان را برای عضو مورد نظر بنویسید',
                              hintStyle: AppTypography.caption.copyWith(color: Color(0xFF8882A8)),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

            ],
          ),
        );
      },
    );
  }

  Widget _buildDialogField({required String label, required String value}) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
          ),
        ),
        Expanded(
          child: Container(
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A38),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: const Color(0xFF4C4578),
                width: 1.0,
              ),
            ),
            child: Text(
              value,
              style: AppTypography.h3Strong,
            ),
          ),
        ),
      ],
    );
  }


  Widget _buildAssetPill({
    required String assetKey,
    required String label,
    required String value,
    required bool isGold,
    required VoidCallback onTap,
  }) {
    return TapExpander(child: GestureDetector(
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
                // Right: the asset's icon, as on the home screens (bottom bar style, or the picture set in the panel)
                AssetIcon(assetKey, size: 24, color: isGold ? const Color(0xFF653A18) : const Color(0xFFDFB690)),
                const SizedBox(width: 8),
                // Middle: Label
                Text(
                  label,
                  style: AppTypography.h3,
                ),
                const SizedBox(width: 16),
                // Left: Value
                Text(
                  value,
                  style: AppTypography.h3,
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
        ),
      ),
    ));
  }

  /// Section 3: صرافی - Purple Box based on Station Card with black selector boxes and responsive layout
  Widget _buildExchangePanel() {
    _normalizeExchangePair();
    final String resultDisplay = _calculatedResult % 1 == 0
        ? _calculatedResult.toInt().toString().toPersianDigits()
        : _calculatedResult.toStringAsFixed(1).toPersianDigits();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'صرافی',
              style: AppTypography.h2,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18.0),
          child: Container(
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
              padding: const EdgeInsets.all(14),
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
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final bool isCompact = constraints.maxWidth < 460;

                    if (isCompact) {
                      // Compact mobile layout: Inputs on top -> Description -> Action Buttons on bottom
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // 1. Inputs Section
                          _buildExchangeInputsSection(resultDisplay),
                          const SizedBox(height: 10),
                          _buildAllowedExchangesNote(),
                          const SizedBox(height: 10),

                          // 2. Description text
                          Text(
                            'پس از تعیین مقدار صرافی، دکمه‌ی انجام صرافی را بزنید. صرافی بلافاصله انجام می‌شود و اطلاعات آن برای راهبر ارسال می‌شود؛ نیازی به تایید راهبر نیست.',
                            textAlign: TextAlign.justify,
                            style: AppTypography.caption.copyWith(color: Color(0xFFC7C5DD)),
                          ),
                          const SizedBox(height: 14),

                          // 3. Buttons Row
                          Row(
                            children: [
                              Expanded(
                                child: _buildInteractiveActionButton(
                                  text: 'ارتباط با راهبر',
                                  isActive: _activeActionButton == 2,
                                  strokeBorderColor: const Color(0xFF6E688E),
                                  onTap: _contactMentor,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _buildInteractiveActionButton(
                                  text: 'انجام صرافی',
                                  isActive: _activeActionButton == 1,
                                  strokeBorderColor: AppColors.buttonCamel,
                                  onTap: _submitExchangeRequest,
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    }

                    // Wider screen layout: 2 balanced columns matching reference screenshot
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Left in RTL (Description text on top + 2 action buttons on bottom)
                        Expanded(
                          flex: 5,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Padding(
                                padding: EdgeInsets.only(left: 6.0, top: 2.0),
                                child: Text(
                                  'پس از تعیین مقدار صرافی، دکمه‌ی انجام صرافی را بزنید. صرافی بلافاصله انجام می‌شود و اطلاعات آن برای راهبر ارسال می‌شود؛ نیازی به تایید راهبر نیست.',
                                  textAlign: TextAlign.justify,
                                  style: AppTypography.caption.copyWith(color: Color(0xFFC7C5DD)),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildInteractiveActionButton(
                                      text: 'ارتباط با راهبر',
                                      isActive: _activeActionButton == 2,
                                      strokeBorderColor: const Color(0xFF6E688E),
                                      onTap: _contactMentor,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _buildInteractiveActionButton(
                                      text: 'انجام صرافی',
                                      isActive: _activeActionButton == 1,
                                      strokeBorderColor: AppColors.buttonCamel,
                                      onTap: _submitExchangeRequest,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),

                        // Right in RTL (Selectors & Amount inputs)
                        Expanded(
                          flex: 6,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildExchangeInputsSection(resultDisplay),
                              const SizedBox(height: 10),
                              _buildAllowedExchangesNote(),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Right-side Inputs Section (سرمایه ارائه شده & سرمایه درخواستی)
  Widget _buildExchangeInputsSection(String resultDisplay) {
    return Column(
      children: [
        // Row 1: سرمایه ارائه شده
        Row(
          children: [
            SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nارائه شده',
                style: AppTypography.caption.copyWith(color: Colors.white70),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              flex: 5,
              child: _buildAssetDropdown(
                value: _sourceAsset,
                options: _sourceOptions,
                onChanged: (val) {
                  if (val != null) _onSourceChanged(val);
                },
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'مقدار',
              style: AppTypography.caption.copyWith(color: Colors.white70),
            ),
            const SizedBox(width: 4),
            _buildAmountInputBox(),
          ],
        ),

        const SizedBox(height: 10),

        // Row 2: سرمایه درخواستی
        Row(
          children: [
            SizedBox(
              width: 58,
              child: Text(
                'سرمایه\nدرخواستی',
                style: AppTypography.caption.copyWith(color: Colors.white70),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              flex: 5,
              child: _buildAssetDropdown(
                value: _targetAsset,
                options: _targetOptionsFor(_sourceAsset),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _targetAsset = val);
                    _recalculateExchange();
                  }
                },
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'مقدار',
              style: AppTypography.caption.copyWith(color: Colors.white70),
            ),
            const SizedBox(width: 4),
            _buildResultBox(resultDisplay),
          ],
        ),
      ],
    );
  }

  /// Dark Asset Selector Dropdown Box matching notification and login dark surface styling
  Widget _buildAssetDropdown({
    required String value,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            dropdownColor: const Color(0xFF1E1633),
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFFC7B299), size: 18),
            isDense: true,
            style: AppTypography.bodyLarge,
            items: options.map((asset) {
              return DropdownMenuItem<String>(
                value: asset,
                child: Text(AssetNames.labelFor(asset), style: AppTypography.bodyMedium),
              );
            }).toList(),
            onChanged: onChanged,
          ),
        ),
      ),
    );
  }

  /// Small line in the exchange box listing the exchanges open to users, e.g. «کلاف به قالیچه و قالیچه به زریک».
  Widget _buildAllowedExchangesNote() {
    final pairs = <String>[
      for (final s in _sourceOptions)
        for (final t in _targetOptionsFor(s)) '${AssetNames.labelFor(s)} به ${AssetNames.labelFor(t)}',
    ];
    if (pairs.isEmpty) return const SizedBox.shrink();
    final list = pairs.length == 1 ? pairs.first : '${pairs.sublist(0, pairs.length - 1).join('، ')} و ${pairs.last}';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(Icons.info_outline_rounded, size: 13, color: Color(0xFFC7B299)),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            'فعلاً فقط تبدیل $list ممکن است.',
            style: AppTypography.caption.copyWith(color: const Color(0xFFC7B299), fontSize: 11),
          ),
        ),
      ],
    );
  }

  /// «توضیحات» under the capital, plain text like the station page's description.
  Widget _buildMarketDescription() {
    final zarik = AssetNames.of('zarik');
    final nakh = AssetNames.of('nakh');
    final farsh = AssetNames.of('farsh');
    final derafsh = AssetNames.of('derafsh');
    final price = EconomyRates.farshSalePrice.toPersian();
    final text = 'اینجا جایی است که شما می‌توانید ارزش اموالتان را با تبدیل آن‌ها ارزشمندتر کنید. '
        'شما می‌توانید پس از شرکت در چالش‌های گروهی‌تان $nakh دریافت کنید و آن‌ها را به $farsh تبدیل کنید. '
        'هر $farsh $price $zarik ارزش دارد. '
        '$nakh تا وقتی به $farsh تبدیل نشود در ارزش سرمایه و رتبه‌ی شما حساب نمی‌شود. '
        'همچنین شما با شرکت در چالش‌های فراگروهی و دریافت $derafsh‌ها می‌توانید $zarik‌های فراوانی دریافت کنید '
        'که رتبه‌ی شما و کاروانتان را افزایش می‌دهد. '
        'در مسیر سفر می‌توانید سوغاتی‌ها و قابلیت‌های مختلفی را که کم‌کم به بازار خواهند آمد بخرید. '
        'پس کمی صبوری کنید و سعی کنید ارزش سرمایه‌هایتان را افزایش دهید تا نزد علاءالملک رتبه‌ی بالاتری داشته باشید.';
    final style = AppTypography.caption.copyWith(color: const Color(0xFFD3D0E3));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('توضیحات', textAlign: TextAlign.right, style: AppTypography.h2),
            const SizedBox(height: 6),
            LayoutBuilder(
              builder: (context, constraints) {
                final painter = TextPainter(
                  text: TextSpan(text: text, style: style),
                  textDirection: TextDirection.rtl,
                  maxLines: 6,
                )..layout(maxWidth: constraints.maxWidth);
                final long = painter.didExceedMaxLines;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      text,
                      textAlign: TextAlign.justify,
                      maxLines: long && !_isDescriptionExpanded ? 6 : null,
                      overflow: long && !_isDescriptionExpanded ? TextOverflow.ellipsis : null,
                      style: style,
                    ),
                    if (long) ...[
                      const SizedBox(height: 2),
                      TapExpander(
                        child: GestureDetector(
                          onTap: () => setState(() => _isDescriptionExpanded = !_isDescriptionExpanded),
                          child: Text(
                            _isDescriptionExpanded ? 'بستن (کمتر)' : 'بیشتر...',
                            style: AppTypography.captionGold.copyWith(decoration: TextDecoration.underline),
                          ),
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  /// Dark Amount Input Box matching notification action button style
  Widget _buildAmountInputBox() {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: AppTypography.h3,
          decoration: const InputDecoration(
            isDense: true,
            contentPadding: EdgeInsets.zero,
            border: InputBorder.none,
          ),
        ),
      ),
    );
  }

  /// Dark Result Box matching notification action button style
  Widget _buildResultBox(String resultText) {
    return Container(
      width: 54,
      height: 38,
      decoration: BoxDecoration(
        gradient: AppColors.strokeGradient,
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(AppColors.borderWidth),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppColors.darkSurfaceGradient,
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: Text(
          resultText,
          style: AppTypography.h3.copyWith(color: Color(0xFFFFD580)),
        ),
      ),
    );
  }

  /// Interactive Action Button: Stroke border initially, becomes filled/colored when active/pressed
  Widget _buildInteractiveActionButton({
    required String text,
    required bool isActive,
    required Color strokeBorderColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: TapExpander(child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 42,
          decoration: BoxDecoration(
            gradient: isActive ? AppColors.accentGradient : null,
            color: isActive ? null : const Color(0xFF282842),
            borderRadius: BorderRadius.circular(10),
            border: isActive
                ? null
                : Border.all(
                    color: strokeBorderColor,
                    width: 1.2,
                  ),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: const Color(0xFFC7844E).withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              text,
              style: AppTypography.h3.copyWith(color: isActive ? Colors.white : const Color(0xFFD6D7E5)),
            ),
          ),
        ),
      )),
    );
  }

  /// Section 4: برترین ها (لیگ) - Top 3 Podium & Leaderboard Switcher
  Widget _buildLeaderboardSection(UserModel? user, {String? myCaravanId}) {
    // Top 3 of the selected tab, read from the leaderboard API (padded when fewer than 3 exist)
    const podiumColors = [Color(0xFFFFD580), Color(0xFFCBD5E1), Color(0xFFC8824C)];
    const podiumSizes = [92.0, 78.0, 72.0];
    final bool isMembersTab = _selectedLeaderboardTab == 0;
    final source = isMembersTab ? _topMembers : _topCaravans;
    final currentList = List<Map<String, dynamic>>.generate(3, (i) {
      final bool hasItem = i < source.length;
      return {
        'rank': i + 1,
        'name': hasItem ? source[i]['name'] : '-',
        'assets': hasItem ? source[i]['assets'] : null,
        'total': hasItem ? source[i]['total'] : null,
        'average': hasItem ? source[i]['average'] : null,
        'bannerPoints': hasItem ? source[i]['bannerPoints'] : null,
        // Members show their own picture, caravans the one their mentor chose; otherwise the placeholder
        'avatarUrl': hasItem ? (source[i]['avatarUrl'] ?? '') : '',
        'color': podiumColors[i],
        'borderColor': podiumColors[i],
        'size': podiumSizes[i],
      };
    });
    final firstPlace = currentList[0];
    final secondPlace = currentList[1];
    final thirdPlace = currentList[2];

    final List<String> rankedIds = isMembersTab ? _memberIds : _caravanIds;
    final String? myId = isMembersTab ? user?.id : myCaravanId;
    final int myIndex = myId == null ? -1 : rankedIds.indexOf(myId);
    final String totalText = rankedIds.length.toString();
    final String myRankText = myIndex >= 0 ? (myIndex + 1).toString() : '-';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Header Title: "برترین ها"
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20.0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              'برترین‌ها',
              style: AppTypography.h2,
            ),
          ),
        ),
        const SizedBox(height: 8),

        // 2. Tab switcher (shared segmented style)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: NopaPillTabs<int>(
            expand: true,
            selected: _selectedLeaderboardTab,
            tabs: const [
              NopaPillTab<int>(0, 'برترین شرکت کننده‌ها'),
              NopaPillTab<int>(1, 'برترین کاروان‌ها'),
            ],
            onChanged: (v) => setState(() => _selectedLeaderboardTab = v),
          ),
        ),

        const SizedBox(height: 28),

        // 3. Podium of Top 3 (RTL: Right = 2nd, Center = 1st, Left = 3rd)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Right: 2nd Place (Silver)
                Expanded(
                  child: _buildPodiumItem(
                    item: secondPlace,
                    rankNumber: '2',
                    rankColor: const Color(0xFFCBD5E1),
                    circleSize: 78.0,
                    iconTint: const Color(0xFFCBD5E1),
                  ),
                ),

                // Center: 1st Place (Gold - Largest)
                Expanded(
                  child: _buildPodiumItem(
                    item: firstPlace,
                    rankNumber: '1',
                    rankColor: const Color(0xFFFFD580),
                    circleSize: 94.0,
                    iconTint: const Color(0xFFFFD580),
                  ),
                ),

                // Left: 3rd Place (Bronze)
                Expanded(
                  child: _buildPodiumItem(
                    item: thirdPlace,
                    rankNumber: '3',
                    rankColor: const Color(0xFFC8824C),
                    circleSize: 72.0,
                    iconTint: const Color(0xFFC8824C),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // The viewer's own row (or their caravan's): the same figures the ranking used, wherever they stand
        if (myIndex >= 3) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0),
            child: _buildMineRow(
              (isMembersTab ? _memberRows : _caravanRows)[myId],
              title: isMembersTab ? 'شما' : 'کاروان شما',
              rank: myIndex + 1,
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Real capital vs its value, and what orders the list (hidden until tapped)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: InfoReveal(
            text: 'سرمایه‌ی واقعی همان مقدار هر دارایی است. ارزش سرمایه = ${AssetNames.of('zarik')} + هر ${AssetNames.of('farsh')} '
            '${EconomyRates.farshSalePrice.toString().toPersianDigits()} ${AssetNames.of('zarik')}؛ '
            '${AssetNames.of('nakh')} تا به ${AssetNames.of('farsh')} تبدیل نشود و ${AssetNames.of('derafsh')} در آن حساب نمی‌شوند. '
            '${isMembersTab ? 'رتبه بر اساس ارزش سرمایه است.' : 'رتبه‌ی کاروان‌ها بر اساس سرانه (ارزش سرمایه تقسیم بر تعداد اعضا) است و در تساوی، '
                'امتیاز ${AssetNames.of('derafsh')} تعیین می‌کند (طلایی ۲۰، نقره‌ای ۱۰، برنزی ۵، پارچه‌ای ۱).'}',
          ),
        ),

        const SizedBox(height: 16),

        // 4. Bottom Footer Stats: "تعداد کل: 150" | "رتبه شما: 10"
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // تعداد کل
                RichText(
                  text: TextSpan(
                    style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
                    children: [
                      const TextSpan(text: 'تعداد کل: '),
                      TextSpan(
                        text: totalText.toPersianDigits(),
                        style: AppTypography.h3,
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 32),

                // رتبه شما
                RichText(
                  text: TextSpan(
                    style: AppTypography.bodyLarge.copyWith(color: Color(0xFFC7C5DD)),
                    children: [
                      const TextSpan(text: 'رتبه شما: '),
                      TextSpan(
                        text: myRankText.toPersianDigits(),
                        style: AppTypography.h3,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Single Podium Item (Clean Flat Avatar without neon glow, with Rank Number placed on the RIGHT of the name)
  Widget _buildPodiumItem({
    required Map<String, dynamic> item,
    required String rankNumber,
    required Color rankColor,
    required double circleSize,
    required Color iconTint,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Clean Circle Avatar with solid matching border (no neon/glowing shadows)
        Container(
          width: circleSize,
          height: circleSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF28274A),
            border: Border.all(
              color: rankColor,
              width: rankNumber == '1' ? 2.0 : 1.6,
            ),
          ),
          child: Center(
            child: (item['avatarUrl'] as String? ?? '').isNotEmpty
                ? SafeAvatar(
                    imageUrl: item['avatarUrl'] as String,
                    name: item['name'] as String,
                    radius: circleSize / 2 - 3,
                    cacheSize: 260,
                  )
                : SvgPicture.asset(
                    'assets/svg_icons/profile01.svg',
                    width: circleSize * 0.52,
                    height: circleSize * 0.52,
                    fit: BoxFit.contain,
                    colorFilter: ColorFilter.mode(iconTint, BlendMode.srcIn),
                  ),
          ),
        ),

        const SizedBox(height: 10),

        // Name & Rank Number row: Rank Number placed on the RIGHT in RTL
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // 1. Right in RTL: Rank Number (1, 2, 3)
            Text(
              rankNumber.toPersianDigits(),
              style: TextStyle(
                color: rankColor,
                fontSize: rankNumber == '1' ? 18 : 16,
                fontWeight: FontWeight.w900,
                fontFamily: AppTheme.fontFamily,
                fontFamilyFallback: AppTheme.fontFamilyFallback,
              ),
            ),
            const SizedBox(width: 5),

            // 2. Left in RTL: Name (flat, non-luminous text)
            Flexible(
              child: Text(
                item['name'] as String,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.h3,
              ),
            ),
          ],
        ),

        const SizedBox(height: 4),

        // Each asset on its own line, then the total value in zarik
        if (item['assets'] is Map) ...[
          const SizedBox(height: 4),
          for (final e in (item['assets'] as Map<String, int>).entries) _podiumAssetLine(e.key, e.value),
          const SizedBox(height: 6),
          // caravans: the banners' points (what breaks a tie of value)
          if (item['bannerPoints'] != null) ...[
            Text(
              'امتیاز ${AssetNames.of('derafsh')}: ${_formatScore(item['bannerPoints']).toPersianDigits()}',
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(color: const Color(0xFFD6D3E6), fontSize: 11),
            ),
            const SizedBox(height: 4),
          ],
          // the lines above are what is held (the real capital); this is its worth in zarik
          Text(
            'ارزش سرمایه (معادل ${AssetNames.of('zarik')})',
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(color: const Color(0xFF9E9AC0), fontSize: 10.5),
          ),
          const SizedBox(height: 2),
          Text(
            _formatScore(item['total']).toPersianDigits(),
            style: AppTypography.caption.copyWith(color: const Color(0xFFFFD580), fontWeight: FontWeight.w800),
          ),
          // caravans: the value per member, which is what orders them
          if (item['average'] != null) ...[
            const SizedBox(height: 4),
            Text(
              'سرانه‌ی هر نفر',
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(color: const Color(0xFF9E9AC0), fontSize: 10.5),
            ),
            const SizedBox(height: 2),
            Text(
              _formatScore(item['average']).toPersianDigits(),
              style: AppTypography.caption.copyWith(color: const Color(0xFFFFD580), fontWeight: FontWeight.w700),
            ),
          ],
        ],
      ],
    );
  }

  /// «شما» / «کاروان شما» under the podium when outside the top three: the place, each asset held, the banner points
  /// (caravans) and the value in zarik, exactly as the ranking counted them.
  Widget _buildMineRow(Map<String, dynamic>? row, {required String title, required int rank}) {
    if (row == null) return const SizedBox.shrink();
    final assets = row['assets'] is Map ? row['assets'] as Map<String, int> : const <String, int>{};
    final label = AppTypography.caption.copyWith(color: const Color(0xFFC5BEEB), fontSize: 11.5);
    final value = AppTypography.caption.copyWith(color: const Color(0xFFFFD580), fontWeight: FontWeight.w800, fontSize: 11.5);
    Widget item(String name, Object amount, {TextStyle? style}) => Text.rich(TextSpan(children: [
          TextSpan(text: '$name: ', style: label),
          TextSpan(text: _formatScore(amount).toPersianDigits(), style: style ?? label.copyWith(color: const Color(0xFFE2E0F0))),
        ]));
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF282548).withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFFD580).withValues(alpha: 0.35), width: 0.9),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('$title — رتبه‌ی ${rank.toString().toPersianDigits()}', style: AppTypography.h3.copyWith(color: const Color(0xFFFFD580))),
            const SizedBox(height: 6),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                for (final e in assets.entries) item(AssetNames.of(e.key), e.value),
                if (row['bannerPoints'] != null) item('امتیاز ${AssetNames.of('derafsh')}', row['bannerPoints']),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                item('ارزش سرمایه (معادل ${AssetNames.of('zarik')})', row['total'] ?? 0, style: value),
                if (row['average'] != null) item('سرانه‌ی هر نفر', row['average'], style: value),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// One asset of a podium entry: its icon, name and amount.
  Widget _podiumAssetLine(String key, int amount) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AssetIcon(key, size: 13),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                '${AssetNames.of(key)}: ${_formatScore(amount).toPersianDigits()}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(color: const Color(0xFFD6D3E6), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
