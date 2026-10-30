import 'package:nopa_app/widgets/tap_expander.dart';
import 'package:nopa_app/core/station_numbering.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_colors.dart';
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
  final int totalNodes;
  final int? userLevelFrame;
  final int? completedStationsCount;

  const StationProgressStepper({
    super.key,
    required this.currentStationIndex,
    this.onStationSelected,
    this.title,
    this.totalNodes = 5,
    this.userLevelFrame,
    this.completedStationsCount,
  });

  static const double nodeSize = 28.0;
  static const double trophySize = 36.0;

  @override
  Widget build(BuildContext context) {
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
          style: const TextStyle(
            color: Color(0xFFEDE8F5),
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            fontFamily: AppTheme.fontFamily,
            fontFamilyFallback: AppTheme.fontFamilyFallback,
          ),
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
    final bool isPassed = index < passedCount;

    Color fill;
    List<BoxShadow>? boxShadow;
    if (isPassed) {
      fill = _gold;
      boxShadow = [
        BoxShadow(color: const Color(0xFFFFB800).withValues(alpha: 0.65), blurRadius: 12, spreadRadius: 2),
        BoxShadow(color: const Color(0xFFEAA835).withValues(alpha: 0.45), blurRadius: 8, spreadRadius: 1),
      ];
    } else {
      final int distance = index - passedCount + 1; // 1 = first station after the last completed one
      double t = switch (distance) { 1 => 0.55, 2 => 0.34, 3 => 0.2, _ => 0.1 };
      if (isSelected && t < 0.6) t = 0.6; // keeps the black label readable on the selected node
      fill = Color.lerp(_locked, _gold, t)!;
    }

    return TapExpander(child: GestureDetector(
      onTap: onStationSelected != null ? () => onStationSelected!(index) : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
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
    required double width,
  }) {
    final bool isPassed = index < (userLevelFrame - 1);
    final bool isGlowingSegment = index == currentStationIndex || isPassed;

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
    showDialog<void>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 380),
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 14),
            decoration: AppColors.loginDialogDecoration(radius: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'اینجا قرار یک ملاقات و اتمام انتظار شما برای رویارویی با دستیافتن شدن ارزوی ابادانی جهان نپاست. اینجا قرارگاه ماست. منتظرتان هستیم.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.9,
                    fontWeight: FontWeight.w600,
                    fontFamily: AppTheme.fontFamily,
                    fontFamilyFallback: AppTheme.fontFamilyFallback,
                  ),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text(
                    'بستن',
                    style: TextStyle(
                      color: Color(0xFFE5A855),
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
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
