import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/tap_expander.dart';
import '../core/theme/app_colors.dart';
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
/// With [expand] the tabs share the full width equally; otherwise the bar hugs its content.
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
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            children: [
              for (var i = 0; i < tabs.length; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                if (expand)
                  Expanded(child: _tab(tabs[i]))
                else
                  _tab(tabs[i]),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _tab(NopaPillTab<T> tab) {
    final bool isSelected = tab.value == selected;
    return TapExpander(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(tab.value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            gradient: isSelected ? AppColors.accentGradient : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            tab.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.bodyMedium.copyWith(color: isSelected ? Colors.white : const Color(0xFF8E889D)),
          ),
        ),
      ),
    );
  }
}
