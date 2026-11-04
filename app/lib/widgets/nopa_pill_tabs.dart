import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/nopa_pressable.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_motion.dart';
import '../core/theme/app_theme.dart';

/// One tab of a [NopaPillTabs].
class NopaPillTab<T> {
  final T value;
  final String label;
  const NopaPillTab(this.value, this.label);
}

/// The app's single segmented tab switcher (the login-screen mode switcher look):
/// gradient stroke frame, dark surface, gold-gradient selected pill.
///
/// Used for the members' report tabs, the market tabs (members report / exchanges,
/// top participants / top caravans) and the chat profile tabs (photos, voices, links, sessions).
/// With [expand] the tabs share the full width equally and one gold pill slides between them;
/// otherwise the bar hugs its content and the pill cross-fades between tabs.
class NopaPillTabs<T> extends StatelessWidget {
  final List<NopaPillTab<T>> tabs;
  final T selected;
  final ValueChanged<T> onChanged;
  final bool expand;

  const NopaPillTabs({
    super.key,
    required this.tabs,
    required this.selected,
    required this.onChanged,
    this.expand = false,
  });

  static const double _gap = 4;

  @override
  Widget build(BuildContext context) {
    return Container(
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
        padding: const EdgeInsets.all(3),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: expand ? _slidingBar(context) : _row(context, pillPerTab: true),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, {required bool pillPerTab}) {
    return Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      children: [
        for (var i = 0; i < tabs.length; i++) ...[
          if (i > 0) const SizedBox(width: _gap),
          if (expand) Expanded(child: _tab(context, tabs[i], pillPerTab)) else _tab(context, tabs[i], pillPerTab),
        ],
      ],
    );
  }

  /// Full-width mode: equal-width tabs with a single pill that slides under the selected one.
  Widget _slidingBar(BuildContext context) {
    final int index = tabs.indexWhere((t) => t.value == selected).clamp(0, tabs.length - 1);
    return LayoutBuilder(
      builder: (context, constraints) {
        final double tabWidth = (constraints.maxWidth - _gap * (tabs.length - 1)) / tabs.length;
        return Stack(
          children: [
            AnimatedPositionedDirectional(
              duration: AppMotion.dur(context, AppMotion.base),
              curve: AppMotion.enter,
              start: index * (tabWidth + _gap),
              width: tabWidth,
              top: 0,
              bottom: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: AppColors.accentGradient, borderRadius: BorderRadius.circular(8)),
              ),
            ),
            _row(context, pillPerTab: false),
          ],
        );
      },
    );
  }

  Widget _tab(BuildContext context, NopaPillTab<T> tab, bool pillPerTab) {
    final bool isSelected = tab.value == selected;
    final Duration duration = AppMotion.dur(context, const Duration(milliseconds: 180));
    // Unselected tabs use a fully transparent copy of the accent gradient so the pill fades in and out smoothly
    final Gradient? fill = pillPerTab ? (isSelected ? AppColors.accentGradient : AppColors.accentGradient.scale(0)) : null;
    return NopaPressable(
      pressedScale: 0.97,
      child: TapExpander(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            if (!isSelected) HapticFeedback.selectionClick();
            onChanged(tab.value);
          },
          child: AnimatedContainer(
            duration: duration,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              gradient: fill,
              borderRadius: BorderRadius.circular(8),
            ),
            child: AnimatedDefaultTextStyle(
              duration: duration,
              style: AppTypography.bodyMedium.copyWith(color: isSelected ? Colors.white : const Color(0xFF8E889D)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              child: Text(tab.label),
            ),
          ),
        ),
      ),
    );
  }
}
