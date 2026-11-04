import 'package:nopa_app/widgets/tap_expander.dart';
import 'nopa_modal_shell.dart';
import 'package:nopa_app/core/station_numbering.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';

/// Standalone, reusable Station Progress Stepper Header
/// Used in Academy/MapScreen and Class1Screen to display station nodes (1..5),
/// connecting glow rails, and the end-of-track Champion Victory Trophy.
/// Node labels are 1-based (matching admin panel's levelFrame field: 1-5).
class StationProgressStepper extends StatelessWidget {
  final int currentStationIndex;
  final ValueChanged<int>? onStationSelected;
  final String? title;
  final int? totalNodes;
  final int? userLevelFrame;
  final int? completedStationsCount;

  const StationProgressStepper({
    super.key,
    required this.currentStationIndex,
    this.onStationSelected,
    this.title,
    this.totalNodes,
    this.userLevelFrame,
    this.completedStationsCount,
  });

  static const double nodeSize = 28.0;
  static const double trophySize = 36.0;

  @override
  Widget build(BuildContext context) {
    final int totalNodes = this.totalNodes ?? StationNumbering.count;
    final repository = Provider.of<AppRepository>(context, listen: false);
    final user = repository.currentUser;

    final int effectiveLevelFrame = userLevelFrame ?? (user.levelFrame < 1 ? 1 : user.levelFrame);
    final int effectiveCompletedCount = completedStationsCount ?? user.completedStationsCount;
    final int activeUserStationIndex = (effectiveLevelFrame - 1).clamp(0, totalNodes - 1);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 6),

        // Stepper Header Title
        Text(
          title ?? 'منزلگاه را انتخاب کنید',
          style: AppTypography.h3.copyWith(color: Color(0xFFEDE8F5)),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),

        // Horizontal Nodes Track (Left to Right: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> Trophy)
        SingleChildScrollView(
          clipBehavior: Clip.none,
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              height: 48,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  for (int i = 0; i < totalNodes; i++) ...[
                    // Station Node Circle
                    _buildStationNode(
                      index: i,
                      isSelected: i == currentStationIndex,
                      activeStationIndex: activeUserStationIndex,
                      userLevelFrame: effectiveLevelFrame,
                      completedStationsCount: effectiveCompletedCount,
                    ),

                    // Connecting Rails Track Segment between node i and node i+1 (or Champion)
                    _buildTrackConnector(
                      index: i,
                      currentStationIndex: currentStationIndex,
                      userLevelFrame: effectiveLevelFrame,
                      completedStationsCount: effectiveCompletedCount,
                      width: 12.0,
                    ),
                  ],

                  // Champion Victory Trophy Badge (champun01.svg) at the end of the track
                  _buildChampionBadge(context, trophySize),
                ],
              ),
            ),
          ),
        ),

        // Subtle gradient divider below the track
        Container(
          height: 1,
          margin: const EdgeInsets.only(left: 16, right: 16, top: 10, bottom: 10),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.white.withValues(alpha: 0.0),
                Colors.white.withValues(alpha: 0.12),
                Colors.white.withValues(alpha: 0.0),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static const Color _gold = Color(0xFFE5A133);
  static const Color _locked = Color(0xFF2B284E);

  /// Station node:
  /// - passed stations are gold with a glow;
  /// - a station not completed yet is tinted by its distance from the last completed one: the first one after
  ///   it is the lightest and each following one fades further towards the locked purple;
  /// - only the selected station has a white stroke and black text, the others have no stroke.
  Widget _buildStationNode({
    required int index,
    required bool isSelected,
    required int activeStationIndex,
    required int userLevelFrame,
    required int completedStationsCount,
  }) {
    final int passedCount = (userLevelFrame - 1) > completedStationsCount ? (userLevelFrame - 1) : completedStationsCount;
    // The current station (the first one not completed yet) is gold like the finished ones
    final bool isGold = index <= passedCount;

    Color fill;
    List<BoxShadow>? boxShadow;
    if (isGold) {
      fill = _gold;
      boxShadow = [
        BoxShadow(color: const Color(0xFFFFB800).withValues(alpha: 0.65), blurRadius: 12, spreadRadius: 2),
        BoxShadow(color: const Color(0xFFEAA835).withValues(alpha: 0.45), blurRadius: 8, spreadRadius: 1),
      ];
    } else {
      final int distance = index - passedCount; // 1 = first station after the current one
      double t = switch (distance) { 1 => 0.34, 2 => 0.2, _ => 0.1 };
      if (isSelected && t < 0.6) t = 0.6; // keeps the black label readable on the selected node
      fill = Color.lerp(_locked, _gold, t)!;
    }

    return TapExpander(child: GestureDetector(
      onTap: onStationSelected != null ? () => onStationSelected!(index) : null,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
        width: nodeSize,
        height: nodeSize,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: fill,
          border: isSelected ? Border.all(color: Colors.white, width: 2.0) : null,
          boxShadow: boxShadow,
        ),
        child: Center(
          child: Text(
            StationNumbering.numberAt(index + 1).toString().toPersianDigits(),
            style: TextStyle(
              color: isSelected ? Colors.black : Colors.white,
              fontSize: isSelected ? 12.5 : 11.5,
              fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      ),
    ));
  }

  /// Connecting Horizontal Rail Track Segment between Stations
  Widget _buildTrackConnector({
    required int index,
    required int currentStationIndex,
    required int userLevelFrame,
    required int completedStationsCount,
    required double width,
  }) {
    // Filled up to the current station and a little past it; selecting another station does not change it
    final int reached = (userLevelFrame - 1) > completedStationsCount ? (userLevelFrame - 1) : completedStationsCount;
    final bool isPassed = index < reached;
    final bool isGlowingSegment = index <= reached;

    return SizedBox(
      width: width,
      height: 14,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Double rail horizontal lines
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 1.5,
                color: const Color(0xFF453F73),
              ),
              const SizedBox(height: 4),
              Container(
                height: 1.5,
                color: const Color(0xFF453F73),
              ),
            ],
          ),

          // Glowing amber line segment transitioning away from current active node
          if (isGlowingSegment)
            Container(
              height: 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                gradient: LinearGradient(
                  colors: isPassed
                      ? [const Color(0xFFE5A133), const Color(0xFFC07F1C)]
                      : [const Color(0xFFFFB732), const Color(0x00FFB732)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFB732).withValues(alpha: 0.4),
                    blurRadius: 6,
                    spreadRadius: 0.5,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// End-of-track Champion Victory Badge with SVG `champun01.svg`
  void _showFinalDialog(BuildContext context) {
    showNopaModal<void>(
      context,
      builder: (ctx) => NopaModalShell(
        maxWidth: 380,
        headerIcon: Icons.emoji_events_rounded,
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
        actions: [
          NopaModalAction(
            label: 'بستن',
            onPressed: () => Navigator.pop(ctx),
          ),
        ],
        child: const Text(
                  'سرزمین نپا، مقصد نهایی شماست. جایی که گنجبنه‌ی علاء‌الملک زنان و مردان باهوش و سرسخت را به مبارزه با مسیری دشوار فراخوانده است. فراخوانی که در نهایت به میهمانی بزرگی ختم خواهد شد.',
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyLarge,
                ),
      ),
    );
  }

  Widget _buildChampionBadge(BuildContext context, double size) {
    return TapExpander(child: GestureDetector(
      onTap: () => _showFinalDialog(context),
      behavior: HitTestBehavior.opaque,
      child: _championBadgeBody(size),
    ));
  }

  Widget _championBadgeBody(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF3C79E),
            Color(0xFFDCA472),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFDCA472).withValues(alpha: 0.45),
            blurRadius: 16,
            spreadRadius: 1,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: SvgPicture.asset(
          'assets/svg_icons/champun01.svg',
          width: 26,
          height: 26,
          colorFilter: const ColorFilter.mode(
            Color(0xFF5A3114),
            BlendMode.srcIn,
          ),
        ),
      ),
    );
  }
}
