import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../services/app_state_repository.dart';

/// Standalone, reusable Station Progress Stepper Header
/// Used in Academy/MapScreen and Class1Screen to display station nodes (0..5),
/// connecting glow rails, and the end-of-track Champion Victory Trophy.
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
    this.totalNodes = 6,
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
                  _buildChampionBadge(trophySize),
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

  /// Individual Station Node with Dynamic Styling Based on Distance/State
  Widget _buildStationNode({
    required int index,
    required bool isSelected,
    required int activeStationIndex,
    required int userLevelFrame,
    required int completedStationsCount,
  }) {
    final bool isCurrent = isSelected;
    final bool isPassed = index < (userLevelFrame - 1) || index < completedStationsCount;
    final bool isFirstNext = index == activeStationIndex + 1;
    final bool isSecondNext = index == activeStationIndex + 2;

    Gradient gradient;
    Border border;
    List<BoxShadow>? boxShadow;

    if (isCurrent) {
      // Selected station: Luminous bright golden glow
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFFFD574),
          Color(0xFFE59819),
        ],
      );
      border = Border.all(color: const Color(0xFFFFF0B8), width: 2.0);
      boxShadow = [
        BoxShadow(
          color: const Color(0xFFFFB800).withValues(alpha: 0.75),
          blurRadius: 14,
          spreadRadius: 2.0,
        ),
        BoxShadow(
          color: const Color(0xFFEAA835).withValues(alpha: 0.55),
          blurRadius: 10,
          spreadRadius: 1,
        ),
      ];
    } else if (isPassed) {
      // Completed stations: Warm gold light and subtle glow
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFE5A133),
          Color(0xFFC07F1C),
        ],
      );
      border = Border.all(color: const Color(0xFFFFD574), width: 1.3);
      boxShadow = [
        BoxShadow(
          color: const Color(0xFFD4973B).withValues(alpha: 0.4),
          blurRadius: 8,
          spreadRadius: 1,
        ),
      ];
    } else if (isFirstNext) {
      // 1 step next: Medium warm bronze/gold tint
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFA57C46),
          Color(0xFF8B6230),
        ],
      );
      border = Border.all(color: const Color(0xFFC9985E), width: 1.2);
    } else if (isSecondNext) {
      // 2 steps next: Darker bronze tint
      gradient = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF755530),
          Color(0xFF5A3E20),
        ],
      );
      border = Border.all(color: const Color(0xFF906D44), width: 1.2);
    } else {
      // Subsequent locked stations: Dark purple
      gradient = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFF38355F),
          Color(0xFF2B284E),
        ],
      );
      border = Border.all(color: const Color(0xFF5C578F), width: 1.2);
    }

    return GestureDetector(
      onTap: onStationSelected != null ? () => onStationSelected!(index) : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: nodeSize,
        height: nodeSize,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: gradient,
          border: border,
          boxShadow: boxShadow,
        ),
        child: Center(
          child: Text(
            '$index'.toPersianDigits(),
            style: TextStyle(
              color: isCurrent ? const Color(0xFF221503) : Colors.white,
              fontSize: isCurrent ? 12.5 : 11.5,
              fontWeight: isCurrent ? FontWeight.w900 : FontWeight.bold,
              fontFamily: AppTheme.fontFamily,
              fontFamilyFallback: AppTheme.fontFamilyFallback,
            ),
          ),
        ),
      ),
    );
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
  Widget _buildChampionBadge(double size) {
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
